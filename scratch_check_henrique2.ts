import 'dotenv/config';
import { db } from './src/lib/db';
import { automationFlows, companies } from './src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function check() {
  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });

  if (!company) {
    console.log("Companhia Henrique Felipe não encontrada.");
    process.exit(0);
  }

  console.log(`Company ID: ${company.id}`);
  console.log(`Name: ${company.name}`);

  const flows = await db.query.automationFlows.findMany({
    where: eq(automationFlows.companyId, company.id)
  });

  console.log(`Encontrados ${flows.length} flows para esta empresa.`);

  for (const f of flows) {
    if (f.name.includes('ATIVAR ROBO') || f.name.includes('Robo de Atendimento')) {
      console.log(`\n======================================`);
      console.log(`FLOW: ${f.name} (ID: ${f.id})`);
      console.log(`IsActive: ${f.isActive}`);
      console.log(`Trigger Type: ${f.triggerType}`);
      console.log(`Trigger Config: ${JSON.stringify(f.triggerConfig, null, 2)}`);
      
      const logic = f.executionLogic as any;
      console.log(`\nExecution Logic (nodes count: ${Array.isArray(logic) ? logic.length : 0}):`);
      if (Array.isArray(logic)) {
        for (const node of logic) {
          console.log(`- Node ${node.id} (${node.type})`);
          if (node.data) {
             console.log(`  Data: ${JSON.stringify(node.data, null, 2)}`);
          }
        }
      } else {
        console.log(`Logic:`, f.executionLogic);
      }
    }
  }

  process.exit(0);
}

check().catch(console.error);
