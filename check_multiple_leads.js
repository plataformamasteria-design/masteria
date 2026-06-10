const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
  
  const sql = `
    SELECT kl.id, kl.title, c.phone, c.name 
    FROM kanban_leads kl
    JOIN contacts c ON kl.contact_id = c.id
    WHERE c.phone ILIKE '%88920008007%' AND kl.company_id = $1
  `;
  const res = await pool.query(sql, [companyId]);
  console.log("Leads found for this phone in the company:", res.rows);
  
  pool.end();
}
main();
