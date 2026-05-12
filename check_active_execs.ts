import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './src/lib/db';
import { automationFlowExecutions } from './src/lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';

async function run() {
  const contactId = 'f8304d5a-f1aa-4af7-8217-c9f80ca62117'; // Deivid

  const execs = await db.select().from(automationFlowExecutions)
    .where(and(
      eq(automationFlowExecutions.contactId, contactId),
      inArray(automationFlowExecutions.status, ['paused', 'running'])
    ));

  console.log(`Active executions for Deivid (${contactId}):`);
  for (const exec of execs) {
    console.log(`- Exec: ${exec.id} | Flow: ${exec.flowId} | Status: ${exec.status}`);
  }
}

run().catch(console.error).finally(() => process.exit(0));
