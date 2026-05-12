const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const res = await client.query(`
    SELECT cv.id, cv.ai_active, cv.status, ct.phone
    FROM conversations cv
    JOIN contacts ct ON cv.contact_id = ct.id
    WHERE ct.phone = '558892161399' OR ct.phone = '8892161399'
  `);
  
  await client.end();

  console.log(res.rows);
}

main().catch(console.error);
