require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const winston = require('winston');

const { limiter }        = require('./middleware/rateLimiter');
const { auditMiddleware }= require('./middleware/audit');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const planningCyclesRouter= require('./routes/planningCycles');
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
const headcountRouter     = require('./routes/headcount');

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

// Run idempotent startup migrations
const pool = require('./db/pool');
pool.query(`
  ALTER TABLE people ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE people ADD COLUMN IF NOT EXISTS planning_year INTEGER;
  UPDATE levels SET level_name = 'Contingent' WHERE short_code = 'Cons' AND level_name = 'Consultant';
`).catch(err => logger.error('Startup migration failed', { error: err.message }));

// Planning cycles migration
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS planning_cycles (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(255) NOT NULL,
        start_date DATE NOT NULL,
        end_date   DATE NOT NULL,
        status     VARCHAR(50) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','active','under_review','approved','closed')),
        is_active  BOOLEAN NOT NULL DEFAULT true,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE projects    ADD COLUMN IF NOT EXISTS planning_cycle_id INTEGER REFERENCES planning_cycles(id);
      ALTER TABLE projects    ADD COLUMN IF NOT EXISTS source_project_id INTEGER REFERENCES projects(id);
      ALTER TABLE allocations ADD COLUMN IF NOT EXISTS planning_cycle_id INTEGER REFERENCES planning_cycles(id);
    `);

    // Seed the two initial cycles (idempotent — only inserts if not already present)
    await pool.query(`
      INSERT INTO planning_cycles (name, start_date, end_date, status)
      SELECT '2026', '2026-01-01', '2026-09-30', 'active'
      WHERE NOT EXISTS (SELECT 1 FROM planning_cycles WHERE name = '2026');

      INSERT INTO planning_cycles (name, start_date, end_date, status)
      SELECT '2027', '2026-10-01', '2027-03-31', 'draft'
      WHERE NOT EXISTS (SELECT 1 FROM planning_cycles WHERE name = '2027');
    `);

    // Assign all unassigned projects + allocations to the 2026 cycle
    await pool.query(`
      UPDATE projects SET planning_cycle_id = (
        SELECT id FROM planning_cycles WHERE name = '2026' LIMIT 1
      ) WHERE planning_cycle_id IS NULL;

      UPDATE allocations SET planning_cycle_id = (
        SELECT id FROM planning_cycles WHERE name = '2026' LIMIT 1
      ) WHERE planning_cycle_id IS NULL;
    `);

    logger.info('Planning cycles migration complete');
  } catch (err) {
    logger.error('Planning cycles migration failed', { error: err.message });
  }
})();

app.use('/api/planning-cycles', wrapAsync(planningCyclesRouter));
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
app.use('/api/headcount',       wrapAsync(headcountRouter));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

module.exports = app;
