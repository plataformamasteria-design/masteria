import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const { db } = await import('../src/lib/db');
  const { contacts, automationFlows } = await import('../src/lib/db/schema');
  const { eq, like } = await import('drizzle-orm');
  const { triggerFlow } = await import('../src/lib/flow-engine');

  try {
    // 1. Find the contact
    const phoneToFind = '%8892161399%';
    const leads = await db.select().from(contacts).where(like(contacts.phone, phoneToFind));
    if (leads.length === 0) {
      console.log(`Lead not found for phone ${phoneToFind}`);
      process.exit(1);
    }
    const lead = leads[0];
    console.log(`Found lead: ${lead.name} (${lead.phone}) - ID: ${lead.id}`);

    // 2. Find the correct flow that the lead triggers
    // The user triggered a flow named "Nova Automação MasterFlow". We will just use the one we patched recently
    // Wait, the user has multiple. Let's use the first one that has ai_copilot node.
    const flows = await db.select().from(automationFlows).where(like(automationFlows.name, '%Nova Automação MasterFlow%'));
    let targetFlow = null;
    for (const f of flows) {
      let logic: any = f.executionLogic;
      let steps = Array.isArray(logic) ? logic : logic?.steps;
      if (steps && steps.some((s: any) => s.type === 'ai_copilot' && s.data?.prompt)) {
        targetFlow = f;
        break; // found one with a prompt
      }
    }

    if (!targetFlow) {
      console.log('No flow found with a valid ai_copilot node and prompt.');
      process.exit(1);
    }
    console.log(`Using Flow: ${targetFlow.name} (ID: ${targetFlow.id})`);

    // 3. Trigger the flow
    console.log(`Triggering flow for message: "me mande o relatorio de campanhas de trafego, os dados resumidos do kanban e a carga de trabalho dos atendentes"`);
    const execId = await triggerFlow(targetFlow.id, targetFlow.companyId, lead.id, {
        message_text: "me mande o relatorio de campanhas de trafego, os dados resumidos do kanban e a carga de trabalho dos atendentes",
        message_type: 'text',
        trigger_type: 'message_received',
    });

    console.log(`Triggered! Execution ID: ${execId}`);
    
    // Wait for the execution to finish
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // Fetch execution logs
    const { automationExecutionLogs } = await import('../src/lib/db/schema');
    const logs = await db.select().from(automationExecutionLogs).where(eq(automationExecutionLogs.executionId, execId as string));
    
    console.log('\n--- Execution Logs ---');
    for (const log of logs) {
      console.log(`[${log.nodeType}] ${log.status}: ${log.message}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
