import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const { db } = await import('../src/lib/db');
  const { automationFlows } = await import('../src/lib/db/schema');
  const { like } = await import('drizzle-orm');

  const flows = await db.select().from(automationFlows).where(like(automationFlows.name, '%Nova Automação MasterFlow%'));
  console.log(`Encontrados ${flows.length} flows com o nome Nova Automação MasterFlow`);

  let updatedCount = 0;

  for (const flow of flows) {
    let logic: any = flow.executionLogic;
    let steps = Array.isArray(logic) ? logic : logic?.steps;
    let updated = false;

    if (steps) {
      for (const step of steps) {
        if (step.type === 'ai_copilot') {
          step.data = step.data || {};
          if (!step.data.prompt || step.data.prompt.trim() === '') {
            console.log(`Injetando prompt no flow ${flow.id}`);
            step.data.prompt = "O lead enviou a seguinte mensagem: '{{message_text}}'.\n\nInstruções:\n1. Aja como o Masteria Copilot, o assistente inteligente.\n2. Se ele pedir informações como 'relatório de tráfego', 'meus leads' ou 'quantas mensagens enviadas', use as ferramentas disponíveis (getKanbanSummary, getAgentWorkload, getActiveCampaigns) para buscar os dados reais.\n3. Escreva um breve resumo dos dados encontrados na ferramenta e retorne para o usuário com tom profissional.";
            updated = true;
          }
        }
      }
    }

    if (updated) {
      const { eq } = await import('drizzle-orm');
      await db.update(automationFlows).set({ executionLogic: logic }).where(eq(automationFlows.id, flow.id));
      updatedCount++;
    }
  }

  console.log(`Pronto! Atualizados ${updatedCount} flows.`);
  process.exit(0);
}
run();
