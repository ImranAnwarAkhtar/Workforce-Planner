const jwksRsa = require('jwks-rsa');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const jwksClient = jwksRsa({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000,
  rateLimit: true,
});

function getKey(header, callback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verifyJwt(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
        algorithms: ['RS256'],
      },
      (err, decoded) => (err ? reject(err) : resolve(decoded))
    );
  });
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = await verifyJwt(token);
    const { rows } = await pool.query(
      'SELECT id, name, email, role FROM users WHERE auth0_id = $1 AND is_active = TRUE',
      [decoded.sub]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found or inactive' });
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(err);
  }
}

module.exports = { requireAuth };
