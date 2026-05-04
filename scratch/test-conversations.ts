import { db } from '../src/lib/db';
import { conversations, contacts, messages, connections } from '../src/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

async function test() {
    const companyConversations = await db.select({
        id: conversations.id,
        status: conversations.status,
        contactId: contacts.id,
        contactName: contacts.name,
        phone: contacts.phone,
        lastMessage: sql<string | null>`(
                SELECT content 
                FROM ${messages} 
                WHERE ${messages.conversationId} = ${conversations.id} 
                AND ${messages.companyId} = ${conversations.companyId}
                ORDER BY ${messages.sentAt} DESC 
                LIMIT 1
            )`.as('last_message'),
        lastMessageAt: conversations.lastMessageAt,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(5);

    console.log(JSON.stringify(companyConversations, null, 2));
    process.exit(0);
}

test();
