import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log("Updating missing connection_ids on messages...");
    
    // Update messages to inherit the connection_id from their current conversation
    // This fixes messages that were inserted without connection_id or messages that were merged
    // from duplicated conversations.
    const res = await db.execute(sql`
        UPDATE messages m
        SET connection_id = c.connection_id
        FROM conversations c
        WHERE m.conversation_id = c.id
        AND (m.connection_id IS NULL OR m.connection_id != c.connection_id)
    `);
    
    console.log("Done. Updated rows.");
}
main().then(() => process.exit(0)).catch(console.error);
