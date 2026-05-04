
import { db } from '../lib/db';
import { messages } from '../lib/db/schema';
import { desc, gt } from 'drizzle-orm';

async function checkRecentMessages() {
    console.log('🔍 Checking ALL messages received in the last hour...');
    
    // 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const msgs = await db.select()
        .from(messages)
        .where(gt(messages.sentAt, oneHourAgo))
        .orderBy(desc(messages.sentAt))
        .limit(20);

    if (msgs.length === 0) {
        console.log('❌ No messages received in the last hour.');
    } else {
        console.log(`✅ Found ${msgs.length} messages.`);
        msgs.forEach(m => {
            console.log(`📩 [${m.sentAt}] Sender: ${m.senderId} | Type: ${m.senderType} | Content: "${m.content?.substring(0, 50)}..."`);
        });
    }
    
    process.exit(0);
}

checkRecentMessages();
