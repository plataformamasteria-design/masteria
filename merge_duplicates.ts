import { db } from './src/lib/db';
import { contacts, conversations, messages, kanbanLeads, whatsappDeliveryReports } from './src/lib/db/schema';
import { eq, inArray, sql, desc, and } from 'drizzle-orm';
import { getPhoneVariations, canonicalizeBrazilPhone } from './src/lib/utils';

async function mergeDuplicates() {
  console.log('Starting merge script...');
  const allContacts = await db.select().from(contacts);
  const byCompany: Record<string, any[]> = {};
  
  allContacts.forEach(c => {
    if (!byCompany[c.companyId]) byCompany[c.companyId] = [];
    byCompany[c.companyId].push(c);
  });

  for (const companyId of Object.keys(byCompany)) {
    const companyContacts = byCompany[companyId];
    console.log(`Processing company ${companyId} (${companyContacts.length} contacts)`);

    const groups: Record<string, any[]> = {};
    for (const c of companyContacts) {
      if (!c.phone) continue;
      const cleanPhone = c.phone.replace(/\D/g, '');
      const ddd = cleanPhone.substring(2, 4);
      let baseNumber = cleanPhone.substring(4);
      if (baseNumber.length === 9 && baseNumber.startsWith('9')) {
        baseNumber = baseNumber.substring(1);
      }
      const uniqueKey = `${cleanPhone.substring(0, 2)}${ddd}${baseNumber}`;
      if (!groups[uniqueKey]) groups[uniqueKey] = [];
      groups[uniqueKey].push(c);
    }

    for (const key of Object.keys(groups)) {
      const duplicates = groups[key];
      if (duplicates.length > 1) {
        // Sort by createdAt ASC (keep oldest as primary)
        duplicates.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const primary = duplicates[0];
        const toMerge = duplicates.slice(1);

        console.log(`Merging ${toMerge.length} contacts into ${primary.phone} (ID: ${primary.id})`);

        for (const duplicate of toMerge) {
          // Merge conversations
          await db.update(conversations).set({ contactId: primary.id }).where(eq(conversations.contactId, duplicate.id));
          await db.update(kanbanLeads).set({ contactId: primary.id }).where(eq(kanbanLeads.contactId, duplicate.id));
          await db.update(messages).set({ senderId: primary.id }).where(eq(messages.senderId, duplicate.id));
          await db.update(whatsappDeliveryReports).set({ contactId: primary.id }).where(eq(whatsappDeliveryReports.contactId, duplicate.id));

          // Delete duplicate contact
          await db.delete(contacts).where(eq(contacts.id, duplicate.id));
        }
      }
    }

    // Now merge duplicate conversations for the SAME contact
    const allConversations = await db.select().from(conversations).where(eq(conversations.companyId, companyId));
    const convGroups: Record<string, any[]> = {};
    for (const conv of allConversations) {
      if (!convGroups[conv.contactId]) convGroups[conv.contactId] = [];
      convGroups[conv.contactId].push(conv);
    }

    for (const contactId of Object.keys(convGroups)) {
      const convs = convGroups[contactId];
      if (convs.length > 1) {
        // Sort by lastMessageAt DESC (keep the most recently active one as primary)
        convs.sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime());
        const primaryConv = convs[0];
        const duplicateConvs = convs.slice(1);

        console.log(`Merging ${duplicateConvs.length} conversations into ${primaryConv.id} for contact ${contactId}`);

        for (const dupConv of duplicateConvs) {
          await db.update(messages).set({ conversationId: primaryConv.id }).where(eq(messages.conversationId, dupConv.id));
          await db.delete(conversations).where(eq(conversations.id, dupConv.id));
        }
      }
    }
  }
  console.log('Merge complete!');
  process.exit(0);
}

mergeDuplicates().catch(console.error);
