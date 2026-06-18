const pool = require('../db/pool');

// Roles permitted to edit projects/allocations/people in each planning cycle stage
const STAGE_EDIT_ROLES = {
  draft:        ['PMO'],
  active:       ['PMO', 'Workforce Planning', 'Department Lead', 'Function Lead', 'Head of Department'],
  under_review: ['PMO', 'Workforce Planning', 'Department Lead', 'Function Lead', 'Head of Department', 'Head of Commercial'],
  approved:     [],  // locked — approval actions only
  closed:       [],  // fully locked
};

const STAGE_LABELS = {
  draft:        'Stage 1: Admin Setup',
  active:       'Stage 2: Planning',
  under_review: 'Stage 3: Regional Review',
  approved:     'Stage 4: Global Approval',
  closed:       'Closed',
};

/**
 * Looks up a cycle's stage and checks whether req.user may edit.
 * Returns true if allowed; sends 403 + returns false if denied.
 */
async function guardCycleEdit(cycleId, req, res) {
  if (!cycleId) return true;
  const { rows } = await pool.query(
    'SELECT status FROM planning_cycles WHERE id = $1',
    [parseInt(cycleId, 10)]
  );
  if (!rows.length) return true;
  const status = rows[0].status;
  const allowed = STAGE_EDIT_ROLES[status] ?? [];
  if (!allowed.includes(req.user?.role)) {
    res.status(403).json({
      error: `This planning cycle is in "${STAGE_LABELS[status] ?? status}" — your role (${req.user?.role ?? 'unknown'}) cannot make changes at this stage.`,
      cycle_status: status,
    });
    return false;
  }
  return true;
}

module.exports = { guardCycleEdit, STAGE_EDIT_ROLES, STAGE_LABELS };
