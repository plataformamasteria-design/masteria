import { db } from "../src/lib/db";
import { companies, contacts, automationRules, automationLogs, conversations, messages } from "../src/lib/db/schema";
import { eq, like, desc, and } from "drizzle-orm";

async function run() {
  console.log("Searching for company...");
  const companyList = await db.select().from(companies).where(like(companies.name, "%Henrique Felipe%"));
  if (companyList.length === 0) {
    console.log("Company not found");
    return;
  }
  const company = companyList[0];
  console.log(`Company found: ${company.name} (${company.id})`);

  console.log("Searching for automation rule...");
  const ruleList = await db.select().from(automationRules)
    .where(and(
        eq(automationRules.companyId, company.id),
        like(automationRules.name, "%Robo de Atendimento e Follow UP (Importado) (Cópia)%")
    ));
  if (ruleList.length === 0) {
    console.log("Automation rule not found");
    return;
  }
  const rule = ruleList[0];
  console.log(`Rule found: ${rule.name} (${rule.id})`);

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
      console.log(`Conversation found: ${conv.id}`);
      
      console.log("Searching for messages...");
      const msgList = await db.select().from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.sentAt))
        .limit(10);
      console.log("Recent messages:");
      msgList.forEach(m => console.log(`- [${m.sentAt}] ${m.senderType}: ${m.content.substring(0, 50)}`));
      
      console.log("Searching for automation logs for this conversation...");
      const logListConv = await db.select().from(automationLogs)
        .where(eq(automationLogs.conversationId, conv.id))
        .orderBy(desc(automationLogs.createdAt))
        .limit(20);
      console.log("Automation logs for conv:");
      logListConv.forEach(l => console.log(`- [${l.createdAt}] ${l.level}: ${l.message} | rule: ${l.ruleId} | details: ${JSON.stringify(l.details)}`));
  } else {
      console.log("No conversation found");
  }

  console.log("Searching for recent automation logs for this rule...");
  const logList = await db.select().from(automationLogs)
    .where(eq(automationLogs.ruleId, rule.id))
    .orderBy(desc(automationLogs.createdAt))
    .limit(10);
  
  console.log("Recent rule logs:");
  logList.forEach(l => console.log(`- [${l.createdAt}] ${l.level}: ${l.message} | conv: ${l.conversationId}`));
}

run().catch(console.error).finally(() => process.exit(0));
