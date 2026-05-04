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

async function extractPayload() {
    const logId = 'abd7c768-7a32-47b4-b9b9-80d9fab5aa62';
    console.log(`Extracting payload for logId: ${logId}`);

    const result = await db.execute(sql`
    SELECT payload, company_id
    FROM webhook_logs
    WHERE id = ${logId}
  `);

    if (result.length > 0) {
        console.log('--- PAYLOAD START ---');
        console.log(JSON.stringify(result[0]!.payload, null, 2));
        console.log('--- PAYLOAD END ---');
        console.log('Company ID:', result[0]!.company_id);
    } else {
        console.log('Log not found.');
    }

    await conn.end();
}

extractPayload().catch(console.error);
