import { db } from './src/lib/db';
import { automationFlows, automationFlowExecutions } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const flowId = '0e70099f-aa1a-4078-98c3-d137bdd22cb0';
  
  const flow = await db.query.automationFlows.findFirst({
    where: eq(automationFlows.id, flowId)
  });
  
  if (!flow) {
    console.log('Flow não encontrado.');
    process.exit(0);
  }
  
  console.log(`Flow Logic para ${flow.name}:`);
  const logic = flow.executionLogic as any;
  if (logic && logic.nodes) {
    for (const node of logic.nodes) {
      if (node.type === 'wait' || node.type === 'delay') {
        console.log(`Node de espera encontrado: ID ${node.id}`);
        console.log(JSON.stringify(node.data, null, 2));
      }
    }
  }

  const pausedExecs = await db.query.automationFlowExecutions.findMany({
    where: eq(automationFlowExecutions.flowId, flowId),
  });

  const activePaused = pausedExecs.filter(e => e.status === 'paused');
  console.log(`\nEncontradas ${activePaused.length} execuções pausadas para este flow.`);
  
  if (activePaused.length > 0) {
    for (let i = 0; i < Math.min(3, activePaused.length); i++) {
      const ex = activePaused[i];
      const vars = ex.variables as any;
      console.log(`\nExemplo de execução pausada ${ex.id} no passo ${ex.currentStepId}`);
      console.log(`Wait Timeout: ${vars?.vars?._wait_timeout_at} (${new Date(parseInt(vars?.vars?._wait_timeout_at || '0')).toLocaleString()})`);
    }
  }

  process.exit(0);
}

run().catch(console.error);
