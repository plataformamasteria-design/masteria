import { db } from '../src/lib/db';
import { automationExecutionLogs, automationFlowExecutions, messages } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function run() {
  const executionId = 'd493a0f4-e387-469b-a5fe-fc1a5e039d3a';
  
  const exec = await db.select().from(automationFlowExecutions).where(eq(automationFlowExecutions.id, executionId)).limit(1);
  console.log("EXEC:", JSON.stringify(exec[0], null, 2));

  const logs = await db.select().from(automationExecutionLogs)
    .where(eq(automationExecutionLogs.executionId, executionId))
    .orderBy(automationExecutionLogs.createdAt);
    
  for (const log of logs) {
    console.log(`- Node: ${log.nodeId} (${log.nodeType}), Status: ${log.status}, Msg: ${log.message}`);
    if (log.status === 'error') {
      console.log(`  Error: ${JSON.stringify(log.outputData)}`);
    }
  }
  
  const msgs = await db.select().from(messages).where(eq(messages.companyId, exec[0].companyId)).orderBy(desc(messages.sentAt)).limit(20);
  console.log(`Recent messages for company:`);
  for (const m of msgs) {
    if (m.senderType === 'CONTACT' || m.senderType === 'USER') {
        console.log(`[${m.sentAt}] ${m.senderType}: ${m.content}`);
    }
  }
  
  process.exit(0);
}

run().catch(console.error);
