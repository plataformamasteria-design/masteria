const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
  // Verificar schema da tabela connections
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'connections' ORDER BY ordinal_position LIMIT 15`
  );
  console.log('connections columns:', cols.rows.map(r => r.column_name).join(', '));

  // Pegar amostra de mensagens de conversas baileys
  const res = await client.query(`
    SELECT m.sender_type, LEFT(m.content, 45) as content, m.sent_at
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    JOIN connections cn ON cn.id = c.connection_id
    WHERE cn.connection_type = 'baileys'
    ORDER BY m.sent_at DESC
    LIMIT 12
  `);
  console.log('\n=== Latest Baileys Messages (DB raw) ===');
  res.rows.forEach(r => console.log(`  [${r.sender_type}] ${r.content?.substring(0,45)}`));

  await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
