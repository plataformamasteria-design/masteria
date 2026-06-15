import 'dotenv/config';
import { db } from './src/lib/db';
import { conversations, contacts } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const result = await db.select({
      conv: conversations,
      contact: contacts
  }).from(conversations).leftJoin(contacts, eq(conversations.contactId, contacts.id)).where(eq(conversations.id, 'd9d69692-827c-447a-9694-8d7cfe8c9b00'));
  console.log('Conv:', result);
  process.exit(0);
}
run();
