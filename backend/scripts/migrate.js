const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/migrate.js <DATABASE_PUBLIC_URL>');
  process.exit(1);
}

async function run() {
  const client = new Client({
    connectionString: url,
    ssl: false,
  });

  await client.connect();
  console.log('Connected to Railway PostgreSQL');

  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, '..', 'seed.sql'), 'utf8');

  console.log('Running schema.sql...');
  await client.query(schema);
  console.log('Schema applied.');

  console.log('Running seed.sql...');
  await client.query(seed);
  console.log('Seed data applied.');

  await client.end();
  console.log('Done. Database is ready.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
