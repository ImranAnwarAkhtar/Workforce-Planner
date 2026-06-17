const { Router } = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole, WRITER_ROLES, ROLES } = require('../middleware/rbac');

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { person_id, project_id, month_from, month_to, flagged, planning_cycle_id, limit = 200, offset = 0 } = req.query;
  const conditions = [];
  const params = [];
  let i = 1;

  if (person_id)         { conditions.push(`a.person_id = $${i++}`);          params.push(parseInt(person_id, 10)); }
  if (project_id)        { conditions.push(`a.project_id = $${i++}`);         params.push(parseInt(project_id, 10)); }
  if (month_from)        { conditions.push(`a.month >= $${i++}`);             params.push(month_from); }
  if (month_to)          { conditions.push(`a.month <= $${i++}`);             params.push(month_to); }
  if (planning_cycle_id) { conditions.push(`a.planning_cycle_id = $${i++}`);  params.push(parseInt(planning_cycle_id, 10)); }
  if (flagged === 'true') { conditions.push(`a.flagged_for_review = TRUE`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const { rows } = await pool.query(
    `SELECT a.id, a.person_id, a.project_id, a.month, a.fte_value, a.is_billable,
            a.flagged_for_review, a.flag_reason, a.updated_at,
            pe.name AS person_name,
            pr.name AS project_name, pr.type AS project_type,
            ct.code AS contract_type_code, ct.colour_hex
     FROM allocations a
     JOIN people pe ON a.person_id = pe.id
     JOIN projects pr ON a.project_id = pr.id
     LEFT JOIN contract_types ct ON pe.contract_type_id = ct.id
     ${where}
     ORDER BY a.month DESC, pe.name ASC
     LIMIT $${i} OFFSET $${i + 1}`,
    params
  );
  res.json({ data: rows });
});

router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*, pe.name AS person_name, pr.name AS project_name, pr.type AS project_type
     FROM allocations a
     JOIN people pe ON a.person_id = pe.id
     JOIN projects pr ON a.project_id = pr.id
     WHERE a.id = $1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Allocation not found' });
  res.json({ data: rows[0] });
});

router.post('/', requireAuth, requireRole(...WRITER_ROLES), async (req, res) => {
  const { person_id, project_id, month, fte_value = 0, is_billable = true } = req.body;
  if (!person_id || !project_id || !month) {
    return res.status(400).json({ error: 'person_id, project_id, and month are required' });
  }
  const { rows } = await pool.query(
    `INSERT INTO allocations (person_id, project_id, month, fte_value, is_billable, planning_cycle_id, created_by)
     VALUES ($1,$2,$3,$4,$5,(SELECT planning_cycle_id FROM projects WHERE id = $2),$6)
     ON CONFLICT (person_id, project_id, month) DO UPDATE
       SET fte_value = EXCLUDED.fte_value, is_billable = EXCLUDED.is_billable, updated_at = NOW()
     RETURNING *`,
    [person_id, project_id, month, fte_value, is_billable, req.user.id]
  );
  await req.auditLog({ actionType: 'UPSERT', resourceType: 'allocation', resourceId: rows[0].id, newValue: rows[0] });
  res.status(201).json({ data: rows[0] });
});

router.put('/:id', requireAuth, requireRole(...WRITER_ROLES), async (req, res) => {
  const { fte_value, is_billable, flagged_for_review, flag_reason } = req.body;
  const sets = [];
  const params = [];
  let i = 1;

  if (fte_value          !== undefined) { sets.push(`fte_value = $${i++}`);          params.push(fte_value); }
  if (is_billable        !== undefined) { sets.push(`is_billable = $${i++}`);        params.push(is_billable); }
  if (flagged_for_review !== undefined) { sets.push(`flagged_for_review = $${i++}`); params.push(flagged_for_review); }
  if (flag_reason        !== undefined) { sets.push(`flag_reason = $${i++}`);        params.push(flag_reason); }

  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE allocations SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: 'Allocation not found' });
  await req.auditLog({ actionType: 'UPDATE', resourceType: 'allocation', resourceId: rows[0].id, newValue: rows[0] });
  res.json({ data: rows[0] });
});

router.delete('/:id', requireAuth, requireRole(ROLES.PMO, ROLES.WORKFORCE_PLANNING), async (req, res) => {
  const { rows } = await pool.query('DELETE FROM allocations WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Allocation not found' });
  await req.auditLog({ actionType: 'DELETE', resourceType: 'allocation', resourceId: rows[0].id });
  res.status(204).end();
});

module.exports = router;
