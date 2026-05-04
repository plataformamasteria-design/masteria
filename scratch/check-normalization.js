const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
  // Simular o que a API faz: pegar connectionType via join
  const convId = 'ee1a8869-41c8-4f5a-b366-54d4cbf2a4b4'; // 552139553532 conversa

  const res = await client.query(`
    SELECT c.id, cn.connection_type
    FROM conversations c
    LEFT JOIN connections cn ON cn.id = c.connection_id
    WHERE c.id = $1
  `, [convId]);

  console.log('Conv + connectionType:', res.rows[0]);

  // Verificar API normalization result
  const msgs = await client.query(`
    SELECT sender_type, LEFT(content, 40) as content
    FROM messages 
    WHERE conversation_id = $1
    ORDER BY sent_at DESC LIMIT 6
  `, [convId]);

  console.log('\nDB senderTypes (raw):');
  msgs.rows.forEach(r => {
    const normalized = r.sender_type === 'AGENT' ? 'CONTACT' 
                     : r.sender_type === 'CONTACT' ? 'AGENT' 
                     : r.sender_type;
    console.log(`  DB:[${r.sender_type}] → API:[${normalized}] | ${r.content}`);
  });

  await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
