const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'automation_logs' AND indexdef LIKE '%conversation_id%';
  `;
  const res = await pool.query(sql);
  console.log("Indexes on automation_logs:", res.rows);
  pool.end();
}
main();
