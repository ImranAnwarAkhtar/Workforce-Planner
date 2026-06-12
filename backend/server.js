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

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));
app.use(limiter);
app.use(auditMiddleware);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/projects',       projectsRouter);
app.use('/api/people',         peopleRouter);
app.use('/api/allocations',    allocationsRouter);
app.use('/api/tbh-codes',      tbhCodesRouter);
app.use('/api/gearing',        gearingRouter);
app.use('/api/hire-requests',  hireRequestsRouter);
app.use('/api/change-requests',changeRequestsRouter);
app.use('/api/dashboard',      dashboardRouter);
app.use('/api/admin',          adminRouter);
app.use('/api/comments',       commentsRouter);
app.use('/api/imports',        importsRouter);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

module.exports = app;
