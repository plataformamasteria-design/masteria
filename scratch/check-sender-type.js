const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
  const res = await client.query(
    'SELECT m.id, m.sender_type, LEFT(m.content, 40) as content, m.sent_at ' +
    'FROM messages m ' +
    'WHERE m.conversation_id = $1 ' +
    'ORDER BY m.sent_at DESC LIMIT 12',
    ['ee1a8869-41c8-4f5a-b366-54d4cbf2a4b4']
  );
  res.rows.forEach(r => console.log(`[${r.sender_type}] ${r.sent_at?.toLocaleTimeString()} | ${r.content}`));
  await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
