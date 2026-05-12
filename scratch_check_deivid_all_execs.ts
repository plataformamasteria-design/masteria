import 'dotenv/config';
import { db } from './src/lib/db';
import { companies, contacts, automationFlowExecutions, automationExecutionLogs } from './src/lib/db/schema';
import { eq, like, desc, and, gt } from 'drizzle-orm';

async function test() {
  const company = await db.query.companies.findFirst({
    where: like(companies.name, '%Deivid%')
  });

  if (!company) {
    console.log("Company not found");
    process.exit(0);
  }

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

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const executions = await db.select().from(automationFlowExecutions).where(
    and(
      eq(automationFlowExecutions.contactId, contact.id),
      gt(automationFlowExecutions.startedAt, yesterday)
    )
  ).orderBy(desc(automationFlowExecutions.startedAt));

  console.log(`\n--- ALL Executions for Contact Today ---`);
  for (const exec of executions) {
    console.log(`Exec: ${exec.id} - Flow: ${exec.flowId} - Status: ${exec.status} - Started: ${exec.startedAt}`);
  }

  process.exit(0);
}
test().catch(console.error);
