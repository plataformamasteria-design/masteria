import { db } from './src/lib/db';
import { messages } from './src/lib/db/schema';
import { eq, ilike, and, desc, gte } from 'drizzle-orm';

async function main() {
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - 10); // check today

    // Find all link messages sent
    const linkMessages = await db.query.messages.findMany({
        where: and(
            ilike(messages.content, '%devzapp.com.br%'),
            gte(messages.sentAt, hoursAgo)
        )
    });

    console.log(`Found ${linkMessages.length} link messages sent today.`);

    let validCount = 0;
    let forcedCount = 0;

    for (const msg of linkMessages) {
        // Check if there's an inbound message with "ENTRAR" before this message in the same conversation
        const inboundMsgs = await db.query.messages.findMany({
            where: and(
                eq(messages.conversationId, msg.conversationId),
                eq(messages.senderType, 'CONTACT'),
                ilike(messages.content, '%ENTRAR%')
            )
        });

        const typedEntrar = inboundMsgs.some(m => m.sentAt < msg.sentAt);
        if (typedEntrar) {
            validCount++;
        } else {
            forcedCount++;
        }
    }

    console.log(`Leads who typed ENTRAR before link: ${validCount}`);
    console.log(`Leads who DID NOT type ENTRAR before link (forced): ${forcedCount}`);

}
main().then(() => process.exit(0)).catch(console.error);
