import { db } from "../src/lib/db";
import { companies, automationRules } from "../src/lib/db/schema";
import { eq, like, desc, and } from "drizzle-orm";

async function run() {
  const companyList = await db.select().from(companies).where(like(companies.name, "%Henrique Felipe%"));
  if (companyList.length === 0) {
    console.log("Company not found");
    return;
  }
  const company = companyList[0];
  console.log(`Company found: ${company.name} (${company.id})`);

  console.log("All automation rules for this company:");
  const ruleList = await db.select({ id: automationRules.id, name: automationRules.name, isActive: automationRules.isActive }).from(automationRules)
    .where(eq(automationRules.companyId, company.id));
  
  ruleList.forEach(r => console.log(`- ${r.name} (active: ${r.isActive}) (id: ${r.id})`));
}

run().catch(console.error).finally(() => process.exit(0));
