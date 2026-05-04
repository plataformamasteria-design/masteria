const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`
      SELECT m.id, m.content, m.sender_type, m.status, m.provider_message_id, m.sent_at
      FROM messages m
      WHERE m.sender_type = 'AI'
      ORDER BY m.sent_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${res.rows.length} recent AI messages.`);
    res.rows.forEach(r => {
      console.log(`[${r.sent_at}] [${r.status}] ${r.content.substring(0, 100)}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
