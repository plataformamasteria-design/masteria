import { db } from './src/lib/db';
import { contacts, conversations, messages } from './src/lib/db/schema';
import { eq, desc, ilike } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const c = await db.query.contacts.findFirst({
    where: ilike(contacts.name, '%Marcelo Rego de Almeida%')
  });
  if (!c) {
    console.log('Contact not found');
    return process.exit(0);
  }
  
  console.log(`Found contact: ${c.id}`);
  
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.contactId, c.id),
    orderBy: desc(conversations.lastMessageAt)
  });
  if (!conv) {
    console.log('Conv not found');
    return process.exit(0);
  }
  
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(desc(messages.sentAt)).limit(10);
  for (const m of msgs.reverse()) {
    console.log(`[${m.sentAt}] Type: ${m.contentType} Sender: ${m.senderType} Transc: ${(m as any).aiTranscription}`);
    console.log(`Content: ${m.content}`);
    console.log(`Media: ${m.mediaUrl}`);
    console.log('---');
  }
  process.exit(0);
}

run().catch(console.error);
