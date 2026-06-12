require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Railway database.');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const seed   = fs.readFileSync(path.join(__dirname, 'seed.sql'),   'utf8');

  console.log('Running schema.sql...');
  await client.query(schema);
  console.log('schema.sql done.');

  console.log('Running seed.sql...');
  await client.query(seed);
  console.log('seed.sql done.');

  await client.end();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  console.error('Error code:', err.code);
  console.error('Full error:', err);
  process.exit(1);
});
