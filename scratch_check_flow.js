const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const res = await client.query(`
    SELECT id, name, execution_logic
    FROM automation_flows
    WHERE id = '4089f957-acf9-4a2d-99fc-1bc1b4376cf2'
  `);
  
  await client.end();

  if (res.rows.length === 0) {
    console.log('Flow não encontrado.');
    return;
  }

  const flow = res.rows[0];
  console.log(`Flow: ${flow.name}`);
  console.log(JSON.stringify(flow.execution_logic, null, 2));
}

main().catch(console.error);
