import { db } from './src/lib/db';
import { automationFlowExecutions, conversations } from './src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const flowId = '0e70099f-aa1a-4078-98c3-d137bdd22cb0';
  
  const pausedExecs = await db.select().from(automationFlowExecutions).where(
    and(
      eq(automationFlowExecutions.flowId, flowId),
      eq(automationFlowExecutions.status, 'paused'),
      eq(automationFlowExecutions.currentStepId, 'follow_up_ai_1777483838957')
    )
  );

  console.log(`Encontradas ${pausedExecs.length} execuções no passo follow_up_ai_1777483838957.`);
  
  for (const ex of pausedExecs) {
    const vars = ex.variables as any;
    const timeout = parseInt(vars?.vars?._ai_timeout_at || '0');
    let lastMsg = 'N/A';
    let lastAuto = 'N/A';
    
    if (ex.conversationId) {
      const conv = await db.query.conversations.findFirst({
        where: eq(conversations.id, ex.conversationId)
      });
      lastMsg = conv?.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString() : 'N/A';
      lastAuto = conv?.lastAutoResponseAt ? new Date(conv.lastAutoResponseAt).toLocaleString() : 'N/A';
    }
    
    console.log(`\nExecução ${ex.id} (Conv: ${ex.conversationId})`);
    console.log(`Current Timeout: ${new Date(timeout).toLocaleString()} (${timeout})`);
    console.log(`Last Msg: ${lastMsg}`);
    console.log(`Last Auto: ${lastAuto}`);
  }

  process.exit(0);
}

run().catch(console.error);
