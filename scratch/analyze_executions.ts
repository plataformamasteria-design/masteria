import { db } from '../src/lib/db';
import { automationFlows, automationFlowExecutions } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
  const flowId = '84de750c-3b59-492a-9553-67f1f45192dc'; // A Mesa - Automação
  
  const [flow] = await db.select().from(automationFlows).where(eq(automationFlows.id, flowId));
  console.log(`Flow: ${flow?.name} | Active: ${flow?.isActive}`);
  
  const executions = await db.select()
    .from(automationFlowExecutions)
    .where(eq(automationFlowExecutions.flowId, flowId))
    .orderBy(desc(automationFlowExecutions.startedAt))
    .limit(20);
    
  console.log(`Found ${executions.length} recent executions.`);
  
  if (executions.length === 0) {
      console.log('No executions found yet.');
      process.exit(0);
  }

  for (const exec of executions) {
      console.log(`\nExecution ID: ${exec.id}`);
      console.log(`Contact ID: ${exec.contactId}`);
      console.log(`Status: ${exec.status}`);
      console.log(`Current Step ID: ${exec.currentStepId}`);
      console.log(`Started At: ${exec.startedAt}`);
      console.log(`Finished At: ${exec.finishedAt}`);
      
      const vars = exec.variables as any;
      if (vars && vars._resumeAt) {
          console.log(`_resumeAt (Scheduled for): ${new Date(vars._resumeAt).toISOString()}`);
          console.log(`Current time: ${new Date().toISOString()}`);
      }
      
      const logs = (exec.executionLogs as any) || [];
      if (logs.length > 0) {
         console.log(`Logs (${logs.length}):`);
         for (const log of logs) {
            console.log(`  - [${log.status || 'INFO'}] Step: ${log.stepId} (${log.stepType}) -> ${log.message}`);
         }
      }
  }
  
  process.exit(0);
}

main().catch(console.error);
