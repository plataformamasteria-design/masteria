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

async function checkConnection() {
    const recipientId = '17841401066086910';
    console.log(`Checking connection for recipientId: ${recipientId}`);

    const result = await db.execute(sql`
    SELECT id, company_id, connection_type, phone_number_id, is_active
    FROM connections
    WHERE phone_number_id = ${recipientId} OR id = ${recipientId}
  `);

    console.log('\n=== Connection Details ===');
    console.log(JSON.stringify(result, null, 2));

    if (result.length > 0) {
        const firstResult = result[0] as any;
        const companyId = firstResult.company_id;
        console.log(`\nChecking health events for connection ${firstResult.id}...`);
        const health = await db.execute(sql`
      SELECT status, error_message, validated_at
      FROM meta_webhook_health_events
      WHERE connection_id = ${firstResult.id}
      ORDER BY validated_at DESC
      LIMIT 10
    `);
        console.log('\n=== Health Events ===');
        console.log(JSON.stringify(health, null, 2));
    }

    await conn.end();
}

checkConnection().catch(console.error);
