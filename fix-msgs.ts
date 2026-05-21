import { db } from './src/lib/db'; 
import { messages, conversations } from './src/lib/db/schema'; 
import { isNull, eq, and } from 'drizzle-orm'; 

async function run() { 
    const convos = await db.select().from(conversations); 
    for (const c of convos) { 
        if (!c.connectionId) continue;
        await db.update(messages).set({ connectionId: c.connectionId }).where(and(eq(messages.conversationId, c.id), isNull(messages.connectionId))); 
    } 
    console.log('Fixed old messages!'); 
    process.exit(0); 
} 
run();
