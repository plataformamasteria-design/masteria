import { db } from '../lib/db';
import { connections } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '../lib/crypto';

async function main() {
    const connectionId = 'c025e687-29eb-4589-b257-13c1349db630';

    // Using Token 4 from the user's earlier message
    const newToken = 'EAAKbEIlAv7oBQRSE8eTyZB47mEaZAQ8ku9TWpy8dZAQPZAQirE9jw6I8RJoquLwcMTVQgIZC4FTjo3OCUFQ9WbCHWYc95FWMPK2nAMAWbTVIqtw7IO5NYenasOcZAstWEBRvcQZBJoswMwfzySrSwPySFG8P0MPZCm3mQXkEndF3UdZBqP5ttDwtvZCQwWJ7Se0u6F9ZCWvmxS86dsyh3829289OB657qLegZCUZD';

    console.log('🔄 Updating access token for connection:', connectionId);

    // First, verify the token is valid
    console.log('🔍 Verifying new token...');
    const testUrl = `https://graph.facebook.com/v24.0/me?access_token=${newToken}`;
    const testResponse = await fetch(testUrl);
    const testData = await testResponse.json();

    if (!testResponse.ok) {
        console.error('❌ Token validation failed:', testData.error);
        throw new Error(`Invalid token: ${testData.error?.message}`);
    }

    console.log('✅ Token is valid! Account ID:', testData.id);

    // Encrypt and update
    const encryptedToken = encrypt(newToken);

    const [updated] = await db.update(connections)
        .set({
            accessToken: encryptedToken,
            status: 'connected',
            isActive: true,
            lastConnected: new Date()
        })
        .where(eq(connections.id, connectionId))
        .returning();

    if (updated) {
        console.log('✅ Connection updated successfully!');
        console.log('   Name:', updated.config_name);
        console.log('   Status:', updated.status);
        console.log('   Is Active:', updated.isActive);
        console.log('   Last Connected:', updated.lastConnected);
    } else {
        console.error('❌ Failed to update connection: Connection not found.');
    }
}

main().catch(console.error).finally(() => process.exit(0));
