const { Router } = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/rbac');

const router = Router();

// ── Reference data (all authenticated users) ──────────────────────────────────

router.get('/regions', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM regions ORDER BY sort_order ASC');
  res.json({ data: rows });
});

router.get('/countries', requireAuth, async (req, res) => {
  const { region_id } = req.query;
  const params = [];
  const where = region_id ? `WHERE region_id = $1` : '';
  if (region_id) params.push(parseInt(region_id, 10));
  const { rows } = await pool.query(
    `SELECT c.*, r.name AS region_name FROM countries c JOIN regions r ON c.region_id = r.id ${where} ORDER BY c.sort_order ASC`,
    params
  );
  res.json({ data: rows });
});

router.get('/disciplines', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM disciplines ORDER BY name ASC');
  res.json({ data: rows });
});

router.get('/levels', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM levels ORDER BY level_number DESC NULLS LAST');
  res.json({ data: rows });
});

router.get('/contract-types', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM contract_types ORDER BY category ASC, code ASC');
  res.json({ data: rows });
});

// ── Users (PMO only) ──────────────────────────────────────────────────────────

router.get('/users', requireAuth, requireRole(ROLES.PMO), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name ASC'
  );
  res.json({ data: rows });
});

router.post('/users', requireAuth, requireRole(ROLES.PMO), async (req, res) => {
  const { auth0_id, name, email, role } = req.body;
  if (!auth0_id || !name || !email || !role) {
    return res.status(400).json({ error: 'auth0_id, name, email, and role are required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO users (auth0_id, name, email, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, is_active, created_at',
    [auth0_id, name, email, role]
  );
  await req.auditLog({ actionType: 'CREATE', resourceType: 'user', resourceId: rows[0].id, newValue: rows[0] });
  res.status(201).json({ data: rows[0] });
});

router.put('/users/:id', requireAuth, requireRole(ROLES.PMO), async (req, res) => {
  const { name, email, role, is_active } = req.body;
  const sets = [];
  const params = [];
  let i = 1;

  if (name      !== undefined) { sets.push(`name = $${i++}`);      params.push(name); }
  if (email     !== undefined) { sets.push(`email = $${i++}`);     params.push(email); }
  if (role      !== undefined) { sets.push(`role = $${i++}`);      params.push(role); }
  if (is_active !== undefined) { sets.push(`is_active = $${i++}`); params.push(is_active); }

  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);

  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, name, email, role, is_active`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  await req.auditLog({ actionType: 'UPDATE', resourceType: 'user', resourceId: rows[0].id, newValue: rows[0] });
  res.json({ data: rows[0] });
});

// ── Colour thresholds (PMO only for write) ────────────────────────────────────

router.get('/colour-thresholds', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM colour_thresholds ORDER BY sort_order ASC');
  res.json({ data: rows });
});

router.put('/colour-thresholds/:id', requireAuth, requireRole(ROLES.PMO), async (req, res) => {
  const { name, min_fte, max_fte, colour_hex, sort_order } = req.body;
  const sets = [];
  const params = [];
  let i = 1;

  if (name       !== undefined) { sets.push(`name = $${i++}`);       params.push(name); }
  if (min_fte    !== undefined) { sets.push(`min_fte = $${i++}`);    params.push(min_fte); }
  if (max_fte    !== undefined) { sets.push(`max_fte = $${i++}`);    params.push(max_fte); }
  if (colour_hex !== undefined) { sets.push(`colour_hex = $${i++}`); params.push(colour_hex); }
  if (sort_order !== undefined) { sets.push(`sort_order = $${i++}`); params.push(sort_order); }
  sets.push(`updated_by = $${i++}`);
  params.push(req.user.id);

  if (sets.length === 1) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);

  const { rows } = await pool.query(
    `UPDATE colour_thresholds SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: 'Colour threshold not found' });
  res.json({ data: rows[0] });
});

// ── Planning years (PMO + Workforce Planning) ─────────────────────────────────

router.get('/planning-years', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM planning_years ORDER BY year ASC');
  res.json({ data: rows });
});

router.post('/planning-years', requireAuth, requireRole(ROLES.PMO, ROLES.WORKFORCE_PLANNING), async (req, res) => {
  const { year, copied_from_year } = req.body;
  if (!year) return res.status(400).json({ error: 'year is required' });
  const { rows } = await pool.query(
    'INSERT INTO planning_years (year, copied_from_year, created_by) VALUES ($1,$2,$3) RETURNING *',
    [year, copied_from_year ?? null, req.user.id]
  );
  res.status(201).json({ data: rows[0] });
});

// ── Hierarchy config (PMO only for write) ─────────────────────────────────────

router.get('/hierarchy-config', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM hierarchy_config');
  res.json({ data: rows });
});

router.put('/hierarchy-config/:view', requireAuth, requireRole(ROLES.PMO), async (req, res) => {
  const { level_order } = req.body;
  if (!Array.isArray(level_order)) return res.status(400).json({ error: 'level_order must be an array' });

  const { rows } = await pool.query(
    `UPDATE hierarchy_config SET level_order = $1, updated_by = $2 WHERE view_name = $3 RETURNING *`,
    [JSON.stringify(level_order), req.user.id, req.params.view]
  );
  if (!rows.length) return res.status(404).json({ error: 'View not found' });
  res.json({ data: rows[0] });
});

// ── Finance settings (PMO + Finance) ─────────────────────────────────────────

router.get('/finance-settings', requireAuth, requireRole(ROLES.PMO, ROLES.FINANCE), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM finance_settings ORDER BY id DESC LIMIT 1');
  res.json({ data: rows[0] ?? null });
});

router.put('/finance-settings', requireAuth, requireRole(ROLES.PMO, ROLES.FINANCE), async (req, res) => {
  const { notification_emails } = req.body;
  const { rows } = await pool.query(
    `UPDATE finance_settings SET notification_emails = $1, updated_by = $2, updated_at = NOW()
     WHERE id = (SELECT id FROM finance_settings ORDER BY id DESC LIMIT 1)
     RETURNING *`,
    [notification_emails ?? '', req.user.id]
  );
  res.json({ data: rows[0] });
});

// ── Change request rules (PMO only) ──────────────────────────────────────────

router.get('/change-request-rules', requireAuth, requireRole(ROLES.PMO), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM change_request_rules ORDER BY change_type ASC');
  res.json({ data: rows });
});

router.put('/change-request-rules/:id', requireAuth, requireRole(ROLES.PMO), async (req, res) => {
  const { auto_approve } = req.body;
  if (auto_approve === undefined) return res.status(400).json({ error: 'auto_approve is required' });
  const { rows } = await pool.query(
    'UPDATE change_request_rules SET auto_approve = $1, updated_by = $2 WHERE id = $3 RETURNING *',
    [auto_approve, req.user.id, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Rule not found' });
  res.json({ data: rows[0] });
});

module.exports = router;
