const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query("SELECT * FROM contacts WHERE id = '1141d685-1c51-4a2f-bab4-ad5e3bbb71b8'");
  console.log("Contact:", res.rows[0]);
  
  const leadRes = await pool.query("SELECT * FROM kanban_leads WHERE contact_id = '1141d685-1c51-4a2f-bab4-ad5e3bbb71b8'");
  console.log("Kanban Lead:", leadRes.rows[0]);
  pool.end();
}
main();
