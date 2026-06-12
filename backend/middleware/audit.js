const pool = require('../db/pool');

function auditMiddleware(req, res, next) {
  req.auditLog = ({ actionType, resourceType, resourceId = null, oldValue = null, newValue = null }) =>
    pool.query(
      `INSERT INTO audit_log
         (user_id, user_name, user_role, action_type, resource_type, resource_id,
          old_value, new_value, ip_address, user_agent, session_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        req.user?.id    ?? null,
        req.user?.name  ?? null,
        req.user?.role  ?? null,
        actionType,
        resourceType,
        resourceId,
        oldValue  ? JSON.stringify(oldValue)  : null,
        newValue  ? JSON.stringify(newValue)  : null,
        req.ip    ?? null,
        req.headers['user-agent'] ?? null,
        req.headers['x-session-id'] ?? null,
      ]
    );
  next();
}

module.exports = { auditMiddleware };
