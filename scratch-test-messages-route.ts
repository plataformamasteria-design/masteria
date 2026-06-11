import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './src/lib/db';
import { conversations, messages } from './src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
    const companyId = 'YOUR_COMPANY_ID_HERE'; // We will just get a random conversation
    const conv = await db.query.conversations.findFirst();
    if (!conv) return console.log('no conv');
    
    console.log('Found conv:', conv.id, 'for contact:', conv.contactId);
    
    const contactConversations = await db.select({ id: conversations.id })
            .from(conversations)
            .where(eq(conversations.contactId, conv.contactId));
            
    const ids = contactConversations.map(c => c.id);
    console.log('Ids:', ids);
    
    try {
        const res = await db.select().from(messages).where(
            inArray(messages.conversationId, ids)
        );
        console.log('Messages count:', res.length);
    } catch(e: any) {
         console.error('ERROR IN SELECT:', e.message);
    }
}
main().then(()=>process.exit(0)).catch(console.error);
