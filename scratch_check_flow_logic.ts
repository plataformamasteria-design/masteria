import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './src/lib/db';
import { automationFlows, companies } from './src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function check() {
  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });

  if (!company) {
    console.log("Empresa não encontrada.");
    process.exit(0);
  }

  const flows = await db.query.automationFlows.findMany({
    where: eq(automationFlows.companyId, company.id)
  });

  for (const f of flows) {
    if (f.name === 'ATIVAR ROBO') {
      console.log(`\nFlow: ${f.name} | Ativo: ${f.isActive}`);
      console.log(`Execution Logic:`, JSON.stringify(f.executionLogic, null, 2));
    }
  }

  process.exit(0);
}
check().catch(console.error);
