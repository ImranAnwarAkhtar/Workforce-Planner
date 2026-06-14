require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const winston = require('winston');

const { limiter }        = require('./middleware/rateLimiter');
const { auditMiddleware }= require('./middleware/audit');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const projectsRouter      = require('./routes/projects');
const peopleRouter        = require('./routes/people');
const allocationsRouter   = require('./routes/allocations');
const tbhCodesRouter      = require('./routes/tbhCodes');
const gearingRouter       = require('./routes/gearing');
const hireRequestsRouter  = require('./routes/hireRequests');
const changeRequestsRouter= require('./routes/changeRequests');
const dashboardRouter     = require('./routes/dashboard');
const adminRouter         = require('./routes/admin');
const commentsRouter      = require('./routes/comments');
const importsRouter       = require('./routes/imports');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

function wrapAsync(router) {
  router.stack.forEach(layer => {
    if (layer.route) {
      layer.route.stack.forEach(routeLayer => {
        const originalHandle = routeLayer.handle;
        routeLayer.handle = async (req, res, next) => {
          try {
            await originalHandle(req, res, next);
          } catch (err) {
            next(err);
          }
        };
      });
    }
  });
  return router;
}

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));
app.use(limiter);
app.use(auditMiddleware);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/dbcheck', (req, res) => {
  const url = process.env.DATABASE_URL || 'NOT SET';
  const masked = url.replace(/:([^:@]+)@/, ':****@');
  res.json({ DATABASE_URL: masked });
});

app.post('/migrate', async (req, res) => {
  const fs   = require('fs');
  const path = require('path');
  const pool = require('./db/pool');
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const seed   = fs.readFileSync(path.join(__dirname, 'seed.sql'),   'utf8');
    await pool.query(schema);
    await pool.query(seed);
    res.json({ ok: true, message: 'Schema and seed applied successfully.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use('/api/projects',        wrapAsync(projectsRouter));
app.use('/api/people',          wrapAsync(peopleRouter));
app.use('/api/allocations',     wrapAsync(allocationsRouter));
app.use('/api/tbh-codes',       wrapAsync(tbhCodesRouter));
app.use('/api/gearing',         wrapAsync(gearingRouter));
app.use('/api/hire-requests',   wrapAsync(hireRequestsRouter));
app.use('/api/change-requests', wrapAsync(changeRequestsRouter));
app.use('/api/dashboard',       wrapAsync(dashboardRouter));
app.use('/api/admin',           wrapAsync(adminRouter));
app.use('/api/comments',        wrapAsync(commentsRouter));
app.use('/api/imports',         wrapAsync(importsRouter));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

module.exports = app;
