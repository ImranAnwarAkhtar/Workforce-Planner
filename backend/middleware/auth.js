const pool = require('../db/pool');

async function requireAuth(req, res, next) {
  req.user = {
    id: 1,
    name: 'Demo User',
    email: 'demo@equinix.com',
    role: 'Workforce Planning',
  };
  return next();
}

module.exports = { requireAuth };
