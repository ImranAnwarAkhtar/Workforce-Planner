const { Router } = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/rbac');

const WRITE_ROLES = [ROLES.PMO, ROLES.WORKFORCE_PLANNING, ROLES.FINANCE];

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { region_id, funding_year, req_status, limit = 100, offset = 0 } = req.query;
  const conditions = [];
  const params = [];
  let i = 1;

  if (region_id)    { conditions.push(`t.region_id = $${i++}`);    params.push(parseInt(region_id, 10)); }
  if (funding_year) { conditions.push(`t.funding_year = $${i++}`); params.push(parseInt(funding_year, 10)); }
  if (req_status)   { conditions.push(`t.req_status = $${i++}`);   params.push(req_status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const { rows } = await pool.query(
    `SELECT t.*, r.name AS region_name
     FROM tbh_codes t
     LEFT JOIN regions r ON t.region_id = r.id
     ${where}
     ORDER BY t.funding_year DESC NULLS LAST, t.tbh_id ASC
     LIMIT $${i} OFFSET $${i + 1}`,
    params
  );
  res.json({ data: rows });
});

router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.*, r.name AS region_name
     FROM tbh_codes t
     LEFT JOIN regions r ON t.region_id = r.id
     WHERE t.id = $1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'TBH code not found' });
  res.json({ data: rows[0] });
});

router.post('/', requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const {
    tbh_id, old_tbh, funding_year, hire_type, region_id, project_type, legal_entity,
    location_code, cost_centre, job_profile, replaced_emp_name, manager_name,
    target_hire_date, jr_id, req_status, ta_contact, candidate_name,
    estimated_hire_date, ta_status_comments, tbh_description, fp_and_a_notes,
  } = req.body;
  if (!tbh_id) return res.status(400).json({ error: 'tbh_id is required' });

  const { rows } = await pool.query(
    `INSERT INTO tbh_codes
       (tbh_id, old_tbh, funding_year, hire_type, region_id, project_type, legal_entity,
        location_code, cost_centre, job_profile, replaced_emp_name, manager_name,
        target_hire_date, jr_id, req_status, ta_contact, candidate_name,
        estimated_hire_date, ta_status_comments, tbh_description, fp_and_a_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     RETURNING *`,
    [tbh_id, old_tbh ?? null, funding_year ?? null, hire_type ?? null, region_id ?? null,
     project_type ?? null, legal_entity ?? null, location_code ?? null, cost_centre ?? null,
     job_profile ?? null, replaced_emp_name ?? null, manager_name ?? null,
     target_hire_date ?? null, jr_id ?? null, req_status ?? null, ta_contact ?? null,
     candidate_name ?? null, estimated_hire_date ?? null, ta_status_comments ?? null,
     tbh_description ?? null, fp_and_a_notes ?? null]
  );
  await req.auditLog({ actionType: 'CREATE', resourceType: 'tbh_code', resourceId: rows[0].id, newValue: rows[0] });
  res.status(201).json({ data: rows[0] });
});

router.put('/:id', requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const fields = [
    'old_tbh','funding_year','hire_type','region_id','project_type','legal_entity',
    'location_code','cost_centre','job_profile','replaced_emp_name','manager_name',
    'target_hire_date','jr_id','req_status','ta_contact','candidate_name',
    'estimated_hire_date','ta_status_comments','tbh_description','fp_and_a_notes',
  ];
  const sets = [];
  const params = [];
  let i = 1;

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = $${i++}`);
      params.push(req.body[f]);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE tbh_codes SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: 'TBH code not found' });
  await req.auditLog({ actionType: 'UPDATE', resourceType: 'tbh_code', resourceId: rows[0].id, newValue: rows[0] });
  res.json({ data: rows[0] });
});

router.delete('/:id', requireAuth, requireRole(ROLES.PMO), async (req, res) => {
  const { rows } = await pool.query('DELETE FROM tbh_codes WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'TBH code not found' });
  await req.auditLog({ actionType: 'DELETE', resourceType: 'tbh_code', resourceId: rows[0].id });
  res.status(204).end();
});

module.exports = router;
