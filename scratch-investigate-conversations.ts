import 'dotenv/config';
import { db } from './src/lib/db';
import { conversations, contacts, messages } from './src/lib/db/schema';
import { eq, inArray, count, desc, sql } from 'drizzle-orm';

async function run() {
  const allConversations = await db.select({
    id: conversations.id,
    contactId: conversations.contactId,
    connectionId: conversations.connectionId,
    contactName: contacts.name,
    status: conversations.status
  }).from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id));

  const contactMap: Record<string, typeof allConversations> = {};
  
  for (const conv of allConversations) {
    if (!contactMap[conv.contactId]) contactMap[conv.contactId] = [];
    contactMap[conv.contactId].push(conv);
  }

  let dupesCount = 0;
  for (const [contactId, convs] of Object.entries(contactMap)) {
    if (convs.length > 1) {
      dupesCount++;
      console.log(`\nContact ${contactId} (${convs[0].contactName}) has ${convs.length} conversations:`);
      for (const conv of convs) {
        console.log(`  - Conv: ${conv.id} | Connection: ${conv.connectionId} | Status: ${conv.status}`);
      }
    }
  }

  console.log(`\nTotal contacts with duplicate conversations: ${dupesCount}`);
  process.exit(0);
}

run();
