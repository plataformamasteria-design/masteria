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

async function findMessageByContent() {
    console.log('Searching for message with content: "Opaaaa Vvvvv"');

    const result = await db.execute(sql`
    SELECT m.id, m.content, m.sender_type, m.status, m.sent_at, c.source
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE m.content LIKE '%Opaaaa Vvvvv%'
    ORDER BY m.sent_at DESC
    LIMIT 5
  `);

    console.log('\n=== Search Results ===');
    console.log('Total found:', result.length);

    if (result.length === 0) {
        console.log('Message not found in messages table.');
    } else {
        result.forEach((msg: any, i: number) => {
            console.log(`\n--- Match ${i + 1} ---`);
            console.log('ID:', msg.id);
            console.log('Content:', msg.content);
            console.log('Sender:', msg.sender_type);
            console.log('Status:', msg.status);
            console.log('Source:', msg.source);
            console.log('Sent at:', msg.sent_at);
        });
    }

    await conn.end();
}

findMessageByContent().catch(console.error);
