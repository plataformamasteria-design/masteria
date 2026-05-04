
import { processIncomingMessageTrigger } from '../lib/automation-engine';
import { db } from '../lib/db';
import { messages } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function manualTrigger() {
    const messageId = '9c48aec8-893b-4c20-973f-c8d20225bff0';
    const conversationId = 'b15c2118-6744-4871-a89b-cfe020109900';

    console.log(`🚀 Manually triggering automation for message ${messageId}...`);

    try {
        // Verify message exists first
        const [msg] = await db.select().from(messages).where(eq(messages.id, messageId));
        if (!msg) {
            console.error('❌ Message not found!');
            return;
        }
        console.log('✅ Message found in DB.');

        await processIncomingMessageTrigger(conversationId, messageId);
        console.log('✅ Trigger function completed.');
    } catch (error) {
        console.error('❌ Error executing trigger:', error);
    }
}

manualTrigger().catch(console.error).finally(() => process.exit());
