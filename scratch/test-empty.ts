import { db } from '../src/lib/db';
import { contacts, conversations, messages } from '../src/lib/db/schema';
import { eq, or, isNull, desc } from 'drizzle-orm';

async function check() {
    const res = await db.select().from(contacts).where(or(eq(contacts.name, ''), isNull(contacts.name), eq(contacts.phone, ''), isNull(contacts.phone))).limit(5);
    console.log("Empty Contacts:", JSON.stringify(res, null, 2));

    const badConvos = await db.select({
        id: conversations.id,
        contactName: contacts.name,
        phone: contacts.phone,
    }).from(conversations).innerJoin(contacts, eq(conversations.contactId, contacts.id)).orderBy(desc(conversations.createdAt)).limit(10);
    console.log("Recent convos:", JSON.stringify(badConvos, null, 2));

    process.exit(0);
}
check();
