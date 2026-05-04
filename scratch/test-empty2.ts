import { db } from '../src/lib/db';
import { conversations, contacts, messages } from '../src/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

async function check() {
    const badConvos = await db.select({
        id: conversations.id,
        contactName: contacts.name,
        phone: contacts.phone,
        lastMessage: sql`(SELECT content FROM ${messages} WHERE conversation_id = ${conversations.id} LIMIT 1)`
    }).from(conversations)
      .innerJoin(contacts, sql`${conversations.contactId} = ${contacts.id}`)
      .orderBy(desc(conversations.createdAt))
      .limit(10);
      
    console.log(JSON.stringify(badConvos, null, 2));
    process.exit(0);
}
check();
