const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const res = await client.query(`
    SELECT m.content, m.sent_at, c.connection_id 
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE m.content = 'Opa'
    ORDER BY m.sent_at DESC LIMIT 1
  `);
  
  await client.end();
  console.log(res.rows);
}

main().catch(console.error);
