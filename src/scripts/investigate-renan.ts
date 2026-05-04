
import { db } from '../lib/db';
import { messages } from '../lib/db/schema';
import { desc, gt } from 'drizzle-orm';

async function investigateRenan() {
    console.log('🔍 Checking ALL messages received in the last 24 hours...');
    
    // 24 hours ago just to be safe
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const msgs = await db.select()
        .from(messages)
        .where(gt(messages.sentAt, oneDayAgo))
        .orderBy(desc(messages.sentAt))
        .limit(20);

    if (msgs.length === 0) {
        console.log('❌ No messages received in the last 24 hours.');
    } else {
        console.log(`✅ Found ${msgs.length} messages.`);
        msgs.forEach(m => {
            console.log(`📩 [${m.sentAt}] SenderID: ${m.senderId} | Type: ${m.senderType} | Content: "${m.content?.substring(0, 50)}..."`);
        });
    }
    
    process.exit(0);
}

investigateRenan();
