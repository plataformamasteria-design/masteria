const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const res = await client.query(`
    SELECT m.id, m.content, m.sender_type, m.status, m.sent_at 
    FROM messages m
    JOIN conversations cv ON m.conversation_id = cv.id
    JOIN contacts c ON cv.contact_id = c.id
    WHERE (c.phone = '558892161399' OR c.phone = '8892161399')
    AND m.content = 'Boa noite'
    ORDER BY m.sent_at DESC 
    LIMIT 10
  `);
  
  await client.end();

  for (const msg of res.rows) {
    console.log(`[${msg.sent_at}] ${msg.sender_type} - Status: ${msg.status} - ${msg.content}`);
  }
}

main().catch(console.error);
