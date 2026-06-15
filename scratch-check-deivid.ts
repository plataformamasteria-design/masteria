import 'dotenv/config';
import { db } from './src/lib/db';
import { contacts, conversations } from './src/lib/db/schema';
import { inArray, eq } from 'drizzle-orm';

async function run() {
  const foundContacts = await db.select().from(contacts).where(inArray(contacts.phone, ['65816213111020', '5515974035171']));
  console.log('Contacts:', foundContacts);

  for (const c of foundContacts) {
    const convs = await db.select().from(conversations).where(eq(conversations.contactId, c.id));
    console.log(`Conversations for contact ${c.id}:`, convs.map(conv => ({ id: conv.id, connectionId: conv.connectionId, status: conv.status, connectionType: conv.connectionType })));
  }

  process.exit(0);
}

run();
