import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";
import { kanbanLeads, contacts, contactsToTags, tags, kanbanBoards, conversations, messages } from '../src/lib/db/schema';
import { asc, eq, and, inArray, min } from 'drizzle-orm';

async function fetchLeadsData(boardId: string) {
  const [board] = await db.select().from(kanbanBoards).where(eq(kanbanBoards.id, boardId));
  if (!board) throw new Error("Board not found");
  
  const companyId = board.companyId;

  const start = performance.now();
  const flatStart = performance.now();
  const flatLeadsAndContacts = await db
    .select({
      lead: kanbanLeads,
      contact: { id: contacts.id },
    })
    .from(kanbanLeads)
    .innerJoin(contacts, eq(kanbanLeads.contactId, contacts.id))
    .where(and(
      eq(kanbanLeads.boardId, boardId),
      eq(kanbanLeads.companyId, companyId),
      eq(contacts.companyId, companyId)
    ))
    .orderBy(asc(kanbanLeads.createdAt));
  console.log(`flatLeads fetched in ${performance.now() - flatStart}ms (${flatLeadsAndContacts.length} rows)`);

  const contactIds = flatLeadsAndContacts.map(row => row.contact?.id).filter(Boolean) as string[];

  let allConversations: any[] = [];
  if (contactIds.length > 0) {
    const convStart = performance.now();
    allConversations = await db
      .select({ conversationId: conversations.id })
      .from(conversations)
      .where(and(
        eq(conversations.companyId, companyId),
        inArray(conversations.contactId, contactIds)
      ));
    console.log(`conversations fetched in ${performance.now() - convStart}ms (${allConversations.length} rows)`);
  }

  const conversationIds = allConversations.map(c => c.conversationId).filter(Boolean) as string[];
  if (conversationIds.length > 0) {
    const msgStart = performance.now();
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
    console.log(`messages fetched in ${performance.now() - msgStart}ms (${firstMessages.length} rows)`);
  }
}

async function run() {
  const boardId = 'b8856169-d5ee-40ea-a876-20c8b46234cf';
  await fetchLeadsData(boardId);
}

run().catch(console.error).finally(() => process.exit(0));
