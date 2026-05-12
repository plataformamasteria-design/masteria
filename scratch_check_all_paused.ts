import { db } from './src/lib/db';
import { automationFlowExecutions, automationFlows } from './src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const companyId = 'aca8c096-cf39-49a5-957a-2819b74ab2ab';
  
  const flows = await db.select().from(automationFlows).where(eq(automationFlows.companyId, companyId));
  const flowIds = flows.map(f => f.id);
  
  const pausedExecs = await db.select({
    id: automationFlowExecutions.id,
    flowId: automationFlowExecutions.flowId,
    currentStepId: automationFlowExecutions.currentStepId,
    variables: automationFlowExecutions.variables
  }).from(automationFlowExecutions)
  .where(
    and(
      inArray(automationFlowExecutions.flowId, flowIds),
      eq(automationFlowExecutions.status, 'paused')
    )
  );

  console.log(`Encontradas ${pausedExecs.length} execuções pausadas no total para a empresa.`);
  
  for (const ex of pausedExecs) {
    const vars = ex.variables as any;
    const aiTimeout = parseInt(vars?.vars?._ai_timeout_at || '0');
    const waitTimeout = parseInt(vars?.vars?._wait_timeout_at || '0');
    const t = aiTimeout || waitTimeout;
    const flowName = flows.find(f => f.id === ex.flowId)?.name;
    
    console.log(`- Exec: ${ex.id} | Flow: ${flowName} | Step: ${ex.currentStepId} | Timeout: ${t ? new Date(t).toLocaleString() : 'N/A'}`);
  }

  process.exit(0);
}
import { and } from 'drizzle-orm';

run().catch(console.error);
