import { db } from './src/lib/db';
import { kanbanLeads, contacts, contactsToTags, tags, kanbanBoards, conversations, messages } from './src/lib/db/schema';
import { asc, eq, and, inArray, min } from 'drizzle-orm';

async function main() {
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
  const boardId = '6bccc06c-4eb2-41e1-9c9d-5a133c267418';

  console.log('Testing fetchLeadsData...');

  const [board] = await db.select().from(kanbanBoards).where(and(
    eq(kanbanBoards.id, boardId),
    eq(kanbanBoards.companyId, companyId)
  ));
  
  if (!board) {
    console.log('Funil não encontrado.');
    process.exit(1);
  }

  const flatLeadsAndContacts = await db
    .select({
      lead: kanbanLeads,
      contact: {
        id: contacts.id,
        customFields: contacts.customFields
      },
    })
    .from(kanbanLeads)
    .innerJoin(contacts, eq(kanbanLeads.contactId, contacts.id))
    .where(and(
      eq(kanbanLeads.boardId, boardId),
      eq(kanbanLeads.companyId, companyId),
      eq(contacts.companyId, companyId)
    ))
    .orderBy(asc(kanbanLeads.createdAt));

  console.log(`Leads and contacts found: ${flatLeadsAndContacts.length}`);

  const contactIds = flatLeadsAndContacts.map(row => row.contact?.id).filter(Boolean) as string[];

  console.log(`Contact IDs: ${contactIds.length}`);

  if (contactIds.length > 0) {
    console.log('Fetching tags...');
    const allTags = await db
      .select({ 
          contactId: contactsToTags.contactId, 
          tag: { id: tags.id, name: tags.name, color: tags.color } 
      })
      .from(tags)
      .innerJoin(contactsToTags, eq(tags.id, contactsToTags.tagId))
      .where(and(
        eq(contactsToTags.companyId, companyId),
        inArray(contactsToTags.contactId, contactIds)
      ));
    console.log(`Tags found: ${allTags.length}`);
  }

  if (contactIds.length > 0) {
    console.log('Fetching conversations...');
    const allConversations = await db
      .select({
        contactId: conversations.contactId,
        conversationId: conversations.id,
      })
      .from(conversations)
      .where(and(
        eq(conversations.companyId, companyId),
        inArray(conversations.contactId, contactIds)
      ));
      console.log(`Conversations found: ${allConversations.length}`);
      
      const conversationIds = allConversations.map(c => c.conversationId).filter(Boolean) as string[];
      if (conversationIds.length > 0) {
          console.log('Fetching first messages...');
          const firstMessages = await db
            .select({
              conversationId: messages.conversationId,
              firstAt: min(messages.sentAt),
            })
            .from(messages)
            .where(and(
              eq(messages.companyId, companyId),
              inArray(messages.conversationId, conversationIds)
            ))
            .groupBy(messages.conversationId);
          console.log(`First messages found: ${firstMessages.length}`);
      }
  }

  console.log('Success!');
  process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
