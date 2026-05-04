// src/scripts/diagnose-webhook-errors.ts
import { db } from '@/lib/db';
import { connections, companies } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v20.0';

async function getAppAccessToken(appId: string, appSecret: string): Promise<string | null> {
    try {
        const url = `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok || !data.access_token) {
            console.log(`   ❌ App Token Error: ${JSON.stringify(data.error || data)}`);
            return null;
        }
        return data.access_token;
    } catch (error) {
        console.log(`   ❌ Network Error: ${(error as Error).message}`);
        return null;
    }
}

async function main() {
    console.log('=== DIAGNÓSTICO DE ERROS DE WEBHOOK ===\n');

    // 1. Get all Meta API connections
    const metaConnections = await db
        .select({
            id: connections.id,
            name: connections.config_name,
            connectionType: connections.connectionType,
            appId: connections.appId,
            appSecret: connections.appSecret,
            wabaId: connections.wabaId,
            companyId: connections.companyId,
            status: connections.status
        })
        .from(connections)
        .where(
            or(
                eq(connections.connectionType, 'meta_api'),
                eq(connections.connectionType, 'instagram')
            )
        );

    console.log(`📡 Conexões Meta API / Instagram encontradas: ${metaConnections.length}\n`);

    for (const conn of metaConnections) {
        console.log(`\n${'─'.repeat(70)}`);
        console.log(`🔌 ${conn.name} (${conn.connectionType})`);
        console.log(`   ID: ${conn.id}`);
        console.log(`   Status: ${conn.status}`);

        // Check appId
        if (!conn.appId) {
            console.log(`   ⚠️  App ID: MISSING`);
        } else {
            console.log(`   ✅ App ID: ${conn.appId}`);
        }

        // Check appSecret
        if (!conn.appSecret) {
            console.log(`   ⚠️  App Secret: MISSING`);
        } else {
            const decryptedSecret = decrypt(conn.appSecret);
            if (!decryptedSecret) {
                console.log(`   ❌ App Secret: DECRYPT FAILED (corrupted or wrong key)`);
            } else {
                console.log(`   ✅ App Secret: Configured (${decryptedSecret.substring(0, 8)}...)`);

                // Test App Token
                if (conn.appId) {
                    console.log(`   🔄 Testing App Access Token...`);
                    const token = await getAppAccessToken(conn.appId, decryptedSecret);
                    if (token) {
                        console.log(`   ✅ App Access Token: Valid`);

                        // Check webhook subscription
                        try {
                            const subUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${conn.appId}/subscriptions?access_token=${token}`;
                            const subResponse = await fetch(subUrl);
                            const subData = await subResponse.json();

                            if (subData.data && subData.data.length > 0) {
                                for (const sub of subData.data) {
                                    console.log(`   📡 Webhook: ${sub.object}`);
                                    console.log(`      Callback: ${sub.callback_url || 'NOT SET'}`);
                                    console.log(`      Fields: ${sub.subscribed_fields?.join(', ') || 'NONE'}`);
                                }
                            } else {
                                console.log(`   ⚠️  No webhook subscriptions found`);
                            }
                        } catch (error) {
                            console.log(`   ❌ Webhook check failed: ${(error as Error).message}`);
                        }
                    } else {
                        console.log(`   ❌ App Access Token: FAILED`);
                    }
                }
            }
        }

        // Check company webhook slug
        const [company] = await db.select({ slug: companies.webhookSlug }).from(companies).where(eq(companies.id, conn.companyId));
        if (!company?.slug) {
            console.log(`   ⚠️  Company Webhook Slug: MISSING`);
        } else {
            console.log(`   ✅ Company Webhook Slug: ${company.slug}`);
        }
    }

    console.log(`\n\n${'='.repeat(70)}`);
    console.log('=== FIM DO DIAGNÓSTICO ===');
    process.exit(0);
}

main().catch(console.error);
