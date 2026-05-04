
import { db } from '../lib/db';
import { connections } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '../lib/crypto';
import 'dotenv/config';

// The secret from environment variable (REQUIRED)
const USER_PROVIDED_SECRET = process.env.FACEBOOK_CLIENT_SECRET;
if (!USER_PROVIDED_SECRET) {
    console.error('❌ FACEBOOK_CLIENT_SECRET not set in environment');
    process.exit(1);
}
const CONNECTION_ID = 'c025e687-29eb-4589-b257-13c1349db630';

async function main() {
    console.log(`Checking secret for connection: ${CONNECTION_ID}`);
    const [conn] = await db.select().from(connections).where(eq(connections.id, CONNECTION_ID));

    if (!conn) {
        console.error('Connection not found');
        return;
    }

    if (!conn.appSecret) {
        console.error('❌ App Secret is MISSING in database!');
    } else {
        try {
            const dbSecret = decrypt(conn.appSecret);
            if (dbSecret === USER_PROVIDED_SECRET) {
                console.log('✅ App Secret matches the user-provided secret.');
            } else {
                console.error('❌ App Secret MISMATCH!');
                console.log(`DB has: ${dbSecret.substring(0, 4)}...`);
                console.log(`User provided: ${USER_PROVIDED_SECRET.substring(0, 4)}...`);
            }
        } catch (e) {
            console.error('❌ Failed to decrypt stored secret.');
        }
    }
}

main().catch(console.error).finally(() => process.exit(0));
