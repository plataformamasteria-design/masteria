const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // Find the conversation for this phone
  const res = await client.query(`
    SELECT e.*
    FROM automation_flow_executions e
    JOIN contacts c ON e.contact_id = c.id
    WHERE c.phone = '558892161399' OR c.phone = '8892161399'
    ORDER BY e.started_at DESC 
    LIMIT 2
  `);
  
  await client.end();

  if (res.rows.length === 0) {
    console.log('Nenhuma execução encontrada.');
    return;
  }

  for (const exec of res.rows) {
    console.log(`Execução ID: ${exec.id}`);
    console.log(`Status: ${exec.status}`);
    console.log(`Started: ${exec.started_at}`);
    console.log(`Completed: ${exec.completed_at}`);
    console.log(`Current Node: ${exec.current_node_id}`);
    
    // Mostrando os logs de passos
    if (exec.execution_log && Array.isArray(exec.execution_log.steps)) {
        console.log(`Passos executados: ${exec.execution_log.steps.length}`);
        exec.execution_log.steps.forEach((step, i) => {
            console.log(`  [Passo ${i+1}] Node: ${step.nodeId} | Type: ${step.type} | Action: ${step.action || 'continue'}`);
            if (step.error) console.log(`    ERRO: ${step.error}`);
        });
    } else {
        console.log('Execution log vazio ou inválido:', JSON.stringify(exec.execution_log));
    }
    console.log('--------------------------------------------------');
  }
}

main().catch(console.error);
