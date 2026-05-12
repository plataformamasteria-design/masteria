const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query('SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = $1', ['public']);
  console.log(res.rows.map(r => r.tablename));
  await client.end();
}

main().catch(console.error);
