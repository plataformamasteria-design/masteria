import { config } from 'dotenv';
config({ path: '.env.local' });

import { evaluateMessageTriggers } from '../lib/flow-engine';
import { db } from '../lib/db';
import { conversations, messages } from '../lib/db/schema';
import { desc } from 'drizzle-orm';

async function main() {
    console.log('Testing trigger evaluation...');
    
    // Pick the most recent message to test
    const latestMessage = await db.query.messages.findFirst({
        orderBy: [desc(messages.createdAt)]
    });

    if (!latestMessage) {
        console.log('No message found in DB to test.');
        process.exit(0);
    }

    const conv = await db.query.conversations.findFirst({
        where: (c, { eq }) => eq(c.id, latestMessage.conversationId as string)
    });

    if (!conv) {
        console.log('No conversation found for message.');
        process.exit(0);
    }

    console.log(`Using message ${latestMessage.id} from conversation ${conv.id}`);
    
    const companyId = conv.companyId;
    const contactId = conv.contactId;

    await evaluateMessageTriggers(companyId, contactId, latestMessage);
    
    console.log('Finished testing.');
    process.exit(0);
}

main().catch(console.error);
