import { db } from "../src/lib/db";
import { automationRules, companies } from "../src/lib/db/schema";
import { like, eq } from "drizzle-orm";

async function run() {
  console.log("Searching for automation rules matching name...");
  const ruleList = await db.select({
      id: automationRules.id,
      name: automationRules.name,
      companyId: automationRules.companyId,
      companyName: companies.name
  })
  .from(automationRules)
  .leftJoin(companies, eq(automationRules.companyId, companies.id))
  .where(like(automationRules.name, "%Robo%"));
  
  console.log(`Found ${ruleList.length} rules matching 'Robo':`);
  ruleList.forEach(r => console.log(`- ${r.name} | company: ${r.companyName} (${r.companyId}) | ruleId: ${r.id}`));
}

run().catch(console.error).finally(() => process.exit(0));
