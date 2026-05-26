import { db } from '../src/lib/db';
import { automationExecutionLogs } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
  const logs = await db.select()
    .from(automationExecutionLogs)
    .where(eq(automationExecutionLogs.executionId, '75846dd2-3e26-4f5a-abd0-b33c8e1d8c89'))
    .orderBy(desc(automationExecutionLogs.createdAt));
    
  console.log(`Found ${logs.length} logs for execution.`);
  for (const log of logs) {
      console.log(`[${log.status || 'INFO'}] Step: ${log.stepId} (${log.stepType}) -> ${log.message}`);
      if (log.error) console.log(`   Error: ${log.error}`);
  }
  process.exit(0);
}

main().catch(console.error);
