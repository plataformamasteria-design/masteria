import { db } from '../src/lib/db';
import { messages, conversations, contacts, connections } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
    const conversationId = 'd4c909b7-e720-4ca7-af11-cffaba2c780e';
    
    const conversation = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
        with: {
            contact: true,
            connection: true,
        }
    });

    if (!conversation) {
        console.log('Conversation not found.');
        process.exit(0);
    }

    console.log('--- CONVERSATION ---');
    console.log('Company ID:', conversation.companyId);
    console.log('Contact:', conversation.contact?.name, conversation.contact?.phone);
    console.log('Connection:', conversation.connection?.config_name);
    
    console.log('\n--- RECENT MESSAGES ---');
    const recentMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: [desc(messages.sentAt)],
        limit: 10
    });

    for (const msg of recentMessages.reverse()) {
        console.log(`[${msg.sentAt?.toISOString()}] ${msg.senderType}: ${msg.content?.substring(0, 50)}...`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
