const pool = require('../db/pool');

async function requireAuth(req, res, next) {
  req.user = {
    id: null,
    name:  process.env.DEMO_USER_NAME  || 'Demo User',
    email: process.env.DEMO_USER_EMAIL || 'demo@equinix.com',
    role:  'Workforce Planning',
  };
  return next();
}

module.exports = { requireAuth };
