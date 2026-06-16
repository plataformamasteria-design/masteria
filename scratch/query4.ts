import { db } from '../src/lib/db';
import { automationFlowExecutions, contacts, automationFlows } from '../src/lib/db/schema';
import { desc, like, eq } from 'drizzle-orm';

async function run() {
  const phone = '5588920008007';
  console.log(`Recent executions for contact with phone like %20008007%...`);
  
  const execs = await db.select({
      id: automationFlowExecutions.id,
      status: automationFlowExecutions.status,
      currentStepId: automationFlowExecutions.currentStepId,
      flowId: automationFlowExecutions.flowId,
      startedAt: automationFlowExecutions.startedAt,
      contactId: contacts.id,
      phone: contacts.phone,
      flowName: automationFlows.name
  })
  .from(automationFlowExecutions)
  .leftJoin(contacts, eq(automationFlowExecutions.contactId, contacts.id))
  .leftJoin(automationFlows, eq(automationFlowExecutions.flowId, automationFlows.id))
  .where(like(contacts.phone, '%20008007%'))
  .orderBy(desc(automationFlowExecutions.startedAt))
  .limit(10);
    
  console.log(`Found ${execs.length} executions:`);
  for (const ex of execs) {
    console.log(`- ID: ${ex.id}, Status: ${ex.status}, Step: ${ex.currentStepId}, Flow: ${ex.flowName} (${ex.flowId}), StartedAt: ${ex.startedAt}`);
  }
  
  process.exit(0);
}

run().catch(console.error);
