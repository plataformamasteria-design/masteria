import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './src/lib/db';
import { conversations, messages } from './src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
    const id = '5b131382-484a-4ee9-b8f3-040f42ca9aff';
    const conv = await db.query.conversations.findFirst({ where: eq(conversations.id, id) });
    console.log("CONV:", conv);
    if (!conv) return;

    const contactConversations = await db.select({ id: conversations.id })
            .from(conversations)
            .where(eq(conversations.contactId, conv.contactId));
    
    console.log("Contact convs:", contactConversations);
    
    const ids = contactConversations.map(c => c.id);
    console.log("IDs:", ids);

    const res = await db.select().from(messages).where(
        inArray(messages.conversationId, ids)
    ).limit(5);
    console.log("Messages found:", res.length);
}
main().then(()=>process.exit(0)).catch(console.error);
