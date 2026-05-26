import { db } from "../src/lib/db";
import { companies, contacts, conversations, messages, automationLogs } from "../src/lib/db/schema";
// Assuming automationFlows is exported from schema
import { automationFlows } from "../src/lib/db/schema";
import { like, eq, and, desc } from "drizzle-orm";

async function run() {
  console.log("Searching for company...");
  const companyList = await db.select().from(companies).where(like(companies.name, "%Henrique Felipe%"));
  if (companyList.length === 0) {
    console.log("Company not found");
    return;
  }
  const company = companyList[0];
  console.log(`Company found: ${company.name} (${company.id})`);

  console.log("Searching for automation flow...");
  const flowList = await db.select().from(automationFlows)
    .where(and(
        eq(automationFlows.companyId, company.id),
        like(automationFlows.name, "%Robo de Atendimento e Follow UP (Importado) (Cópia)%")
    ));
  
  if (flowList.length === 0) {
    console.log("Flow not found. Listing all flows for this company:");
    const allFlows = await db.select().from(automationFlows).where(eq(automationFlows.companyId, company.id));
    allFlows.forEach(f => console.log(`- ${f.name} (active: ${f.isActive}) (id: ${f.id})`));
  } else {
    const flow = flowList[0];
    console.log(`Flow found: ${flow.name} (${flow.id})`);
  }

  console.log("Searching for contact...");
  const contactList = await db.select().from(contacts)
    .where(and(
        eq(contacts.companyId, company.id),
        like(contacts.phone, "%88920008007%")
    ));
  if (contactList.length === 0) {
    console.log("Contact not found");
    return;
  }
  const contact = contactList[0];
  console.log(`Contact found: ${contact.name} (${contact.phone}) (${contact.id})`);

  console.log("Searching for conversation...");
  const conversationList = await db.select().from(conversations)
    .where(and(
        eq(conversations.companyId, company.id),
        eq(conversations.contactId, contact.id)
    ))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);

  if (conversationList.length > 0) {
      const conv = conversationList[0];
      console.log(`Conversation found: ${conv.id} | aiActive: ${conv.aiActive} | status: ${conv.status}`);
      
      console.log("Searching for messages...");
      const msgList = await db.select().from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.sentAt))
        .limit(10);
      console.log("Recent messages:");
      msgList.forEach(m => console.log(`- [${m.sentAt}] ${m.senderType}: ${m.content.substring(0, 50)}`));
      
      // Look for automation trigger logs or queue jobs?
      // Since it's V4, how are automations executed? Let's check automation_logs
      console.log("Searching for automation logs for this conversation...");
      const logListConv = await db.select().from(automationLogs)
        .where(eq(automationLogs.conversationId, conv.id))
        .orderBy(desc(automationLogs.createdAt))
        .limit(20);
      console.log("Automation logs for conv:");
      logListConv.forEach(l => console.log(`- [${l.createdAt}] ${l.level}: ${l.message} | details: ${JSON.stringify(l.details).substring(0, 100)}`));
  } else {
      console.log("No conversation found");
  }

}

run().catch(console.error).finally(() => process.exit(0));
