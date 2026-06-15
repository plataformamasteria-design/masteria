import 'dotenv/config';
import { db } from './src/lib/db';
import { contacts, conversations } from './src/lib/db/schema';
import { eq, or } from 'drizzle-orm';

async function run() {
  const result = await db.select({
      id: contacts.id,
      phone: contacts.phone,
      name: contacts.name
  }).from(contacts).where(or(eq(contacts.name, 'Diego Abner'), eq(contacts.phone, '558892161399'), eq(contacts.phone, '556499526870')));
  console.log('Contacts:', result);

  for (const c of result) {
      const convs = await db.select({ id: conversations.id, status: conversations.status }).from(conversations).where(eq(conversations.contactId, c.id));
      console.log(`Convs for ${c.phone}:`, convs);
  }

  process.exit(0);
}
run();
