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

async function checkRecentCertMessages() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    console.log('Checking for certification messages since:', fiveMinutesAgo);

    const result = await db.execute(sql`
    SELECT id, content, sender_type, sent_at, provider_message_id
    FROM messages
    WHERE content LIKE '%CERTIFICAÇÃO%' OR content LIKE '%CERTIFICA%'
    ORDER BY sent_at DESC
  `);

    console.log('\n=== Certification Sync Results ===');
    console.log('Total found:', result.length);

    result.forEach((msg: any, i: number) => {
        console.log(`\n--- Message ${i + 1} ---`);
        console.log('ID:', msg.id);
        console.log('Content:', msg.content);
        console.log('Sender Type:', msg.sender_type);
        console.log('Sent at:', msg.sent_at);
    });

    await conn.end();
}

checkRecentCertMessages().catch(console.error);
