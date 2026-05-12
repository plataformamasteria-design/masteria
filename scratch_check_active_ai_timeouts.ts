import { db } from './src/lib/db';
import { automationFlowExecutions } from './src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const flowId = '0e70099f-aa1a-4078-98c3-d137bdd22cb0';
  
  const pausedExecs = await db.select().from(automationFlowExecutions).where(
    and(
      eq(automationFlowExecutions.flowId, flowId),
      eq(automationFlowExecutions.status, 'paused'),
      eq(automationFlowExecutions.currentStepId, 'ai_agent_1777482851759')
    )
  );

  console.log(`Encontradas ${pausedExecs.length} execuções no passo ai_agent_1777482851759.`);
  
  for (const ex of pausedExecs) {
    const vars = ex.variables as any;
    const timeout = parseInt(vars?.vars?._ai_timeout_at || '0');
    console.log(`\nExecução ${ex.id} (Conv: ${ex.conversationId})`);
    console.log(`Current Timeout: ${new Date(timeout).toLocaleString()}`);
    // Let's estimate creation time: if timeout is X, creation was X - 60 mins or X - 2 mins
    const diff60 = timeout - (60 * 60 * 1000);
    const diff2 = timeout - (2 * 60 * 1000);
    console.log(`Se o timeout for de 60m, entrou às: ${new Date(diff60).toLocaleString()}`);
    console.log(`Se o timeout for de 2m, entrou às: ${new Date(diff2).toLocaleString()}`);
  }

  process.exit(0);
}

run().catch(console.error);
