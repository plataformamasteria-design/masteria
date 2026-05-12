import 'dotenv/config';
import { db } from './src/lib/db';
import { automationFlows, companies } from './src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function fix() {
  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });

  if (!company) {
    console.log("Companhia Henrique Felipe não encontrada.");
    process.exit(0);
  }

  console.log(`Company ID: ${company.id}`);

  const flows = await db.query.automationFlows.findMany({
    where: eq(automationFlows.companyId, company.id)
  });

  console.log(`Verificando ${flows.length} flows para correção.`);

  for (const f of flows) {
    const logic = f.executionLogic as any;
    if (Array.isArray(logic) && logic.length > 0 && logic[0].type === 'trigger') {
      const expectedType = logic[0].data?.triggerType || 'message_received';
      const expectedConfig = logic[0].data || null;

      if (f.triggerType !== expectedType) {
        console.log(`Corrigindo flow ${f.name} (ID: ${f.id}) de ${f.triggerType} para ${expectedType}`);
        
        await db.update(automationFlows)
          .set({
            triggerType: expectedType,
            triggerConfig: expectedConfig
          })
          .where(eq(automationFlows.id, f.id));
        
        console.log(`Flow ${f.name} corrigido.`);
      } else {
        // As vezes triggerConfig não foi salvo, vamos forçar atualização
        await db.update(automationFlows)
          .set({
            triggerConfig: expectedConfig
          })
          .where(eq(automationFlows.id, f.id));
        console.log(`Flow ${f.name} atualizado triggerConfig.`);
      }
    }
  }

  console.log('Correção finalizada.');
  process.exit(0);
}

fix().catch(console.error);
