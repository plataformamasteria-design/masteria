import { db } from './src/lib/db';
import { conversations, contacts } from './src/lib/db/schema';
import { eq, ilike, desc } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const c = await db.query.contacts.findFirst({
    where: ilike(contacts.name, '%Anilton França%')
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
  
  console.log(`Conversation ID: ${conv.id}`);
  console.log(`aiActive: ${conv.aiActive}`);

  process.exit(0);
}

run().catch(console.error);
