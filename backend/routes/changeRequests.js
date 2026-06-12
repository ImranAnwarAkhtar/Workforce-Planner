const { Router } = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole, ALL_ROLES, ROLES } = require('../middleware/rbac');

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { status, change_type, submitted_by, limit = 100, offset = 0 } = req.query;
  const conditions = [];
  const params = [];
  let i = 1;

  if (status)      { conditions.push(`cr.status = $${i++}`);       params.push(status); }
  if (change_type) { conditions.push(`cr.change_type = $${i++}`);  params.push(change_type); }
  if (submitted_by){ conditions.push(`cr.submitted_by = $${i++}`); params.push(parseInt(submitted_by, 10)); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const { rows } = await pool.query(
    `SELECT cr.id, cr.change_type, cr.status, cr.auto_approved, cr.justification,
            cr.current_manager, cr.new_manager, cr.created_at,
            t.tbh_id, r.name AS new_region_name, c.name AS new_country_name,
            l.level_name AS new_level_name, u.name AS submitted_by_name,
            au.name AS approved_by_name
     FROM change_requests cr
     LEFT JOIN tbh_codes t ON cr.tbh_code_id = t.id
     LEFT JOIN regions r ON cr.new_region_id = r.id
     LEFT JOIN countries c ON cr.new_country_id = c.id
     LEFT JOIN levels l ON cr.new_level_id = l.id
     LEFT JOIN users u ON cr.submitted_by = u.id
     LEFT JOIN users au ON cr.approved_by = au.id
     ${where}
     ORDER BY cr.created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    params
  );
  res.json({ data: rows });
});

router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT cr.*, t.tbh_id, r.name AS new_region_name, c.name AS new_country_name,
            l.level_name AS new_level_name, u.name AS submitted_by_name, au.name AS approved_by_name
     FROM change_requests cr
     LEFT JOIN tbh_codes t ON cr.tbh_code_id = t.id
     LEFT JOIN regions r ON cr.new_region_id = r.id
     LEFT JOIN countries c ON cr.new_country_id = c.id
     LEFT JOIN levels l ON cr.new_level_id = l.id
     LEFT JOIN users u ON cr.submitted_by = u.id
     LEFT JOIN users au ON cr.approved_by = au.id
     WHERE cr.id = $1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Change request not found' });
  res.json({ data: rows[0] });
});

router.post('/', requireAuth, requireRole(...ALL_ROLES), async (req, res) => {
  const {
    tbh_code_id, change_type, current_manager, new_manager, new_region_id, new_country_id,
    new_level_id, is_borrowed_or_repurposed, justification,
  } = req.body;
  if (!change_type) return res.status(400).json({ error: 'change_type is required' });

  // Check auto-approve rule
  const { rows: rules } = await pool.query(
    'SELECT auto_approve FROM change_request_rules WHERE change_type = $1',
    [change_type]
  );
  const autoApprove = rules.length ? rules[0].auto_approve : false;
  const status = autoApprove ? 'Auto-Approved' : 'Pending';

  const { rows } = await pool.query(
    `INSERT INTO change_requests
       (tbh_code_id, change_type, current_manager, new_manager, new_region_id, new_country_id,
        new_level_id, is_borrowed_or_repurposed, justification, status, auto_approved,
        submitted_by, approved_by, approved_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [tbh_code_id ?? null, change_type, current_manager ?? null, new_manager ?? null,
     new_region_id ?? null, new_country_id ?? null, new_level_id ?? null,
     is_borrowed_or_repurposed ?? null, justification ?? null, status, autoApprove,
     req.user.id, autoApprove ? req.user.id : null, autoApprove ? new Date() : null]
  );
  await req.auditLog({ actionType: 'CREATE', resourceType: 'change_request', resourceId: rows[0].id, newValue: rows[0] });
  res.status(201).json({ data: rows[0] });
});

router.post('/:id/approve', requireAuth, requireRole(ROLES.PMO), async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE change_requests
     SET status = 'Approved', approved_by = $1, approved_at = NOW()
     WHERE id = $2 AND status = 'Pending'
     RETURNING *`,
    [req.user.id, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Change request not found or not pending' });
  await req.auditLog({ actionType: 'APPROVE', resourceType: 'change_request', resourceId: rows[0].id, newValue: rows[0] });
  res.json({ data: rows[0] });
});

router.post('/:id/reject', requireAuth, requireRole(ROLES.PMO), async (req, res) => {
  const { rejection_reason } = req.body;
  const { rows } = await pool.query(
    `UPDATE change_requests
     SET status = 'Rejected', rejection_reason = $1
     WHERE id = $2 AND status = 'Pending'
     RETURNING *`,
    [rejection_reason ?? null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Change request not found or not pending' });
  await req.auditLog({ actionType: 'REJECT', resourceType: 'change_request', resourceId: rows[0].id, newValue: rows[0] });
  res.json({ data: rows[0] });
});

module.exports = router;
