/**
 * Script to inspect the Instagram connection and its App Secret configuration
 * to diagnose HMAC signature mismatch issues
 */

import 'dotenv/config';

async function main() {
    console.log('\n=== Instagram Connection App Secret Inspector ===\n');

    // Check environment variable
    const envClientSecret = process.env.FACEBOOK_CLIENT_SECRET;
    console.log('📋 Environment Check:');
    console.log(`   FACEBOOK_CLIENT_SECRET: ${envClientSecret ? `${envClientSecret.substring(0, 4)}...${envClientSecret.substring(envClientSecret.length - 4)} (${envClientSecret.length} chars)` : 'NOT SET'}`);

    // Dynamic imports
    const { db } = await import('../lib/db');
    const { connections, companies } = await import('../lib/db/schema');
    const { eq, and } = await import('drizzle-orm');
    const { decrypt } = await import('../lib/crypto');

    // Find Instagram connections
    const instagramConnections = await db.select({
        id: connections.id,
        configName: connections.config_name,
        connectionType: connections.connectionType,
        companyId: connections.companyId,
        appId: connections.appId,
        appSecret: connections.appSecret,
        accessToken: connections.accessToken,
        phoneNumberId: connections.phoneNumberId,
        isActive: connections.isActive,
        createdAt: connections.createdAt
    })
        .from(connections)
        .where(eq(connections.connectionType, 'instagram'));

    console.log(`\n📸 Found ${instagramConnections.length} Instagram connection(s):\n`);

    for (const conn of instagramConnections) {
        console.log('───────────────────────────────────────');
        console.log(`Connection: ${conn.configName}`);
        console.log(`   ID: ${conn.id}`);
        console.log(`   Company ID: ${conn.companyId}`);
        console.log(`   Phone Number ID (Instagram Account ID): ${conn.phoneNumberId}`);
        console.log(`   App ID: ${conn.appId || 'NOT SET'}`);
        console.log(`   Is Active: ${conn.isActive}`);
        console.log(`   Created At: ${conn.createdAt}`);

        // Check App Secret
        console.log('\n   App Secret Analysis:');
        if (!conn.appSecret) {
            console.log('   ❌ App Secret: NOT SET (null/empty)');
        } else {
            console.log(`   📦 Encrypted App Secret Length: ${conn.appSecret.length} chars`);
            console.log(`   📦 Encrypted App Secret Preview: ${conn.appSecret.substring(0, 20)}...`);

            try {
                const decrypted = decrypt(conn.appSecret);
                if (decrypted) {
                    console.log(`   ✅ Decrypted App Secret: ${decrypted.substring(0, 4)}...${decrypted.substring(decrypted.length - 4)} (${decrypted.length} chars)`);

                    // Compare with environment
                    if (envClientSecret) {
                        if (decrypted === envClientSecret) {
                            console.log('   ✅ Matches FACEBOOK_CLIENT_SECRET environment variable');
                        } else {
                            console.log('   ⚠️  DOES NOT MATCH FACEBOOK_CLIENT_SECRET environment variable!');
                            console.log(`      Stored: ${decrypted.substring(0, 4)}...${decrypted.substring(decrypted.length - 4)}`);
                            console.log(`      Env:    ${envClientSecret.substring(0, 4)}...${envClientSecret.substring(envClientSecret.length - 4)}`);
                        }
                    }
                } else {
                    console.log('   ❌ Decryption returned null/empty');
                }
            } catch (err: any) {
                console.log(`   ❌ Decryption FAILED: ${err.message}`);
            }
        }

        // Check company slug
        const [company] = await db.select({
            id: companies.id,
            name: companies.name,
            webhookSlug: companies.webhookSlug
        })
            .from(companies)
            .where(eq(companies.id, conn.companyId));

        if (company) {
            console.log(`\n   Company: ${company.name}`);
            console.log(`   Webhook Slug: ${company.webhookSlug}`);
            console.log(`   Expected Webhook URL: /api/webhooks/meta/${company.webhookSlug}`);
        }
    }

    console.log('\n───────────────────────────────────────');
    console.log('\n🔍 Diagnosis:');
    console.log('   - Meta signs webhook payloads using YOUR App Secret configured in the Meta App Dashboard');
    console.log('   - The App Secret used for HMAC validation MUST match the one in Meta App Dashboard');
    console.log('   - If there is a mismatch, update the connection.appSecret to the correct value');

    console.log('\n✅ Done\n');
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
