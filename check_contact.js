const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query("SELECT id, name, phone, company_id FROM contacts WHERE name ILIKE '%Deivid%' OR phone ILIKE '%88920008007%'");
  console.log("Found contacts:", res.rows);
  
  if (res.rows.length > 0) {
    for (const contact of res.rows) {
        const convs = await pool.query("SELECT id, contact_id, connection_id FROM conversations WHERE contact_id = $1", [contact.id]);
        console.log(`Conversations for contact ${contact.id}:`, convs.rows);
    }
  }
  pool.end();
  process.exit(0);
}
main();
