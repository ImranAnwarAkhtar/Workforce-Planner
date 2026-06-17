const { Router } = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole, WRITER_ROLES, ROLES } = require('../middleware/rbac');

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { region_id, year, status, type, is_active = 'true', planning_cycle_id, limit = 100, offset = 0 } = req.query;
  const conditions = [];
  const params = [];
  let i = 1;

  if (is_active !== 'all') {
    conditions.push(`p.is_active = $${i++}`);
    params.push(is_active !== 'false');
  }
  if (region_id)         { conditions.push(`p.region_id = $${i++}`);          params.push(parseInt(region_id, 10)); }
  if (year)              { conditions.push(`p.year = $${i++}`);                params.push(parseInt(year, 10)); }
  if (status)            { conditions.push(`p.status = $${i++}`);              params.push(status); }
  if (type)              { conditions.push(`p.type = $${i++}`);                params.push(type); }
  if (planning_cycle_id) { conditions.push(`p.planning_cycle_id = $${i++}`);   params.push(parseInt(planning_cycle_id, 10)); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.type, p.status, p.weight, p.region_id, p.country_id,
            p.metro, p.phase_code, p.year, p.is_active, p.created_at, p.updated_at,
            r.name AS region_name, c.name AS country_name
     FROM projects p
     LEFT JOIN regions r ON p.region_id = r.id
     LEFT JOIN countries c ON p.country_id = c.id
     ${where}
     ORDER BY p.year DESC NULLS LAST, p.name ASC
     LIMIT $${i} OFFSET $${i + 1}`,
    params
  );
  res.json({ data: rows });
});

router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, r.name AS region_name, c.name AS country_name, u.name AS created_by_name
     FROM projects p
     LEFT JOIN regions r ON p.region_id = r.id
     LEFT JOIN countries c ON p.country_id = c.id
     LEFT JOIN users u ON p.created_by = u.id
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Project not found' });
  res.json({ data: rows[0] });
});

router.post('/', requireAuth, requireRole(...WRITER_ROLES), async (req, res) => {
  const { name, type, status, weight = 1.0, region_id, country_id, metro, phase_code, year, planning_cycle_id } = req.body;
  if (!name || !type || !status) return res.status(400).json({ error: 'name, type, and status are required' });

  const { rows } = await pool.query(
    `INSERT INTO projects (name, type, status, weight, region_id, country_id, metro, phase_code, year, planning_cycle_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [name, type, status, weight, region_id ?? null, country_id ?? null, metro ?? null, phase_code ?? null, year ?? null, planning_cycle_id ?? null, req.user.id]
  );
  await req.auditLog({ actionType: 'CREATE', resourceType: 'project', resourceId: rows[0].id, newValue: rows[0] });
  res.status(201).json({ data: rows[0] });
});

router.put('/:id', requireAuth, requireRole(...WRITER_ROLES), async (req, res) => {
  const { name, type, status, weight, region_id, country_id, metro, phase_code, year, is_active, planning_cycle_id } = req.body;
  const sets = [];
  const params = [];
  let i = 1;

  if (name              !== undefined) { sets.push(`name = $${i++}`);              params.push(name); }
  if (type              !== undefined) { sets.push(`type = $${i++}`);              params.push(type); }
  if (status            !== undefined) { sets.push(`status = $${i++}`);            params.push(status); }
  if (weight            !== undefined) { sets.push(`weight = $${i++}`);            params.push(weight); }
  if (region_id         !== undefined) { sets.push(`region_id = $${i++}`);         params.push(region_id); }
  if (country_id        !== undefined) { sets.push(`country_id = $${i++}`);        params.push(country_id); }
  if (metro             !== undefined) { sets.push(`metro = $${i++}`);             params.push(metro); }
  if (phase_code        !== undefined) { sets.push(`phase_code = $${i++}`);        params.push(phase_code); }
  if (year              !== undefined) { sets.push(`year = $${i++}`);              params.push(year); }
  if (is_active         !== undefined) { sets.push(`is_active = $${i++}`);         params.push(is_active); }
  if (planning_cycle_id !== undefined) { sets.push(`planning_cycle_id = $${i++}`); params.push(planning_cycle_id); }

  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE projects SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: 'Project not found' });
  await req.auditLog({ actionType: 'UPDATE', resourceType: 'project', resourceId: rows[0].id, newValue: rows[0] });
  res.json({ data: rows[0] });
});

router.delete('/:id', requireAuth, requireRole(ROLES.PMO), async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE projects SET is_active = FALSE WHERE id = $1 RETURNING id',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Project not found' });
  await req.auditLog({ actionType: 'DELETE', resourceType: 'project', resourceId: rows[0].id });
  res.status(204).end();
});

module.exports = router;
