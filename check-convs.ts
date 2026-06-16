import { db } from './src/lib/db/index.js';
import { contacts, conversations } from './src/lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function checkConversations() {
  const c = await db.select().from(contacts).where(eq(contacts.phone, '5588920008007'));
  console.log(`Found ${c.length} contacts with phone 5588920008007`);
  
  if (c.length > 0) {
      const contactId = c[0].id;
      const convs = await db.select().from(conversations).where(eq(conversations.contactId, contactId));
      console.log(`Found ${convs.length} conversations for contact ${contactId}`);
      console.log(convs.map(x => ({
          id: x.id,
          status: x.status,
          connectionId: x.connectionId,
          createdAt: x.createdAt
      })));
  }
  process.exit(0);
}
checkConversations().catch(console.error);
