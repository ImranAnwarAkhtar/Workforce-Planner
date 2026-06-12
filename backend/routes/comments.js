const { Router } = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole, WRITER_ROLES } = require('../middleware/rbac');

const router = Router();

const VALID_RESOURCE_TYPES = new Set([
  'project', 'person', 'allocation', 'hire_request', 'change_request', 'tbh_code',
]);

// GET /api/comments/:resourceType/:resourceId
// Returns the audit trail for a specific resource, serving as its comment/history feed.
router.get('/:resourceType/:resourceId', requireAuth, async (req, res) => {
  const { resourceType, resourceId } = req.params;
  if (!VALID_RESOURCE_TYPES.has(resourceType)) {
    return res.status(400).json({ error: `Invalid resource type. Valid types: ${[...VALID_RESOURCE_TYPES].join(', ')}` });
  }
  const { rows } = await pool.query(
    `SELECT id, timestamp, user_name, user_role, action_type, old_value, new_value
     FROM audit_log
     WHERE resource_type = $1 AND resource_id = $2
     ORDER BY timestamp DESC`,
    [resourceType, parseInt(resourceId, 10)]
  );
  res.json({ data: rows });
});

// PATCH /api/comments/allocations/:id/flag
// Set or clear the flagged_for_review status and flag_reason on an allocation.
router.patch('/allocations/:id/flag', requireAuth, requireRole(...WRITER_ROLES), async (req, res) => {
  const { flagged_for_review, flag_reason } = req.body;
  if (flagged_for_review === undefined) {
    return res.status(400).json({ error: 'flagged_for_review is required' });
  }
  const { rows } = await pool.query(
    `UPDATE allocations
     SET flagged_for_review = $1, flag_reason = $2
     WHERE id = $3
     RETURNING id, person_id, project_id, month, flagged_for_review, flag_reason`,
    [flagged_for_review, flag_reason ?? null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Allocation not found' });
  await req.auditLog({
    actionType: flagged_for_review ? 'FLAG' : 'UNFLAG',
    resourceType: 'allocation',
    resourceId: rows[0].id,
    newValue: { flagged_for_review, flag_reason },
  });
  res.json({ data: rows[0] });
});

// PATCH /api/comments/tbh-codes/:id/notes
// Update the TA status comments and FP&A notes on a TBH code.
router.patch('/tbh-codes/:id/notes', requireAuth, requireRole(...WRITER_ROLES), async (req, res) => {
  const { ta_status_comments, fp_and_a_notes } = req.body;
  const sets = [];
  const params = [];
  let i = 1;

  if (ta_status_comments !== undefined) { sets.push(`ta_status_comments = $${i++}`); params.push(ta_status_comments); }
  if (fp_and_a_notes     !== undefined) { sets.push(`fp_and_a_notes = $${i++}`);     params.push(fp_and_a_notes); }

  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);

  const { rows } = await pool.query(
    `UPDATE tbh_codes SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, tbh_id, ta_status_comments, fp_and_a_notes`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: 'TBH code not found' });
  await req.auditLog({ actionType: 'UPDATE_NOTES', resourceType: 'tbh_code', resourceId: rows[0].id, newValue: rows[0] });
  res.json({ data: rows[0] });
});

module.exports = router;
