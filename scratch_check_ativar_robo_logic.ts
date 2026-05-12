import 'dotenv/config';
import { db } from './src/lib/db';
import { automationFlows, companies } from './src/lib/db/schema';
import { ilike, eq, and } from 'drizzle-orm';

async function checkFlow() {
  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });

  const flow = await db.query.automationFlows.findFirst({
    where: and(eq(automationFlows.companyId, company!.id), eq(automationFlows.name, 'ATIVAR ROBO'))
  });

  console.log(JSON.stringify(flow?.executionLogic, null, 2));
  console.log("Is active?", flow?.isActive);
  process.exit(0);
}

checkFlow().catch(console.error);
