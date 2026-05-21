import { db } from './src/lib/db';
import { contacts, conversations } from './src/lib/db/schema';
import { eq, like } from 'drizzle-orm';

async function check() {
  const c = await db.select().from(contacts).where(like(contacts.name, '%Deivid Rodrigues%'));
  console.log('Contacts:', c);
  if (c.length > 0) {
     const convs = await db.select().from(conversations).where(eq(conversations.contactId, c[0].id));
     console.log('Conversations:', convs);
  }
  process.exit(0);
}
check().catch(console.error);
