require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.PG_URL || process.env.DATABASE_URL;
const isInternal = connectionString && connectionString.includes('.railway.internal');

const pool = new Pool({
  connectionString,
  ssl: isInternal ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error', err);
});

module.exports = pool;
