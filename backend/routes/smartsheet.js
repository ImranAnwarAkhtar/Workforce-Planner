const { Router } = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = Router();
const SHEET_ID = process.env.SMARTSHEET_CR_SHEET_ID || '7522591871815556';

async function fetchSheet() {
  const token = process.env.SMARTSHEET_API_TOKEN;
  if (!token) {
    const err = new Error('SMARTSHEET_API_TOKEN is not configured in environment variables');
    err.status = 503;
    throw err;
  }
  const res = await fetch(`https://api.smartsheet.com/2.0/sheets/${SHEET_ID}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Smartsheet API error (${res.status}): ${text}`);
    err.status = 502;
    throw err;
  }
  return res.json();
}

// GET /api/smartsheet/debug — confirms whether env vars are loaded (no secrets returned)
router.get('/debug', async (req, res) => {
  res.json({
    token_configured: !!process.env.SMARTSHEET_API_TOKEN,
    sheet_id: process.env.SMARTSHEET_CR_SHEET_ID || '7522591871815556 (default)',
    node_env: process.env.NODE_ENV || 'not set',
  });
});

// GET /api/smartsheet/change-requests
router.get('/change-requests', requireAuth, async (req, res) => {
  const sheet = await fetchSheet();

  const colMap = {};
  (sheet.columns || []).forEach(c => { colMap[c.id] = c.title; });
  const colTitles = (sheet.columns || []).map(c => c.title);

  const rows = (sheet.rows || []).map(row => {
    const obj = { _rowId: String(row.id), _rowNumber: row.rowNumber };
    (row.cells || []).forEach(cell => {
      const title = colMap[cell.columnId];
      if (title) obj[title] = cell.displayValue ?? cell.value ?? null;
    });
    return obj;
  });

  const [{ rows: statuses }, { rows: tbhEnrich }] = await Promise.all([
    pool.query(
      `SELECT smartsheet_row_id::text AS rid, plan_status, notes, updated_by_name, updated_at
       FROM cr_smartsheet_status`
    ),
    pool.query(`
      SELECT DISTINCT ON (LOWER(t.tbh_id))
        LOWER(t.tbh_id)  AS tbh_id,
        r.name           AS region_name,
        d.name           AS discipline_name
      FROM tbh_codes t
      LEFT JOIN regions     r ON t.region_id      = r.id
      LEFT JOIN people      p ON p.tbh_code_id    = t.id
      LEFT JOIN disciplines d ON p.discipline_id  = d.id
      WHERE t.tbh_id IS NOT NULL
      ORDER BY LOWER(t.tbh_id), p.id
    `),
  ]);

  const statusMap = {};
  statuses.forEach(s => { statusMap[s.rid] = s; });

  // tbhId → { inPlan, region_name, discipline_name }
  const tbhMap = {};
  tbhEnrich.forEach(r => { tbhMap[r.tbh_id] = r; });

  rows.forEach(row => {
    const s = statusMap[row._rowId] || {};
    row._planStatus      = s.plan_status     || 'Open';
    row._planNotes       = s.notes           || null;
    row._updatedByName   = s.updated_by_name || null;
    row._statusUpdatedAt = s.updated_at      || null;

    const tbhKey    = row['TBH Code']     ? String(row['TBH Code']).toLowerCase().trim()     : null;
    const newTbhKey = row['New TBH Code'] ? String(row['New TBH Code']).toLowerCase().trim() : null;
    const tbhEntry  = tbhKey    ? tbhMap[tbhKey]    : null;
    const newEntry  = newTbhKey ? tbhMap[newTbhKey] : null;

    row._tbhInPlan    = tbhKey    ? !!tbhEntry  : null;
    row._newTbhInPlan = newTbhKey ? !!newEntry  : null;
    row._region       = tbhEntry?.region_name     || newEntry?.region_name     || null;
    row._discipline   = tbhEntry?.discipline_name || newEntry?.discipline_name || null;
  });

  res.json({ columns: colTitles, rows });
});

// POST /api/smartsheet/change-requests/:rowId/status
// Saves the plan status for a row into the local DB (upsert)
router.post('/change-requests/:rowId/status', requireAuth, async (req, res) => {
  const { plan_status, notes } = req.body;
  const rowId = req.params.rowId;

  const { rows } = await pool.query(
    `INSERT INTO cr_smartsheet_status
       (smartsheet_row_id, plan_status, notes, updated_by_name, updated_at)
     VALUES ($1::bigint, $2, $3, $4, NOW())
     ON CONFLICT (smartsheet_row_id) DO UPDATE
       SET plan_status      = EXCLUDED.plan_status,
           notes            = EXCLUDED.notes,
           updated_by_name  = EXCLUDED.updated_by_name,
           updated_at       = NOW()
     RETURNING *`,
    [rowId, plan_status || 'Open', notes || null, req.user?.name || 'Unknown']
  );
  res.json({ data: rows[0] });
});

module.exports = router;
