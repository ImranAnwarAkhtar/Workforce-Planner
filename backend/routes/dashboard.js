const { Router } = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.get('/summary', requireAuth, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM people WHERE is_active = TRUE)::int            AS total_people,
      (SELECT COUNT(*) FROM projects WHERE is_active = TRUE)::int          AS total_projects,
      (SELECT COUNT(*) FROM allocations)::int                              AS total_allocations,
      (SELECT COUNT(*) FROM hire_requests WHERE status = 'Pending')::int  AS pending_hire_requests,
      (SELECT COUNT(*) FROM change_requests WHERE status = 'Pending')::int AS pending_change_requests,
      (SELECT COUNT(*) FROM tbh_codes WHERE req_status IS NULL OR req_status != 'Filled')::int AS open_tbh_codes
  `);
  res.json({ data: rows[0] });
});

router.get('/capacity', requireAuth, async (req, res) => {
  const { month, region_id } = req.query;
  if (!month) return res.status(400).json({ error: 'month query parameter required (YYYY-MM-DD)' });

  const conditions = [`a.month = $1`];
  const params = [month];
  let i = 2;

  if (region_id) {
    conditions.push(
      `EXISTS (SELECT 1 FROM person_regions pr WHERE pr.person_id = pe.id AND pr.region_id = $${i++})`
    );
    params.push(parseInt(region_id, 10));
  }

  const { rows } = await pool.query(
    `SELECT pe.id, pe.name, pe.contracted_fte,
            COALESCE(SUM(a.fte_value), 0) AS allocated_fte,
            COALESCE(SUM(a.fte_value), 0) / NULLIF(pe.contracted_fte, 0) AS utilisation_ratio,
            d.name AS discipline_name, ct.code AS contract_type_code, ct.colour_hex
     FROM people pe
     LEFT JOIN allocations a ON a.person_id = pe.id AND ${conditions[0]}
     LEFT JOIN disciplines d ON pe.discipline_id = d.id
     LEFT JOIN contract_types ct ON pe.contract_type_id = ct.id
     WHERE pe.is_active = TRUE
       ${region_id ? `AND EXISTS (SELECT 1 FROM person_regions pr WHERE pr.person_id = pe.id AND pr.region_id = $${i - 1})` : ''}
     GROUP BY pe.id, pe.name, pe.contracted_fte, d.name, ct.code, ct.colour_hex
     ORDER BY utilisation_ratio DESC NULLS LAST`,
    params
  );
  res.json({ data: rows });
});

router.get('/gearing', requireAuth, async (req, res) => {
  const { year, region_id } = req.query;
  const conditions = ['pr.is_active = TRUE'];
  const params = [];
  let i = 1;

  if (year)      { conditions.push(`pr.year = $${i++}`);       params.push(parseInt(year, 10)); }
  if (region_id) { conditions.push(`pr.region_id = $${i++}`);  params.push(parseInt(region_id, 10)); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const { rows } = await pool.query(
    `SELECT d.name AS discipline_name, pr.type AS project_type,
            COUNT(DISTINCT pr.id) AS project_count,
            COUNT(DISTINCT pe.id) FILTER (WHERE pe.discipline_id = d.id) AS people_count,
            gc.min_divisor, gc.max_divisor,
            CASE WHEN gc.min_divisor > 0
                 THEN ROUND(COUNT(DISTINCT pr.id)::numeric / gc.min_divisor, 2)
                 ELSE NULL END AS min_headcount_needed,
            CASE WHEN gc.max_divisor > 0
                 THEN ROUND(COUNT(DISTINCT pr.id)::numeric / gc.max_divisor, 2)
                 ELSE NULL END AS max_headcount_needed
     FROM projects pr
     CROSS JOIN disciplines d
     LEFT JOIN gearing_constants gc ON gc.discipline_id = d.id AND gc.project_type = pr.type
     LEFT JOIN people pe ON pe.discipline_id = d.id AND pe.is_active = TRUE
     ${where}
     GROUP BY d.name, pr.type, gc.min_divisor, gc.max_divisor
     ORDER BY d.name ASC, pr.type ASC`,
    params
  );
  res.json({ data: rows });
});

module.exports = router;
