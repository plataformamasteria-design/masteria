import { db } from './src/lib/db';
import { contacts, conversations, messages, contactsToTags } from './src/lib/db/schema';
import { eq, and, sql, asc } from 'drizzle-orm';
import { canonicalizeBrazilPhone } from './src/lib/utils';

async function mergeDuplicates() {
  const allContacts = await db.select().from(contacts);
  const byPhone = new Map();
  for (const c of allContacts) {
    if (!c.phone) continue;
    const can = canonicalizeBrazilPhone(c.phone);
    if (!byPhone.has(can)) byPhone.set(can, []);
    byPhone.get(can).push(c);
  }
  
  for (const [phone, list] of byPhone.entries()) {
    if (list.length > 1) {
      // Sort by created at ascending (keep oldest as primary)
      list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      const primary = list[0];
      console.log('Merging phone', phone, 'keeping', primary.id);
      
      for (let i = 1; i < list.length; i++) {
        const dup = list[i];
        // Move conversations
        await db.update(conversations).set({ contactId: primary.id }).where(eq(conversations.contactId, dup.id));
        // Move tags
        await db.update(contactsToTags).set({ contactId: primary.id }).where(eq(contactsToTags.contactId, dup.id)).catch(() => {});
        // Delete dup
        await db.delete(contacts).where(eq(contacts.id, dup.id));
        console.log('Deleted duplicate contact', dup.id);
      }
    }
  }
  
  // Now merge duplicate conversations for the same contact
  const allConvos = await db.select().from(conversations);
  const byContact = new Map();
  for (const c of allConvos) {
    if (!byContact.has(c.contactId)) byContact.set(c.contactId, []);
    byContact.get(c.contactId).push(c);
  }
  
  for (const [contactId, list] of byContact.entries()) {
    if (list.length > 1) {
      list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      const primaryConv = list[0];
      console.log('Merging convos for contact', contactId, 'keeping', primaryConv.id);
      
      for (let i = 1; i < list.length; i++) {
        const dup = list[i];
        // Move messages
        await db.update(messages).set({ conversationId: primaryConv.id }).where(eq(messages.conversationId, dup.id));
        // Update connection if newer
        if (new Date(dup.lastMessageAt || 0) > new Date(primaryConv.lastMessageAt || 0)) {
           await db.update(conversations).set({ lastMessageAt: dup.lastMessageAt, connectionId: dup.connectionId }).where(eq(conversations.id, primaryConv.id));
        }
        await db.delete(conversations).where(eq(conversations.id, dup.id));
      }
    }
  }
  
  console.log('Done merging duplicates!');
  process.exit(0);
}
mergeDuplicates().catch(console.error);
