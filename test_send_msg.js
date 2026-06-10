const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = `
    SELECT c.id, c.company_id, c.connection_id, cont.phone, conn.connection_type
    FROM conversations c
    LEFT JOIN contacts cont ON c.contact_id = cont.id
    LEFT JOIN connections conn ON c.connection_id = conn.id
    WHERE c.id = '1ea936d6-8d92-4f8e-a15c-5cdbb637a338' AND c.company_id = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'
    LIMIT 1;
  `;
  const res = await pool.query(sql);
  console.log("Result:", res.rows);
  pool.end();
}
main();
