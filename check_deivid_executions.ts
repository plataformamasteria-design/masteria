import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './src/lib/db';
import { automationFlowExecutions, automationExecutionLogs, messages } from './src/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

async function run() {
  const contactId = 'f8304d5a-f1aa-4af7-8217-c9f80ca62117'; // From the error logs earlier, this might be Deivid or Ffff. Let's find Deivid.

  // Find contact Deivid
  const msgs = await db.select().from(messages).where(eq(messages.id, 'd58a4a21-cc8c-4359-9f8d-5201adb3451f'));
  if (!msgs.length) return;
  const conversationId = msgs[0].conversationId;

  // Let's just query executions for this conversation's contact
  const execIds = [
    'd0ce1fa8-7348-4164-b71d-e4105f937822',
    'd30fb679-900c-445c-affd-666385c779ce',
    '4338a114-f9db-4bcf-b390-03d4f107e80a'
  ];

  const execs = await db.select().from(automationFlowExecutions)
    .where(inArray(automationFlowExecutions.id, execIds));

  for (const exec of execs) {
    console.log(`\nExecution: ${exec.id} | Flow: ${exec.flowId} | Status: ${exec.status} | StartedAt: ${exec.startedAt}`);
    const logs = await db.select().from(automationExecutionLogs)
      .where(eq(automationExecutionLogs.executionId, exec.id))
      .orderBy(automationExecutionLogs.createdAt);
    
    console.log(`Logs (${logs.length}):`);
    for (const log of logs) {
      console.log(`  - ${log.createdAt?.toISOString()} | Node: ${log.nodeType} | Status: ${log.status} | Action: ${log.outputData?.action || ''}`);
    }
  }
}

run().catch(console.error).finally(() => process.exit(0));
