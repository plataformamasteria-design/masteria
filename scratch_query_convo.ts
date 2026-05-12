import { db } from './src/lib/db';
import { conversations, contacts } from './src/lib/db/schema';
import { desc, eq, and } from 'drizzle-orm';

async function run() {
  try {
    const contactPhone = '558892161399';
    const contactResult = await db.select().from(contacts).where(eq(contacts.phone, contactPhone)).limit(1);
    const contact = contactResult[0];

    const convos = await db.select().from(conversations).where(eq(conversations.contactId, contact.id));
    console.log(convos.map(c => ({ id: c.id, connectionId: c.connectionId })));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
