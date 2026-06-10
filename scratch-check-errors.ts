import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    const failedMessages = await db.execute(sql`
        SELECT m.id, m.content, m.failure_reason, m.sent_at, c.connection_type, c.config_name
        FROM messages m
        JOIN conversations cv ON m.conversation_id = cv.id
        JOIN connections c ON cv.connection_id = c.id
        WHERE m.status = 'FAILED' OR m.status = 'ERROR'
        ORDER BY m.sent_at DESC
        LIMIT 20
    `);

    console.log("Recent Failed Messages:");
    failedMessages.forEach(msg => {
        const dateStr = typeof msg.sent_at === 'string' ? msg.sent_at : (msg.sent_at as any).toISOString?.();
        console.log(`[${dateStr}] [${msg.connection_type} - ${msg.config_name}] Reason: ${msg.failure_reason?.substring(0, 100)}`);
    });
}
main().then(() => process.exit(0)).catch(console.error);
