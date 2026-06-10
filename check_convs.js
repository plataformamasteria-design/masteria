const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
  const sql = `
    SELECT id, status, connection_id, created_at, archived_at
    FROM conversations 
    WHERE contact_id = '1141d685-1c51-4a2f-bab4-ad5e3bbb71b8'
  `;
  const res = await pool.query(sql);
  console.log("Conversations:", res.rows);
  pool.end();
}
main();
