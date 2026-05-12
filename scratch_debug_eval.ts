import { db } from './src/lib/db';
import { messages, conversations } from './src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { evaluateMessageTriggers } from './src/lib/flow-engine';

async function check() {
  const convId = '97b1d946-a71e-4dab-a3ab-d8286ae2bc01';
  const conv = await db.query.conversations.findFirst({ where: eq(conversations.id, convId) });
  console.log("Conversation:", conv?.id, "botStatus:", conv?.botStatus);

  const msgs = await db.query.messages.findMany({
    where: eq(messages.conversationId, convId),
    orderBy: [desc(messages.sentAt)],
    limit: 5
  });

  for (const m of msgs) {
    console.log(`MSG [${m.senderType}]: "${m.content}" (id: ${m.id})`);
  }
  
  if (msgs.length > 0) {
    const triggerMsg = msgs.find(m => m.content?.includes('TESTE'));
    if (triggerMsg) {
       console.log("Testando evaluateMessageTriggers para a mensagem...");
       const result = await evaluateMessageTriggers(conv!.companyId, conv!.contactId, triggerMsg);
       console.log("evaluateMessageTriggers result:", result);
    }
  }

  process.exit(0);
}
check().catch(console.error);
