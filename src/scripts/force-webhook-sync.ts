
import { db } from '../lib/db';
import { connections, companies } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '../lib/crypto';

const CONNECTION_ID = 'c025e687-29eb-4589-b257-13c1349db630';

async function main() {
    console.log(`🔄 Forcing Webhook Sync for Connection: ${CONNECTION_ID}`);

    const [conn] = await db.select().from(connections).where(eq(connections.id, CONNECTION_ID));
    if (!conn) throw new Error("Connection not found");

    // Get Company for Slug
    const [company] = await db.select().from(companies).where(eq(companies.id, conn.companyId));
    if (!company) throw new Error("Company not found");

    const appId = conn.appId;
    const appSecret = decrypt(conn.appSecret || '');
    const verifyToken = process.env.META_VERIFY_TOKEN;

    // Build Callback URL
    let baseUrl = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) baseUrl = 'https://masteria.app'; // Fallback
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;

    const callbackUrl = `${baseUrl}/api/webhooks/meta/${company.webhookSlug}`;
    console.log(`URL: ${callbackUrl}`);

    // Get App Access Token
    console.log('🔑 Getting App Access Token...');
    const tokenUrl = `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
        console.error('❌ Failed to get App Token:', tokenData);
        return;
    }
    const appAccessToken = tokenData.access_token;

    // Delete Old Subscription
    console.log('🗑️ Deleting old subscription...');
    const deleteUrl = `https://graph.facebook.com/v24.0/${appId}/subscriptions?object=whatsapp_business_account&access_token=${appAccessToken}`;
    await fetch(deleteUrl, { method: 'DELETE' });

    // Create New Subscription
    console.log('🆕 Creating new subscription...');
    const form = new URLSearchParams();
    form.append('object', 'whatsapp_business_account');
    form.append('callback_url', callbackUrl);
    form.append('verify_token', verifyToken!);
    form.append('fields', 'messages,message_template_status_update,account_update');

    const createUrl = `https://graph.facebook.com/v24.0/${appId}/subscriptions?access_token=${appAccessToken}`;
    const createRes = await fetch(createUrl, { method: 'POST', body: form });
    const createData = await createRes.json();

    if (!createRes.ok) {
        console.error('❌ Subscription FAILED:', createData);
    } else {
        console.log('✅ Subscription SUCCESS:', createData);
    }
}

main().catch(console.error).finally(() => process.exit(0));
