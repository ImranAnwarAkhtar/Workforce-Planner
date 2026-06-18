/**
 * Seeds the first N rows from the "N TBH" tab of the HUB Summaries Excel
 * into the Railway API via POST /api/tbh-codes (upsert logic is server-side).
 *
 * Usage:
 *   node scripts/seedNTBH.js "path\to\file.xlsx" [rowLimit]
 *   Default rowLimit = 30
 */

const path  = require('path');
const https = require('https');
const XLSX  = require('xlsx');

const filePath = process.argv[2];
const ROW_LIMIT = parseInt(process.argv[3] ?? '30', 10);
const API_BASE  = 'https://workforce-planner-production.up.railway.app/api';

if (!filePath) {
  console.error('Usage: node scripts/seedNTBH.js <path-to-xlsx> [rowLimit]');
  process.exit(1);
}

// ── helpers (mirrors tbhCodes.js) ────────────────────────────────────────────

const STATUS_MAP    = { 'Hired': 'Filled', 'Closed': 'Cancelled' };
const HIRE_TYPE_MAP = {
  'New Hire - Budgeted':    'Net New',
  'Contractor Conversion':  'Conversion',
  'Replacement':            'Backfill',
};

function normalise(s)  { return String(s ?? '').replace(/\s+/g, ' ').trim(); }
function clean(v)      { const s = normalise(v); return (!s || s === '0') ? null : s; }
function extractYear(f){ const m = String(f ?? '').match(/(\d{4})/); return m ? parseInt(m[1], 10) : null; }

function parseExcelDate(val) {
  const s = normalise(val);
  if (!s || s === '0') return null;
  // XLSX may return serial numbers for date cells
  if (/^\d+$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(parseInt(s, 10));
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    return null;
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number);
  if (d === 0 || mo === 0 || y < 1950) return null;
  return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function mapProjectType(p) {
  const s = normalise(p).toLowerCase();
  if (s.includes('matrix'))                    return 'Matrix';
  if (s.includes('xscale') || s.includes('x scale')) return 'xScale';
  if (s === 'retail')                          return 'Retail';
  return null;
}

function locationCode(loc) {
  const m = normalise(loc).match(/^(\d{4})/);
  return m ? m[1] : (normalise(loc).substring(0, 20) || null);
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function postJSON(endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url     = new URL(API_BASE + endpoint);
    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      rejectUnauthorized: false,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Reading: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames.includes('N TBH') ? 'N TBH' : wb.SheetNames[0];
  console.log(`Sheet: "${sheetName}"`);

  const ws      = wb.Sheets[sheetName];
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`Total rows in sheet: ${allRows.length}`);

  // Find header row
  let headerIdx = -1;
  let colMap    = {};
  for (let i = 0; i < Math.min(8, allRows.length); i++) {
    const row   = allRows[i];
    const found = row.findIndex(c => normalise(String(c)) === 'TBH ID');
    if (found >= 0) {
      headerIdx = i;
      row.forEach((h, idx) => { const k = normalise(String(h)); if (k) colMap[k] = idx; });
      break;
    }
  }
  if (headerIdx < 0) { console.error('Cannot find header row with "TBH ID"'); process.exit(1); }
  console.log(`Header at row ${headerIdx + 1}. Columns: ${Object.keys(colMap).length}`);
  console.log('Columns found:', Object.keys(colMap).join(' | '));

  function cell(row, ...keys) {
    for (const k of keys) {
      const idx = colMap[normalise(k)];
      if (idx !== undefined) {
        const v = normalise(String(row[idx] ?? ''));
        if (v) return v;
      }
    }
    return '';
  }

  let inserted = 0, updated = 0, skipped = 0, failed = 0;
  const dataRows = allRows.slice(headerIdx + 1);

  for (let i = 0; i < Math.min(ROW_LIMIT, dataRows.length); i++) {
    const row = dataRows[i];
    if (!row.length || row.every(c => !normalise(String(c)))) { skipped++; continue; }

    let tbhId  = cell(row, 'TBH ID');
    const oldTbh = cell(row, 'OLD TBH');
    if (!tbhId || tbhId === 'No new Code') tbhId = oldTbh;
    if (!tbhId) { console.log(`Row ${i + headerIdx + 2}: no TBH ID or OLD TBH — skipped`); skipped++; continue; }

    const rawStatus  = cell(row, 'REQ Status');
    const reqStatus  = STATUS_MAP[rawStatus] || rawStatus || null;
    const rawHireType = cell(row, 'Hire Type');
    const hireType   = HIRE_TYPE_MAP[rawHireType] || rawHireType || null;

    let candidateName = clean(cell(row, 'Final Candidate'));
    const taComments  = clean(cell(row, 'TA Status Comments + Location + TA Contact name + Offer Comp Ratio + Current Company'));
    if (!candidateName) candidateName = taComments;

    const body = {
      tbh_id:             tbhId,
      old_tbh:            clean(oldTbh),
      funding_year:       extractYear(cell(row, 'FUNDING')),
      hire_type:          hireType,
      project_type:       mapProjectType(cell(row, 'Project')),
      legal_entity:       clean(cell(row, 'Legal Entity Final')),
      location_code:      locationCode(cell(row, 'Location')),
      cost_centre:        clean(cell(row, 'Cost Center', 'Cost Centre')),
      job_profile:        clean(cell(row, 'Job Profile', 'Job  Profile')),
      replaced_emp_name:  clean(cell(row, 'Replaced Emp Name')),
      manager_name:       clean(cell(row, 'Manager Name')),
      target_hire_date:   parseExcelDate(cell(row, 'Hire Date')),
      jr_id:              clean(cell(row, 'Job Req ID')),
      req_status:         reqStatus,
      ta_contact:         clean(cell(row, 'TA Contact')),
      candidate_name:     candidateName,
      estimated_hire_date: parseExcelDate(cell(row, 'TA (Estimated) Hire Date')),
      ta_status_comments: taComments,
      tbh_description:    clean(cell(row, 'TBH Description')),
      fp_and_a_notes:     clean(cell(row, 'Note from FP&A', 'Note from FP&A Approver')),
    };

    // Truncate job_profile to 100 chars (DB varchar limit)
    if (body.job_profile && body.job_profile.length > 100) body.job_profile = body.job_profile.slice(0, 100);

    try {
      const result = await postJSON('/tbh-codes', body);
      if (result.status === 201) {
        inserted++;
        console.log(`[${i+1}/${ROW_LIMIT}] ✓ Created  ${tbhId}`);
      } else if (result.status === 409) {
        updated++;
        console.log(`[${i+1}/${ROW_LIMIT}] ~ Exists   ${tbhId}`);
      } else {
        failed++;
        console.log(`[${i+1}/${ROW_LIMIT}] ✗ HTTP ${result.status} ${tbhId}: ${JSON.stringify(result.body)}`);
      }
    } catch (err) {
      failed++;
      console.log(`[${i+1}/${ROW_LIMIT}] ✗ Network error ${tbhId}: ${err.message}`);
    }
  }

  console.log(`\nDone — created: ${inserted}, already exists: ${updated}, skipped: ${skipped}, failed: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
