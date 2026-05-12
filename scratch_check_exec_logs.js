const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const res = await client.query(`
    SELECT *
    FROM automation_execution_logs
    WHERE execution_id = '5705da6f-cf5a-48c4-b044-c6cca13ac364'
    ORDER BY created_at ASC
  `);
  
  await client.end();

  if (res.rows.length === 0) {
    console.log('Logs not found');
    return;
  }

  for (const log of res.rows) {
      console.log(`[${log.created_at}] Node: ${log.node_id} | Status: ${log.status} | Details: ${JSON.stringify(log.details)}`);
  }
}

main().catch(console.error);
