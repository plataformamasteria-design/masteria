const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log('Adding text column...');
  await client.query('ALTER TABLE baileys_messages ADD COLUMN IF NOT EXISTS text TEXT');
  
  console.log('Adding conversation_id column...');
  await client.query('ALTER TABLE baileys_messages ADD COLUMN IF NOT EXISTS conversation_id TEXT');
  
  console.log('Creating index...');
  await client.query('CREATE INDEX IF NOT EXISTS idx_baileys_msgs_conv_timestamp ON baileys_messages (conversation_id, timestamp DESC)');
  
  console.log('✅ Migration OK');
  await client.end();
}

run().catch(e => { console.error('Migration failed:', e); process.exit(1); });
