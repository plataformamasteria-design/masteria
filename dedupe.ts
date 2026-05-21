import { db } from './src/lib/db';
import { contacts, conversations, messages, kanbanLeads, contactsToTags } from './src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getPhoneVariations } from './src/lib/utils';

async function mergeDuplicates() {
  const allContacts = await db.select({ id: contacts.id, phone: contacts.phone, companyId: contacts.companyId }).from(contacts);
  const byPhone = new Map();
  for (const c of allContacts) {
     if (!c.phone) continue;
     const variations = getPhoneVariations(c.phone);
     // Try to find if any variation exists in byPhone
     let foundKey = null;
     for (const v of variations) {
       if (byPhone.has(v)) {
         foundKey = v;
         break;
       }
     }
     if (foundKey) {
       byPhone.get(foundKey).push(c);
     } else {
       byPhone.set(variations[0], [c]);
     }
  }

  let mergedCount = 0;
  for (const [phone, group] of byPhone.entries()) {
    if (group.length > 1) {
       console.log('Found duplicates for', phone, group.length);
       const primary = group[0];
       const duplicates = group.slice(1).map(c => c.id);
       
       // Re-assign conversations
       await db.update(conversations).set({ contactId: primary.id }).where(inArray(conversations.contactId, duplicates));
       // Delete tags for duplicates
       await db.delete(contactsToTags).where(inArray(contactsToTags.contactId, duplicates));
       
       // Delete duplicates
       await db.delete(contacts).where(inArray(contacts.id, duplicates));
       mergedCount++;
    }
  }
  console.log('Merged', mergedCount, 'contact groups');
  process.exit(0);
}
mergeDuplicates().catch(console.error);
