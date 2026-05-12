import { db } from './src/lib/db';
import { automationFlowExecutions, automationFlows, conversations } from './src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const flowId = '0e70099f-aa1a-4078-98c3-d137bdd22cb0';
  
  const flow = await db.query.automationFlows.findFirst({
    where: eq(automationFlows.id, flowId)
  });
  
  const logic = flow?.executionLogic as any;
  const nodeTimeoutMap: Record<string, number> = {};
  
  if (logic && logic.nodes) {
    for (const node of logic.nodes) {
      let mins = node.data?.response_timeout_minutes || node.data?.timeoutMinutes || node.data?.delayMinutes;
      if (mins !== undefined) {
        nodeTimeoutMap[node.id] = parseInt(mins, 10);
      }
    }
  }

  const pausedExecs = await db.select().from(automationFlowExecutions).where(
    and(
      eq(automationFlowExecutions.flowId, flowId),
      eq(automationFlowExecutions.status, 'paused')
    )
  );

  console.log(`Encontradas ${pausedExecs.length} execuções pausadas no total para o Douglas Bot.`);
  let updatedCount = 0;

  for (const ex of pausedExecs) {
    const vars = ex.variables as any;
    const aiTimeout = vars?.vars?._ai_timeout_at;
    const currentStepId = ex.currentStepId;
    
    if (currentStepId && aiTimeout) {
      const configuredMins = nodeTimeoutMap[currentStepId];
      if (configuredMins !== undefined) {
        let baseTime = 0;
        
        if (ex.conversationId) {
          const conv = await db.query.conversations.findFirst({
            where: eq(conversations.id, ex.conversationId)
          });
          if (conv) {
            const time1 = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0;
            const time2 = conv.lastAutoResponseAt ? new Date(conv.lastAutoResponseAt).getTime() : 0;
            baseTime = Math.max(time1, time2);
          }
        }
        
        if (baseTime === 0) {
          // Fallback: we cannot know exactly when they entered the step, so we skip or use current timeout.
          continue;
        }

        const newTimeoutMs = baseTime + (configuredMins * 60 * 1000);
        const oldTimeoutMs = parseInt(aiTimeout, 10);
        
        // Only update if it's significantly different (more than 1 minute diff)
        if (Math.abs(newTimeoutMs - oldTimeoutMs) > 60000) {
          console.log(`Atualizando exec ${ex.id} (Passo: ${currentStepId})`);
          console.log(`- Base Time: ${new Date(baseTime).toLocaleString()}`);
          console.log(`- Old Timeout: ${new Date(oldTimeoutMs).toLocaleString()}`);
          console.log(`- New Timeout: ${new Date(newTimeoutMs).toLocaleString()} (${configuredMins} mins)`);
          
          vars.vars._ai_timeout_at = newTimeoutMs.toString();
          
          await db.update(automationFlowExecutions)
            .set({ variables: vars })
            .where(eq(automationFlowExecutions.id, ex.id));
            
          updatedCount++;
        }
      }
    }
  }

  console.log(`\nAtualizadas ${updatedCount} execuções.`);
  process.exit(0);
}

run().catch(console.error);
