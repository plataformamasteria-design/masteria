
import { db } from '../lib/db';
import { connections } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '../lib/crypto';

// Tokens provided by user in Step 6070
const USER_TOKEN = 'EAAKbEIlAv7oBQQfqo8LaB0PPSEnJmaUrHlKdAJ9heG86arfP2XDntYkVCMPLOYbQ0PxdSouvR2PXo8Ad6aRhTPfZAK6Tv8f7mXku2JKgtLVraQnxKTF1RKVUbW6RVYr1QLkecmrM0b3AWYFfP4CZBuiepmDP0bVCFrqWUVDMJQNWtDPc6XfWogdQZDZD';
const CONNECTION_ID = 'c025e687-29eb-4589-b257-13c1349db630';

async function main() {
    console.log(`🔄 Updating connection ${CONNECTION_ID}...`);

    const encryptedToken = encrypt(USER_TOKEN);

    await db.update(connections)
        .set({
            accessToken: encryptedToken,
            isActive: true, // Fix "Saúde = Inativa"
            tokenLastRefreshed: new Date()
        })
        .where(eq(connections.id, CONNECTION_ID));

    console.log('✅ Connection updated!');
    console.log(' - Access Token refreshed');
    console.log(' - isActive set to TRUE');
}

main().catch(console.error).finally(() => process.exit(0));
