const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log(res.rows.map(r => r.table_name).join(', '));
  await pool.end();
}
run().catch(console.error);
