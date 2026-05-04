// src/scripts/check-webhook-urls.ts
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
        console.log(`Token Error: ${JSON.stringify(data.error || data)}`);
        return null;
    }
    return data.access_token;
}

async function main() {
    console.log('=== CHECK WEBHOOK URLS ===\n');

    // Get expected base URL
    let baseUrl = '';
    if (process.env.REPLIT_DEV_DOMAIN) {
        baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    } else if (process.env.NEXT_PUBLIC_BASE_URL) {
        baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    }
    console.log(`Expected Base URL: ${baseUrl || 'NOT SET'}\n`);

    const metaConnections = await db.select({
        id: connections.id,
        name: connections.config_name,
        appId: connections.appId,
        appSecret: connections.appSecret,
        companyId: connections.companyId
    }).from(connections).where(
        or(eq(connections.connectionType, 'meta_api'), eq(connections.connectionType, 'instagram'))
    );

    for (const conn of metaConnections) {
        console.log(`\n--- ${conn.name} ---`);

        const [company] = await db.select({ slug: companies.webhookSlug }).from(companies).where(eq(companies.id, conn.companyId));
        const expectedUrl = company?.slug ? `${baseUrl}/api/webhooks/meta/${company.slug}` : 'MISSING SLUG';
        console.log(`Expected URL: ${expectedUrl}`);

        if (!conn.appId || !conn.appSecret) {
            console.log(`Missing appId/appSecret`);
            continue;
        }

        const secret = decrypt(conn.appSecret);
        if (!secret) {
            console.log(`Decrypt failed`);
            continue;
        }

        const token = await getAppAccessToken(conn.appId, secret);
        if (!token) {
            console.log(`Failed to get token`);
            continue;
        }

        const subUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${conn.appId}/subscriptions?access_token=${token}`;
        const response = await fetch(subUrl);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            for (const sub of data.data) {
                const metaUrl = sub.callback_url || 'NOT SET';
                const match = metaUrl === expectedUrl;
                console.log(`Meta Callback: ${metaUrl}`);
                console.log(`Match: ${match ? 'YES' : 'NO (DIVERGENTE)'}`);
                if (!match) {
                    console.log(`\n  DIFFERENCE:`);
                    console.log(`    Expected: ${expectedUrl}`);
                    console.log(`    Actual:   ${metaUrl}`);
                }
            }
        } else {
            console.log(`No subscriptions found`);
        }
    }

    console.log('\n=== DONE ===');
    process.exit(0);
}
main().catch(console.error);
