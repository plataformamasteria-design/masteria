import { db } from './src/lib/db';
import { messages } from './src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function checkUnsupported() {
    console.log('Fetching unsupported messages...');
    const unsupportedMsgs = await db.query.messages.findMany({
        where: eq(messages.content, 'Mensagem não suportada'),
        orderBy: desc(messages.sentAt),
        limit: 10
    });

    for (const msg of unsupportedMsgs) {
        console.log(`\nMessage ID: ${msg.id}`);
        console.log(`Content: ${msg.content}`);
        console.log(`FromMe: ${msg.fromMe}`);
        if (msg.metaMessageData) {
             const rawData = typeof msg.metaMessageData === 'string' ? JSON.parse(msg.metaMessageData) : msg.metaMessageData;
             if (rawData.message) {
                 const keys = Object.keys(rawData.message);
                 console.log('Message keys:', keys);
                 for (const key of keys) {
                     if (key !== 'messageContextInfo') {
                         console.log(`Key ${key}:`, JSON.stringify(rawData.message[key]).substring(0, 200));
                     }
                 }
             } else {
                 console.log('No message object in raw data:', JSON.stringify(rawData).substring(0, 200));
             }
        }
    }
}

checkUnsupported();
