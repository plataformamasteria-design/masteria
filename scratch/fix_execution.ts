import { db } from '../src/lib/db';
import { automationFlowExecutions } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { resumeFlowForContact } from '../src/lib/flow-engine';

async function run() {
  const executionId = 'd493a0f4-e387-469b-a5fe-fc1a5e039d3a';
  
  // 1. Fetch the execution
  const [exec] = await db.select().from(automationFlowExecutions).where(eq(automationFlowExecutions.id, executionId)).limit(1);
  
  if (!exec) return console.log('Execution not found');
  
  // 2. Set it back to paused
  const vars = (exec.variables as any)?.vars || {};
  vars._ask_step_id = '1';
  delete vars._wait_timeout_at;
  
  await db.update(automationFlowExecutions).set({
      status: 'paused',
      currentStepId: '1',
      finishedAt: null as any,
      variables: { vars }
  }).where(eq(automationFlowExecutions.id, executionId));
  
  console.log('Execution set back to paused.');
  
  // 3. Resume the flow using the lead's message
  const messageText = 'Confirmar presença';
  console.log(`Resuming flow for contact ${exec.contactId} with message: "${messageText}"...`);
  
  const resumed = await resumeFlowForContact(exec.contactId, messageText, exec.companyId);
  console.log('Resume result:', resumed);
  
  process.exit(0);
}

run().catch(console.error);
