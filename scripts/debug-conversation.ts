
import { db } from '../src/lib/db';
import { messages, conversations } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
  const conversationId = process.argv[2];
  if (!conversationId) {
    console.error('Please provide a conversation ID');
    process.exit(1);
  }

  console.log(`Fetching messages for conversation ${conversationId}...`);

  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });

  if (!conversation) {
    console.error('Conversation not found');
    process.exit(1);
  }

  console.log('Conversation:', conversation);

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.sentAt))
    .limit(20);

  console.log('--- Recent Messages (Newest First) ---');
  msgs.forEach((msg) => {
    console.log(`[${msg.sentAt?.toISOString()}] ${msg.senderType}: ${msg.content.substring(0, 50)}... (ID: ${msg.id})`);
  });

  process.exit(0);
}

main().catch(console.error);
