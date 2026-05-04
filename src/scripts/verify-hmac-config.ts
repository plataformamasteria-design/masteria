/**
 * Script to verify HMAC configuration by inspecting the Instagram connection
 * and comparing with the FACEBOOK_CLIENT_SECRET environment variable.
 * 
 * This script MUST be run on the Replit server where ENCRYPTION_KEY is available.
 */

import 'dotenv/config';

async function main() {
    console.log('\n=== HMAC Configuration Verification ===\n');

    // Check environment variables
    const envClientSecret = process.env.FACEBOOK_CLIENT_SECRET;
    const encryptionKey = process.env.ENCRYPTION_KEY;

    console.log('📋 Environment Check:');
    console.log(`   FACEBOOK_CLIENT_SECRET: ${envClientSecret ? '✅ Present' : '❌ NOT SET'}`);

    if (!encryptionKey) {
        console.error('\n❌ ENCRYPTION_KEY is required. Run this script on Replit.');
        process.exit(1);
    }

    const { db } = await import('../lib/db');
    const { connections, companies, webhookLogs } = await import('../lib/db/schema');
    const { eq, desc } = await import('drizzle-orm');
    const { decrypt } = await import('../lib/crypto');

    // Find Instagram connection
    const instagramConnections = await db.select({
        id: connections.id,
        configName: connections.config_name,
        companyId: connections.companyId,
        appSecret: connections.appSecret,
        phoneNumberId: connections.phoneNumberId,
        isActive: connections.isActive
    })
        .from(connections)
        .where(eq(connections.connectionType, 'instagram'));

    console.log(`\n📸 Found ${instagramConnections.length} Instagram connection(s):\n`);

    for (const conn of instagramConnections) {
        console.log('───────────────────────────────────────');
        console.log(`Connection: ${conn.configName}`);
        console.log(`   ID: ${conn.id}`);
        console.log(`   Is Active: ${conn.isActive}`);

        // Get company webhook slug
        const [company] = await db.select({
            webhookSlug: companies.webhookSlug,
            name: companies.name
        }).from(companies).where(eq(companies.id, conn.companyId));

        if (company) {
            console.log(`   Company: ${company.name}`);
            console.log(`   Webhook Slug: ${company.webhookSlug}`);
        }

        // Analyze App Secret
        console.log('\n   🔐 App Secret Analysis:');
        if (!conn.appSecret) {
            console.log('   ❌ App Secret: NOT SET (null/empty) - HMAC will fail!');
        } else {
            console.log(`   📦 Encrypted Length: ${conn.appSecret.length} chars`);

            try {
                const decrypted = decrypt(conn.appSecret);
                if (decrypted) {
                    console.log(`   ✅ Decrypted: ${decrypted.substring(0, 4)}...${decrypted.substring(decrypted.length - 4)} (${decrypted.length} chars)`);

                    // Compare with environment
                    if (envClientSecret) {
                        if (decrypted === envClientSecret) {
                            console.log('   ✅ MATCH: Stored App Secret matches FACEBOOK_CLIENT_SECRET');
                        } else {
                            console.log('   ⚠️  MISMATCH!');
                            console.log(`      Stored:    ${decrypted.substring(0, 4)}...${decrypted.substring(decrypted.length - 4)}`);
                            console.log(`      Expected:  ${envClientSecret.substring(0, 4)}...${envClientSecret.substring(envClientSecret.length - 4)}`);
                            console.log('   ⚠️  This WILL cause HMAC validation failures!');
                            console.log('   💡 FIX: Update connection.appSecret with the correct encrypted value');
                        }
                    } else {
                        console.log('   ⚠️  Cannot compare: FACEBOOK_CLIENT_SECRET env var not set');
                    }
                } else {
                    console.log('   ❌ Decryption returned null/empty');
                }
            } catch (err: any) {
                console.log(`   ❌ Decryption FAILED: ${err.message}`);
            }
        }
    }

    // Check recent webhook logs for HMAC failures
    console.log('\n───────────────────────────────────────');
    console.log('📋 Recent Webhook Logs (Last 5):');

    const recentLogs = await db.select({
        id: webhookLogs.id,
        payload: webhookLogs.payload,
        createdAt: webhookLogs.createdAt
    })
        .from(webhookLogs)
        .orderBy(desc(webhookLogs.createdAt))
        .limit(5);

    for (const log of recentLogs) {
        const payload = log.payload as any;
        console.log(`\n   [${log.createdAt}]`);
        console.log(`   Object: ${payload?.object || 'unknown'}`);
        console.log(`   Entry Count: ${payload?.entry?.length || 0}`);
    }

    console.log('\n───────────────────────────────────────');
    console.log('🔍 HMAC Troubleshooting Summary:');
    console.log('   1. Meta signs webhooks using YOUR App Secret from the Meta App Dashboard');
    console.log('   2. The server MUST use the SAME App Secret to validate the signature');
    console.log('   3. If mismatched: Update connection.appSecret OR use FACEBOOK_CLIENT_SECRET env var directly');

    console.log('\n✅ Done\n');
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
