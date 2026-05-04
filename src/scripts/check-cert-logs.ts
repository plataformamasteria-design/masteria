import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
}

const conn = postgres(DATABASE_URL);
const db = drizzle(conn);

async function checkRecentCertLogs() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    console.log('Checking Webhook logs since:', fiveMinutesAgo);

    const result = await db.execute(sql`
    SELECT id, payload, created_at
    FROM webhook_logs
    WHERE created_at >= ${fiveMinutesAgo}::timestamp
    ORDER BY created_at DESC
  `);

    console.log('\n=== Recent Webhook Logs ===');
    console.log('Total found:', result.length);

    result.forEach((log: any, i: number) => {
        console.log(`\n--- Log ${i + 1} ---`);
        console.log('ID:', log.id);
        console.log('Created at:', log.created_at);
        if (log.payload?.entry) {
            log.payload.entry.forEach((entry: any, j: number) => {
                if (entry.messaging) {
                    entry.messaging.forEach((msg: any, k: number) => {
                        const text = msg.message?.text;
                        console.log(`  Msg ${j}.${k}: "${text}"`);
                    });
                }
            });
        }
    });

    await conn.end();
}

checkRecentCertLogs().catch(console.error);
