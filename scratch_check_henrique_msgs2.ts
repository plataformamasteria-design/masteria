import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './src/lib/db';
import { messages, companies, automationFlows, automationRules } from './src/lib/db/schema';
import { eq, desc, gte, and, ilike } from 'drizzle-orm';
import { startOfDay } from 'date-fns';

async function check() {
  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });

  if (!company) {
    console.log("Empresa não encontrada.");
    process.exit(0);
  }

  const today = startOfDay(new Date());
  console.log(`\n--- ÚLTIMAS 50 MENSAGENS OUTGOING HOJE (${company.name}) ---`);

  try {
    const msgs = await db.query.messages.findMany({
      where: and(
        eq(messages.companyId, company.id),
        gte(messages.sentAt, today),
        // Filter maybe by senderId or direction, in schema messages has senderType
      ),
      orderBy: [desc(messages.sentAt)],
      limit: 100
    });

    let outgoing = 0;
    for (const m of msgs) {
      // Typically 'AGENT', 'SYSTEM', 'BOT', 'AI' are outgoing. 'CONTACT' is incoming.
      if (m.senderType !== 'CONTACT') {
        outgoing++;
        console.log(`[${m.sentAt.toISOString().split('T')[1]}] Sender: ${m.senderType} | AI: ${m.isAiGenerated} | Msg: ${m.content.substring(0, 100).replace(/\n/g, ' ')}...`);
      }
    }
    console.log(`\nTotal de outgoing mostradas: ${outgoing}`);

  } catch (err: any) {
    console.log("Erro ao buscar mensagens:", err.message);
  }

  console.log(`\n--- VERIFICANDO AUTOMATION FLOWS (Regras e Fluxos) ---`);
  try {
    const flows = await db.query.automationFlows.findMany({
      where: eq(automationFlows.companyId, company.id)
    });
    console.log(`Encontrados ${flows.length} automationFlows.`);
    for (const f of flows) {
      console.log(`Flow: ${f.name} | Ativo: ${f.isActive} | Trigger: ${f.triggerType}`);
    }
  } catch (e: any) {
     console.log("Tabela automationFlows não existe ou erro:", e.message);
  }

  try {
    const rules = await db.query.automationRules.findMany({
      where: eq(automationRules.companyId, company.id)
    });
    console.log(`\nEncontradas ${rules.length} automationRules.`);
    for (const r of rules) {
      console.log(`Rule: ${r.name} | Ativo: ${r.isActive} | Trigger: ${r.triggerEvent}`);
    }
  } catch (e: any) {
     console.log("Tabela automationRules não existe ou erro:", e.message);
  }

  process.exit(0);
}
check().catch(console.error);
