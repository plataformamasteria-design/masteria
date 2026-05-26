import { db } from '../src/lib/db';
import { automationFlowExecutions } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const exec = await db.select()
    .from(automationFlowExecutions)
    .where(eq(automationFlowExecutions.id, '75846dd2-3e26-4f5a-abd0-b33c8e1d8c89'));
    
  if (exec.length > 0) {
      const e = exec[0];
      const logs = (e.executionLogs as any) || [];
      console.log('--- Logs for execution 75846dd2-3e26-4f5a-abd0-b33c8e1d8c89 ---');
      for (const log of logs) {
         console.log(`[${log.status || 'INFO'}] Step: ${log.stepId} (${log.stepType}) -> ${log.message}`);
         if (log.error) console.log(`   Error: ${log.error}`);
      }
      console.log('\nVariables:', JSON.stringify(e.variables, null, 2));
  }
  process.exit(0);
}

main().catch(console.error);
