const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = `
    SELECT pid, wait_event_type, wait_event, state, query
    FROM pg_stat_activity
    WHERE state = 'active' AND pid <> pg_backend_pid();
  `;
  const res = await pool.query(sql);
  console.log("Active Queries:", res.rows);
  pool.end();
}
main();
