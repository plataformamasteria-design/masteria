const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const res = await client.query(`
            WITH last_contact_messages AS (
                SELECT 
                    c.id as conversation_id,
                    m.id as message_id,
                    ct.name as contact_name,
                    ct.phone as contact_phone,
                    conn.config_name as connection_name,
                    m.content as message_content,
                    m.sent_at,
                    EXTRACT(EPOCH FROM (NOW() - m.sent_at)) / 60 as minutes_waiting
                FROM conversations c
                JOIN contacts ct ON ct.id = c.contact_id
                JOIN connections conn ON conn.id = c.connection_id
                JOIN messages m ON m.conversation_id = c.id
                WHERE c.ai_active = true
                AND m.sender_type = 'CONTACT'
                AND m.sent_at >= NOW() - INTERVAL '24 hours'
                AND m.sent_at <= NOW() - INTERVAL '45 seconds'
                AND m.sent_at = (
                    SELECT MAX(m2.sent_at) 
                    FROM messages m2 
                    WHERE m2.conversation_id = c.id
                )
            )
            SELECT * FROM last_contact_messages
            WHERE NOT EXISTS (
                SELECT 1 FROM messages m3 
                WHERE m3.conversation_id = last_contact_messages.conversation_id 
                AND m3.sender_type IN ('AI', 'USER', 'SYSTEM')
                AND m3.sent_at > last_contact_messages.sent_at
            )
            ORDER BY sent_at ASC
            LIMIT 50
  `);
  
  await client.end();

  console.log('Pending messages:', res.rows.length);
  for (const row of res.rows) {
      console.log(`- Phone: ${row.contact_phone} | Content: ${row.message_content} | Waiting: ${row.minutes_waiting}`);
  }
}

main().catch(console.error);
