import { db } from './src/lib/db';
import { companies, campaigns } from './src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function main() {
  const companyList = await db.select().from(companies).where(ilike(companies.name, '%Empresa de desenvolvimento Master%'));
  
  if (companyList.length === 0) {
    console.log("Company not found.");
    process.exit(1);
  }

  const company = companyList[0];
  console.log(`Found Company: ${company.name} (ID: ${company.id})`);

  const campaignList = await db.select()
    .from(campaigns)
    .where(eq(campaigns.companyId, company.id));

  for (const c of campaignList) {
    console.log(`Campaign: ${c.name} | ID: ${c.id} | Status: ${c.status} | Scheduled: ${c.scheduledAt}`);
  }
  
  process.exit(0);
}

main().catch(console.error);
