const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query("SELECT id, company_id, contact_id, connection_id FROM conversations WHERE contact_id = '1141d685-1c51-4a2f-bab4-ad5e3bbb71b8'");
  console.log("Convs:", res.rows);
  const contactsRes = await pool.query("SELECT id, company_id, phone FROM contacts WHERE id = '1141d685-1c51-4a2f-bab4-ad5e3bbb71b8'");
  console.log("Contact:", contactsRes.rows);
  pool.end();
  process.exit(0);
}
main();
