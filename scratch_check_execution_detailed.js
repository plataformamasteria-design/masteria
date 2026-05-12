const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const res = await client.query(`
    SELECT e.*, c.phone
    FROM automation_flow_executions e
    JOIN contacts c ON e.contact_id = c.id
    ORDER BY e.started_at DESC 
    LIMIT 5
  `);
  
  await client.end();

  for (const exec of res.rows) {
    console.log(`\n\nExecução ID: ${exec.id} | Phone: ${exec.phone}`);
    console.log(`Status: ${exec.status}`);
    console.log(`Started: ${exec.started_at}`);
    
    if (exec.execution_log && Array.isArray(exec.execution_log.steps)) {
        console.log(`Passos executados: ${exec.execution_log.steps.length}`);
        exec.execution_log.steps.forEach((step, i) => {
            console.log(`  [Passo ${i+1}] Node: ${step.nodeId} | Type: ${step.type} | Action: ${step.action || 'continue'}`);
            if (step.error) console.log(`    ERRO: ${step.error}`);
        });
    }
  }
}

main().catch(console.error);
