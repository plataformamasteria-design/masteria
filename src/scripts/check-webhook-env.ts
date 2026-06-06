
import { db } from '../lib/db';
import { companies } from '../lib/db/schema';

async function main() {
    console.log('--- Environment Check ---');
    console.log('REPLIT_DEV_DOMAIN:', process.env.REPLIT_DEV_DOMAIN || 'NOT SET');
    console.log('NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL || 'NOT SET');
    console.log('META_VERIFY_TOKEN:', process.env.META_VERIFY_TOKEN ? 'SET' : 'NOT SET');

    console.log('\n--- Company Check ---');
    const [company] = await db.select().from(companies).limit(1);

    if (company) {
        console.log('Company ID:', company.id);
        console.log('Webhook Slug:', company.webhookSlug);

        let baseUrl;
        if (process.env.REPLIT_DEV_DOMAIN) {
            baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
        } else if (process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL.includes('localhost')) {
            baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        } else {
            console.error('❌ NO VALID PUBLIC URL FOUND!');
            baseUrl = 'https://masteria.app';
        }

        const fullUrl = `${baseUrl}/api/webhooks/meta/${company.webhookSlug}`;
        console.log('Constructed Callback URL:', fullUrl);

        console.log('\n--- Connectivity Test (Self-Ping) ---');
        console.log('Attempting to GET the webhook URL (should return 400 or 403, or 200 with challenge)...');
        try {
            // We need to simulate a verification request if possible, or just hit the endpoint
            // GET requests to webhook endpoint typically handle hub.challenge
            const verifyUrl = `${fullUrl}?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=${process.env.META_VERIFY_TOKEN}`;
            const res = await fetch(verifyUrl);
            console.log(`Status: ${res.status}`);
            const text = await res.text();
            console.log(`Body: ${text}`);
            if (res.status === 200 && text === '12345') {
                console.log('✅ Webhook Endpoint IS REACHABLE and responding correctly to challenge!');
            } else {
                console.log('⚠️ Webhook Endpoint is reachable but response was unexpectedly:', text);
            }
        } catch (err) {
            console.error('❌ Failed to reach local webhook endpoint:', err);
        }

    } else {
        console.error('No company found.');
    }
}

main().catch(console.error).finally(() => process.exit(0));
