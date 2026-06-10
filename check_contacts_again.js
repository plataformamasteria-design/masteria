const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
  const sql = `SELECT id, name, phone FROM contacts WHERE company_id = $1 AND phone ILIKE '%88920008007%'`;
  const res = await pool.query(sql, [companyId]);
  console.log("Contacts:", res.rows);
  pool.end();
}
main();
