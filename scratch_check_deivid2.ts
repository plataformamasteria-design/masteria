import 'dotenv/config';
import { db } from './src/lib/db';
import { companies, contacts, automationExecutions, executionLogs, messages } from './src/lib/db/schema';
import { eq, like, desc, and } from 'drizzle-orm';

async function test() {
  const company = await db.query.companies.findFirst({
    where: like(companies.name, '%Deivid%')
  });

  if (!company) {
    console.log("Company not found");
    process.exit(0);
  }

  console.log(`Company: ${company.name} (${company.id})`);

  const contact = await db.query.contacts.findFirst({
    where: and(
        eq(contacts.companyId, company.id),
        like(contacts.phone, '%8892161399%')
    )
  });

  if (!contact) {
    console.log("Contact not found");
    process.exit(0);
  }

  console.log(`Contact: ${contact.name} - ${contact.phone} (${contact.id})`);

  const executions = await db.select().from(automationExecutions).where(
    eq(automationExecutions.contactId, contact.id)
  ).orderBy(desc(automationExecutions.startedAt));

  console.log(`\n--- Executions for Contact ---`);
  for (const exec of executions) {
    console.log(`Exec: ${exec.id} - Flow: ${exec.flowId} - Status: ${exec.status} - Started: ${exec.startedAt}`);
    
    const logs = await db.select().from(executionLogs).where(
      eq(executionLogs.executionId, exec.id)
    ).orderBy(desc(executionLogs.timestamp));

    console.log(`  Logs (${logs.length}):`);
    for (const log of logs.slice(0, 15).reverse()) {
      console.log(`    [${log.timestamp.toISOString()}] Node ${log.nodeId} (${log.nodeType}) - ${log.status}: ${log.message}`);
    }
  }

  process.exit(0);
}
test().catch(console.error);
