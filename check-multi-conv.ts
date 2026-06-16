import { db } from './src/lib/db/index.js';
import { conversations, contacts } from './src/lib/db/schema.js';
import { eq, and } from 'drizzle-orm';

async function check() {
  // Let's get all conversations for contact phone 5588920008007 in company 4c68abbe-d87e-41ea-9dc5-e812c48e0f79
  const c = await db.select().from(contacts).where(eq(contacts.phone, '5588920008007'));
  
  for (const contact of c) {
    const convs = await db.select().from(conversations).where(eq(conversations.contactId, contact.id));
    if (convs.length > 1) {
       console.log(`Company ${contact.companyId} has ${convs.length} conversations for this contact!`);
       console.log(convs.map(x => ({ id: x.id, status: x.status })));
    }
  }
  process.exit(0);
}
check();
