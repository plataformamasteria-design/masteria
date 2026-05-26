import { db } from '../src/lib/db';
import { conversations, contactsToContactLists } from '../src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const listId = '88cb53b2-56b6-4c6f-9baf-43a676602b80'; // A Mesa Disparo
  
  // 1. Get contact IDs in the list
  const listLinks = await db.select({ contactId: contactsToContactLists.contactId })
                            .from(contactsToContactLists)
                            .where(eq(contactsToContactLists.listId, listId));
  
  const contactIds = listLinks.map(l => l.contactId).filter(Boolean) as string[];
  console.log(`Found ${contactIds.length} leads in "A Mesa Disparo".`);
  
  if (contactIds.length === 0) {
      console.log('No leads found.');
      process.exit(0);
  }

  // 2. Find conversations for these contacts
  const convs = await db.select({ id: conversations.id, aiActive: conversations.aiActive })
                        .from(conversations)
                        .where(inArray(conversations.contactId, contactIds));
  
  console.log(`Found ${convs.length} conversations for these leads.`);
  const toUpdate = convs.filter(c => !c.aiActive).map(c => c.id);
  console.log(`Found ${toUpdate.length} conversations where bot is inactive.`);

  // 3. Update them to aiActive = true
  if (toUpdate.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < toUpdate.length; i += batchSize) {
          const batch = toUpdate.slice(i, i + batchSize);
          await db.update(conversations)
                  .set({ aiActive: true })
                  .where(inArray(conversations.id, batch));
          console.log(`Updated batch ${i / batchSize + 1}`);
      }
      console.log(`Successfully activated bot for ${toUpdate.length} conversations!`);
  } else {
      console.log('All bots are already active or no conversations to update.');
  }
  
  process.exit(0);
}

main().catch(console.error);
