const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const queries = [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_logs_conv_id ON automation_logs (conversation_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conv_id ON messages (conversation_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_logs_conv_id ON security_logs (conversation_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_calls_conv_id ON voice_calls (conversation_id)'
  ];
  for (const q of queries) {
    console.log("Running:", q);
    await pool.query(q);
  }
  console.log("Indexes created.");
  pool.end();
}
main();
