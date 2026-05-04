// src/scripts/detailed-webhook-check.ts
import { db } from '@/lib/db';
import { connections, companies } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v20.0';

async function getAppAccessToken(appId: string, appSecret: string): Promise<string | null> {
    const url = `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || !data.access_token) {
        return null;
    }
    return data.access_token;
}

async function main() {
    console.log('=== DETAILED WEBHOOK CHECK ===\n');

    // Get expected base URL (como o código real faz)
    let baseUrl = '';
    if (process.env.REPLIT_DEV_DOMAIN) {
        baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    } else if (process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL.includes('localhost')) {
        baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    }

    console.log(`REPLIT_DEV_DOMAIN: ${process.env.REPLIT_DEV_DOMAIN || 'NOT SET'}`);
    console.log(`NEXT_PUBLIC_BASE_URL: ${process.env.NEXT_PUBLIC_BASE_URL || 'NOT SET'}`);
    console.log(`Calculated Base URL: ${baseUrl || 'CANNOT DETERMINE'}\n`);

    const metaConnections = await db.select({
        id: connections.id,
        name: connections.config_name,
        appId: connections.appId,
        appSecret: connections.appSecret,
        companyId: connections.companyId,
        connectionType: connections.connectionType
    }).from(connections).where(
        or(eq(connections.connectionType, 'meta_api'), eq(connections.connectionType, 'instagram'))
    );

    console.log(`Found ${metaConnections.length} Meta/Instagram connections\n`);

    for (const conn of metaConnections) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`CONNECTION: ${conn.name}`);
        console.log(`Type: ${conn.connectionType}`);
        console.log(`App ID: ${conn.appId}`);

        // Get company webhook slug
        const [company] = await db.select({ slug: companies.webhookSlug }).from(companies).where(eq(companies.id, conn.companyId));
        const companySlug = company?.slug || 'MISSING';
        console.log(`Company Webhook Slug: ${companySlug}`);

        const expectedUrl = baseUrl ? `${baseUrl}/api/webhooks/meta/${companySlug}` : 'CANNOT CALCULATE (no base URL)';
        console.log(`Expected Callback URL: ${expectedUrl}`);

        if (!conn.appId || !conn.appSecret) {
            console.log(`RESULT: MISSING APP_ID or APP_SECRET`);
            continue;
        }

        const secret = decrypt(conn.appSecret);
        if (!secret) {
            console.log(`RESULT: DECRYPT FAILED`);
            continue;
        }

        const token = await getAppAccessToken(conn.appId, secret);
        if (!token) {
            console.log(`RESULT: FAILED TO GET APP TOKEN`);
            continue;
        }

        // Get subscriptions from Meta
        const subUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${conn.appId}/subscriptions?access_token=${token}`;
        try {
            const response = await fetch(subUrl);
            const data = await response.json();

            if (!response.ok) {
                console.log(`RESULT: META API ERROR - ${JSON.stringify(data.error)}`);
                continue;
            }

            if (!data.data || data.data.length === 0) {
                console.log(`RESULT: NO SUBSCRIPTIONS CONFIGURED`);
                continue;
            }

            for (const sub of data.data) {
                console.log(`\n  Subscription Object: ${sub.object}`);
                console.log(`  Meta Callback URL: ${sub.callback_url || 'NOT SET'}`);
                console.log(`  Fields: ${sub.subscribed_fields?.join(', ') || 'NONE'}`);

                if (sub.callback_url === expectedUrl) {
                    console.log(`  STATUS: ✅ MATCH (OK)`);
                } else if (!sub.callback_url) {
                    console.log(`  STATUS: ❌ NOT CONFIGURED`);
                } else {
                    console.log(`  STATUS: ⚠️ DIVERGENTE`);
                    console.log(`\n  DIFFERENCE ANALYSIS:`);
                    console.log(`    Expected: ${expectedUrl}`);
                    console.log(`    Actual:   ${sub.callback_url}`);

                    // Analyze the difference
                    if (sub.callback_url.includes('localhost')) {
                        console.log(`    ISSUE: Meta has localhost URL (not publicly accessible)`);
                    } else if (sub.callback_url.includes('replit.dev') && expectedUrl.includes('replit.dev')) {
                        // Check if it's just a different subdomain
                        const actualDomain = sub.callback_url.split('/')[2];
                        const expectedDomain = expectedUrl.split('/')[2];
                        if (actualDomain !== expectedDomain) {
                            console.log(`    ISSUE: Different Replit domain`);
                            console.log(`      Actual domain: ${actualDomain}`);
                            console.log(`      Expected domain: ${expectedDomain}`);
                        }
                    } else if (sub.callback_url.includes('kirK') || expectedUrl.includes('kirK')) {
                        console.log(`    NOTE: URL contains 'kirK' which is the current Replit dev domain`);
                    }
                }
            }
        } catch (error) {
            console.log(`RESULT: NETWORK ERROR - ${(error as Error).message}`);
        }
    }

    console.log(`\n\n${'='.repeat(80)}`);
    console.log('=== DONE ===');
    process.exit(0);
}

main().catch(console.error);
