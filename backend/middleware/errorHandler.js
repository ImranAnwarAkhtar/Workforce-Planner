function errorHandler(err, req, res, next) {
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  switch (err.code) {
    case '23505':
      return res.status(409).json({ error: 'Resource already exists' });
    case '23503':
      return res.status(400).json({ error: 'Referenced resource does not exist' });
    case '23514':
      return res.status(400).json({ error: 'Value violates a database constraint' });
    case '23502':
      return res.status(400).json({ error: 'Required field is missing' });
    default:
      break;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
}

module.exports = { errorHandler, notFound };
