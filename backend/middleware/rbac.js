const ROLES = Object.freeze({
  PMO:               'PMO',
  DEPARTMENT_LEAD:   'Department Lead',
  FUNCTION_LEAD:     'Function Lead',
  WORKFORCE_PLANNING:'Workforce Planning',
  HEAD_OF_COMMERCIAL:'Head of Commercial',
  HEAD_OF_DEPARTMENT:'Head of Department',
  EVP:               'EVP',
  FINANCE:           'Finance',
});

const ALL_ROLES = Object.values(ROLES);

// Roles that can write people, projects, and allocations
const WRITER_ROLES = [
  ROLES.PMO,
  ROLES.WORKFORCE_PLANNING,
  ROLES.DEPARTMENT_LEAD,
  ROLES.FUNCTION_LEAD,
  ROLES.HEAD_OF_DEPARTMENT,
];

// Roles that can approve hire requests at later stages
const SENIOR_ROLES = [
  ROLES.PMO,
  ROLES.HEAD_OF_COMMERCIAL,
  ROLES.HEAD_OF_DEPARTMENT,
  ROLES.EVP,
];

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { ROLES, ALL_ROLES, WRITER_ROLES, SENIOR_ROLES, requireRole };
