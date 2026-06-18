import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local first
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Now dynamically import the rest to ensure env vars are loaded
async function run() {
  const { db } = await import('../src/lib/db');
  const { automationFlows, contacts } = await import('../src/lib/db/schema');
  const { eq, like } = await import('drizzle-orm');
  const { triggerFlow } = await import('../src/lib/flow-engine');

  try {
    const flowId = '5f345023-dcde-4201-8f2c-06d9c7e9ae78';
    console.log(`1. Finding the flow ${flowId}...`);
    const flows = await db.select().from(automationFlows).where(eq(automationFlows.id, flowId));
    if (flows.length === 0) {
      console.log('Flow not found.');
      process.exit(1);
    }
    const flow = flows[0];
    console.log(`Flow found: ${flow.name}`);

    // Update the execution logic
    let logic: any = flow.executionLogic;
    let steps = Array.isArray(logic) ? logic : logic?.steps;
    let updated = false;

    if (steps) {
      for (const step of steps) {
        if (step.type === 'ai_copilot') {
          console.log('Found ai_copilot node. Injecting prompt...');
          step.data = step.data || {};
          // Prompt completo baseado nas ferramentas do assistente interno
          step.data.prompt = "O lead enviou a seguinte mensagem: '{{message_text}}'.\n\nInstruções:\n1. Aja como o Masteria Copilot, o assistente inteligente.\n2. Se ele pedir informações como 'relatório de tráfego', 'meus leads' ou 'quantas mensagens enviadas', use as ferramentas disponíveis (getKanbanSummary, getAgentWorkload, getActiveCampaigns) para buscar os dados reais.\n3. Escreva um breve resumo dos dados encontrados na ferramenta e retorne para o usuário com tom profissional.";
          updated = true;
        }
      }
    }

    if (updated) {
      await db.update(automationFlows).set({ executionLogic: logic }).where(eq(automationFlows.id, flow.id));
      console.log('Flow updated successfully.');
    } else {
      console.log('Node ai_copilot not found in flow logic.');
    }

    // Now validate it internally
    console.log('2. Validating internally...');
    const deivids = await db.select().from(contacts).where(like(contacts.name, '%Deivid Rodrigues%'));
    if (deivids.length === 0) {
      console.log('Contact Deivid Rodrigues not found for testing.');
      process.exit(1);
    }
    const deivid = deivids[0];
    
    console.log(`Triggering flow for contact ${deivid.id} (${deivid.name})`);
    
    // Call triggerFlow just like evaluating a message
    const execId = await triggerFlow(flow.id, flow.companyId, deivid.id, {
        message_text: "me manda o relatorio de trafego",
        message_type: 'text',
        trigger_type: 'message_received',
    });
    
    console.log(`Triggered! Execution ID: ${execId}`);
    
    // Wait for the execution to finish
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Fetch execution logs
    const { automationExecutionLogs } = await import('../src/lib/db/schema');
    const logs = await db.select().from(automationExecutionLogs).where(eq(automationExecutionLogs.executionId, execId as string));
    
    console.log('Execution Logs:');
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
