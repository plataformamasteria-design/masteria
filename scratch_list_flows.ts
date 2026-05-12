import 'dotenv/config';
import { db } from './src/lib/db';
import { automationFlows, companies } from './src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function listFlows() {
  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });

  const flows = await db.query.automationFlows.findMany({
    where: eq(automationFlows.companyId, company!.id)
  });

  for (const f of flows) console.log(f.name);
  process.exit(0);
}

listFlows().catch(console.error);
