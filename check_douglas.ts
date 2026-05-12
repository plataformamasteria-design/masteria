import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './src/lib/db';
import { companies, messages, conversations, automationFlows, automationFlowExecutions } from './src/lib/db/schema';
import { eq, desc, inArray, like } from 'drizzle-orm';

async function run() {
  const comp = await db.select().from(companies).where(like(companies.name, '%Douglas Resende%')).limit(1);
  if (comp.length === 0) {
    console.log("Companhia não encontrada");
    return;
  }
  const companyId = comp[0].id;
  console.log(`Company: ${comp[0].name} (${companyId})`);

  const recentMsgs = await db.select()
    .from(messages)
    .where(eq(messages.companyId, companyId))
    .where(inArray(messages.senderType, ['CONTACT', 'USER']))
    .orderBy(desc(messages.sentAt))
    .limit(3);

  for (const msg of recentMsgs) {
    console.log(`\n--- Message ${msg.id} ---`);
    console.log(`Content: "${msg.content || msg.text || msg.body}"`);
    console.log(`SenderType: ${msg.senderType}, SentAt: ${msg.sentAt}`);
    console.log(`ConversationId: ${msg.conversationId}`);

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, msg.conversationId!));
    console.log(`Conversation aiActive: ${conv?.aiActive}`);

    // Check active flows for this company
    const flows = await db.select({
      id: automationFlows.id,
      name: automationFlows.name,
      isActive: automationFlows.isActive
    }).from(automationFlows)
      .where(eq(automationFlows.companyId, companyId));

    console.log(`Active flows for company: ${flows.filter(f => f.isActive).map(f => f.name).join(', ')}`);

    // Check recent executions for this contact
    const execs = await db.select({
      id: automationFlowExecutions.id,
      flowId: automationFlowExecutions.flowId,
      status: automationFlowExecutions.status
    }).from(automationFlowExecutions)
      .where(eq(automationFlowExecutions.contactId, conv?.contactId!))
      .orderBy(desc(automationFlowExecutions.startedAt))
      .limit(3);
    console.log(`Recent executions for contact:`, execs);
  }
}

run().catch(console.error).finally(() => process.exit(0));
