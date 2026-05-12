const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const res = await client.query(`
    SELECT e.id, e.status, e.started_at, e.completed_at, c.phone, e.execution_log
    FROM automation_flow_executions e
    JOIN contacts c ON e.contact_id = c.id
    WHERE e.completed_at >= '2026-05-06T21:30:00Z' AND e.completed_at <= '2026-05-06T21:40:00Z'
  `);
  
  await client.end();

  for (const exec of res.rows) {
    console.log(`\n\nExecução ID: ${exec.id} | Phone: ${exec.phone}`);
    console.log(`Status: ${exec.status}`);
    console.log(`Started: ${exec.started_at}`);
    console.log(`Completed: ${exec.completed_at}`);
    
    if (exec.execution_log && Array.isArray(exec.execution_log.steps)) {
        console.log(`Passos executados: ${exec.execution_log.steps.length}`);
        exec.execution_log.steps.forEach((step, i) => {
            console.log(`  [Passo ${i+1}] Node: ${step.nodeId} | Type: ${step.type} | Action: ${step.action || 'continue'}`);
        });
    }
  }
}

main().catch(console.error);
