import { db } from './src/lib/db';
import { messages, conversations, contacts } from './src/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

async function check() {
  const recentMsgs = await db.select({
    id: messages.id,
    content: messages.content,
    sentAt: messages.sentAt,
    senderType: messages.senderType,
    convId: messages.conversationId,
  }).from(messages).orderBy(desc(messages.sentAt)).limit(5);
  
  console.log('Recent messages:', JSON.stringify(recentMsgs, null, 2));
  
  const recentConvs = await db.select({
    id: conversations.id,
    contactName: contacts.name,
    lastMessageAt: conversations.lastMessageAt,
    status: conversations.status,
  }).from(conversations).leftJoin(contacts, eq(conversations.contactId, contacts.id)).orderBy(desc(conversations.lastMessageAt)).limit(5);
  
  console.log('Recent conversations:', JSON.stringify(recentConvs, null, 2));
  process.exit(0);
}
check().catch(console.error);
