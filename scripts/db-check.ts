import { db } from '../src/lib/db';
import { messages, conversations } from '../src/lib/db/schema';
import { inArray, eq, desc } from 'drizzle-orm';

async function run() {
  const msgs = await db.select({
    id: messages.id,
    convId: messages.conversationId,
    status: messages.status,
    provider: messages.providerMessageId,
    senderType: messages.senderType,
    sentAt: messages.sentAt,
    readAt: messages.readAt
  }).from(messages).orderBy(desc(messages.sentAt)).limit(10);
  
  console.log("Recent messages:");
  console.table(msgs);

  const convs = await db.select({
    id: conversations.id,
    updatedAt: conversations.updatedAt,
    lastMsgAt: conversations.lastMessageAt
  }).from(conversations).orderBy(desc(conversations.updatedAt)).limit(5);

  console.log("\nRecent conversations:");
  console.table(convs);

  process.exit(0);
}
run();
