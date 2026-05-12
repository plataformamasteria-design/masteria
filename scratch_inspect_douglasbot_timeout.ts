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
  
  console.log(`Flow Logic Nodes:`);
  const logic = flow?.executionLogic as any;
  if (logic && logic.nodes) {
    for (const node of logic.nodes) {
      if (node.id.includes('follow_up') || node.id.includes('ai_agent')) {
        console.log(`Node: ${node.id}`);
        console.log(`- Timeout config: ${node.data?.timeoutMinutes || node.data?.delayMinutes || 'not found in root data'}`);
        console.log(JSON.stringify(node.data, null, 2));
      }
    }
  }

  const pausedExecs = await db.query.automationFlowExecutions.findMany({
    where: eq(automationFlowExecutions.flowId, flowId),
  });

  const activePaused = pausedExecs.filter(e => e.status === 'paused');
  
  if (activePaused.length > 0) {
    for (let i = 0; i < Math.min(3, activePaused.length); i++) {
      const ex = activePaused[i];
      const vars = ex.variables as any;
      const aiTime = vars?.vars?._ai_timeout_at;
      console.log(`\nExecução ${ex.id} no passo ${ex.currentStepId}`);
      console.log(`_ai_timeout_at: ${aiTime} (${new Date(parseInt(aiTime || '0')).toLocaleString()})`);
    }
  }

  process.exit(0);
}

run().catch(console.error);
