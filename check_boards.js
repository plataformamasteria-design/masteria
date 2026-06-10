const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = `
    SELECT id, name FROM kanban_boards WHERE id IN ('b8856169-d5ee-40ea-a876-20c8b46234cf', '72e90627-1f9c-493e-a243-71ef668c021a', '6bccc06c-4eb2-41e1-9c9d-5a133c267418')
  `;
  const res = await pool.query(sql);
  console.log("Boards:", res.rows);
  pool.end();
}
main();
