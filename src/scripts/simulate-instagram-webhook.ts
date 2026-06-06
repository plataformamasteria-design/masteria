
import * as dotenv from 'dotenv';
import path from 'path';

// Force load env vars for DATABASE_URL
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// Ensure keys are present for logic
if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = 'pt?AFZHD}e4E<d2!R:~?WqLL}*Z>j3&rm';
}

import postgres from 'postgres';
import crypto from 'crypto';

// 1. Configuration
const INSTAGRAM_CONNECTION_NAME = 'Instagram - Disparo Perfeito';
const PAGE_ID = '223453144194155'; // Extracted from previous output
const SENDER_PSID = '1896097054661185';
const LOCAL_WEBHOOK_URL = 'https://masteria.app/api/webhooks/instagram';

// Inline Crypto (Same as before to guarantee execution)
function decryptInline(encryptedHex: string, keyString: string): string {
    if (!encryptedHex) return '';
    try {
        const ALGORITHM = 'aes-256-gcm';
        const IV_LENGTH = 16;
        const AUTH_TAG_LENGTH = 16;
        let key: Buffer;
        if (keyString.length === 32) { key = Buffer.from(keyString, 'utf-8'); } else { key = crypto.createHash('sha256').update(keyString).digest(); }
        const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
        const iv = encryptedBuffer.slice(0, IV_LENGTH);
        const authTag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = encryptedBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch (error) { return ''; }
}

async function simulateWebhook() {
    console.log('--- SIMULATING INSTAGRAM WEBHOOK ---');

    // 2. Fetch App Secret for HMAC Signature
    // We need to calculate X-Hub-Signature-256
    if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL missing'); return; }
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    let appSecret = '';
    try {
        const [conn] = await sql`SELECT app_secret FROM connections WHERE config_name = ${INSTAGRAM_CONNECTION_NAME} LIMIT 1`;
        if (conn && conn.app_secret) appSecret = conn.app_secret;
    } catch (e) {
        console.error('Failed to fetch App Secret:', e);
    } finally {
        await sql.end();
    }

    // If no app secret in DB, use a placeholder or fail. 
    // Usually webhooks verify signature. If our local dev server disables verification, it might pass.
    // But let's assume we need it. 
    // IF missing, we will try with a dummy one, but warn.
    if (!appSecret) {
        console.warn('⚠️ No App Secret found in DB for signature. Using "test-secret" (Likely validation will fail if enabled).');
        appSecret = 'test-secret';
    }

    // 3. Construct Payload
    const payload = {
        object: "instagram",
        entry: [
            {
                id: PAGE_ID,
                time: Date.now(),
                messaging: [
                    {
                        sender: { id: SENDER_PSID },
                        recipient: { id: PAGE_ID },
                        timestamp: Date.now(),
                        message: {
                            mid: "m_" + Date.now(),
                            text: "🔔 Simulation Test Message - " + new Date().toISOString()
                        }
                    }
                ]
            }
        ]
    };
    const payloadString = JSON.stringify(payload);

    // 4. Calculate Signature
    const signature = crypto.createHmac('sha256', appSecret).update(payloadString).digest('hex');

    console.log(`📤 Sending Webhook to: ${LOCAL_WEBHOOK_URL}`);
    console.log(`   X-Hub-Signature-256: sha256=${signature}`);

    try {
        const response = await fetch(LOCAL_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Hub-Signature-256': `sha256=${signature}`
            },
            body: payloadString
        });

        console.log(`\n📥 Response Code: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log(`   Response Body: ${text}`);

        if (response.ok) {
            console.log('\n✅ SUCCESS: Webhook Accepted!');
        } else {
            console.error('\n❌ FAILURE: Server rejected webhook.');
        }

    } catch (error) {
        console.error('\n❌ NETWORK ERROR (Is the server running?):', error);
        console.log('💡 Tip: Make sure `npm run dev` is running in another terminal.');
    }
}

simulateWebhook();
