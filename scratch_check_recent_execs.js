const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const res = await client.query(`
    SELECT e.id, e.status, e.started_at, e.completed_at, c.connection_id 
    FROM automation_flow_executions e
    JOIN conversations c ON e.conversation_id = c.id
    WHERE e.started_at >= NOW() - INTERVAL '60 minutes'
    ORDER BY e.started_at DESC
  `);
  
  await client.end();
  
  console.log(res.rows);
}

main().catch(console.error);
