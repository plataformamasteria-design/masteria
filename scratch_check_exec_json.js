const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const res = await client.query(`
    SELECT execution_log
    FROM automation_flow_executions
    WHERE id = '5705da6f-cf5a-48c4-b044-c6cca13ac364'
  `);
  
  await client.end();

  if (res.rows.length === 0) {
    console.log('Execution not found');
    return;
  }

  console.log(JSON.stringify(res.rows[0].execution_log, null, 2));
}

main().catch(console.error);
