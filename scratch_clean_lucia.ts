import { db } from './src/lib/db';
import { eq, like, or, ilike } from 'drizzle-orm';
import { contacts, conversations, messages } from './src/lib/db/schema';

async function run() {
  console.log("Cleaning Lucia's conversations and contacts...");

  // Usar ilike para case-insensitive search
  const luciaContacts = await db
    .select()
    .from(contacts)
    .where(ilike(contacts.name, '%Lucia%'));
    
  console.log('Found contacts:', luciaContacts.map(c => c.name));

  for (const contact of luciaContacts) {
    const luciaConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.contactId, contact.id));
      
    for (const conv of luciaConversations) {
      console.log('Deleting messages for conversation:', conv.id);
      await db.delete(messages).where(eq(messages.conversationId, conv.id));
      
      console.log('Deleting conversation:', conv.id);
      await db.delete(conversations).where(eq(conversations.id, conv.id));
    }
    
    console.log('Deleting contact:', contact.name, contact.id);
    await db.delete(contacts).where(eq(contacts.id, contact.id));
  }
  
  console.log("Cleanup finalizado.");
  process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
