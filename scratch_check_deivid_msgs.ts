import 'dotenv/config';
import { db } from './src/lib/db';
import { companies, contacts, conversations, messages, automationLogs } from './src/lib/db/schema';
import { eq, like, desc, and } from 'drizzle-orm';

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

  const conv = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.contactId, contact.id),
      eq(conversations.companyId, company.id)
    ),
    orderBy: desc(conversations.lastMessageAt)
  });

  if (!conv) {
    console.log("Conversation not found");
    process.exit(0);
  }

  const msgs = await db.select().from(messages).where(
    eq(messages.conversationId, conv.id)
  ).orderBy(desc(messages.sentAt));

  console.log(`\n--- Messages for Conversation ---`);
  for (const msg of msgs.slice(0, 5)) {
    console.log(`[${msg.sentAt?.toISOString()}] ${msg.senderType}: ${msg.content} (ID: ${msg.id})`);
  }

  console.log(`\n--- Automation Logs for Conversation ---`);
  const logs = await db.select().from(automationLogs).where(
    eq(automationLogs.conversationId, conv.id)
  ).orderBy(desc(automationLogs.createdAt));

  for (const log of logs.slice(0, 5)) {
    console.log(`[${log.createdAt?.toISOString()}] ${log.triggeredBy} - Details: ${JSON.stringify(log.details)}`);
  }

  process.exit(0);
}
test().catch(console.error);
