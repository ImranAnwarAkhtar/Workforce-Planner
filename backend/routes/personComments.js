const { Router } = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// GET /api/person-comments?person_id=X
router.get('/', requireAuth, async (req, res) => {
  const { person_id } = req.query;
  if (!person_id) return res.status(400).json({ error: 'person_id required' });
  const { rows } = await pool.query(
    `SELECT id, person_id, user_name, user_role, body, created_at
     FROM person_comments WHERE person_id = $1 ORDER BY created_at ASC`,
    [parseInt(person_id, 10)]
  );
  res.json({ data: rows });
});

// POST /api/person-comments
// Body: { person_id, body }
router.post('/', requireAuth, async (req, res) => {
  const { person_id, body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body required' });
  if (!person_id)    return res.status(400).json({ error: 'person_id required' });
  const { rows: [person] } = await pool.query('SELECT id FROM people WHERE id = $1', [parseInt(person_id, 10)]);
  if (!person) return res.status(404).json({ error: 'Person not found' });
  const { rows: [row] } = await pool.query(
    `INSERT INTO person_comments (person_id, user_name, user_role, body)
     VALUES ($1, $2, $3, $4) RETURNING id, person_id, user_name, user_role, body, created_at`,
    [parseInt(person_id, 10), req.user.name, req.user.role ?? null, body.trim()]
  );
  res.status(201).json({ data: row });
});

module.exports = router;
