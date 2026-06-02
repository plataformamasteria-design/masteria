import { Client } from 'pg';

async function run() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require"
  });
  await client.connect();
  const res = await client.query("SELECT id, config_name, status, phone FROM connections");
  console.log('All connections:', res.rows.map(r => ({ id: r.id, name: r.config_name, status: r.status })));
  await client.end();
}

run();
