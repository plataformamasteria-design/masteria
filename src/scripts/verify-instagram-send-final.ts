
import * as dotenv from 'dotenv';
import path from 'path';

// Force load env vars BEFORE other imports that might use them (like crypto.ts)
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// Manually set if missing (Safety net for verification script)
if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = 'pt?AFZHD}e4E<d2!R:~?WqLL}*Z>j3&rm';
}

import postgres from 'postgres';
import crypto from 'crypto';

const RECIPIENT_ID = '1896097054661185';
const INSTAGRAM_CONNECTION_NAME = 'Instagram - Disparo Perfeito';

// Inline decryption to avoid module loading issues with env vars
function decryptInline(encryptedHex: string, keyString: string): string {
    if (!encryptedHex) return '';
    try {
        const ALGORITHM = 'aes-256-gcm';
        const IV_LENGTH = 16;
        const AUTH_TAG_LENGTH = 16;

        let key: Buffer;
        if (keyString.length === 32) {
            key = Buffer.from(keyString, 'utf-8');
        } else {
            key = crypto.createHash('sha256').update(keyString).digest();
        }

        const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
        const iv = encryptedBuffer.slice(0, IV_LENGTH);
        const authTag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = encryptedBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

        return decrypted.toString('utf8');
    } catch (error) {
        console.error("Inline Decryption failed:", error);
        return '';
    }
}

async function verifyInstagramSend() {
    console.log('--- STARTING INSTAGRAM SEND VERIFICATION ---');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is missing!');
        return;
    }

    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    try {
        // 1. Fetch Connection
        const [connection] = await sql`
            SELECT * FROM connections 
            WHERE config_name = ${INSTAGRAM_CONNECTION_NAME}
            LIMIT 1
        `;

        if (!connection) {
            console.error(`❌ Connection '${INSTAGRAM_CONNECTION_NAME}' not found!`);
            await sql.end();
            return;
        }

        console.log(`✅ Found Connection: ${connection.config_name}`);
        console.log(`   ID: ${connection.id}`);
        console.log(`   WABA ID (Page ID): ${connection.waba_id}`); // Note: snake_case for raw result

        // 2. Decrypt Token
        let accessToken = '';
        if (connection.access_token) {
            accessToken = decryptInline(connection.access_token, process.env.ENCRYPTION_KEY!);
            console.log('✅ Access Token Decrypted Successfully');
            console.log(`   Token Prefix: ${accessToken.substring(0, 15)}...`);
        } else {
            console.error('❌ Access Token is NULL in DB');
            await sql.end();
            return;
        }

        // 3. Send Message via Graph API (Page Endpoint)
        // URL Pattern: https://graph.facebook.com/v24.0/{page-id}/messages
        const pageId = connection.waba_id; // Using wabaId as PageID per architectural decision
        const url = `https://graph.facebook.com/v24.0/${pageId}/messages`;

        const payload = {
            recipient: { id: RECIPIENT_ID },
            message: { text: "🔍 Final Verification Test - Jan 5 2026 - Agent 8" },
            access_token: accessToken
        };

        console.log(`\n📤 Sending Request to: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            console.log('\n📥 Response Received:');
            console.log(JSON.stringify(data, null, 2));

            if (response.ok && data.recipient_id) {
                console.log('\n✅ SUCCESS: Message Sent Successfully!');
                console.log(`   Recipient: ${data.recipient_id}`);
                console.log(`   Message ID: ${data.message_id}`);
            } else {
                console.error('\n❌ FAILURE: Meta API returned error.');
            }

        } catch (error) {
            console.error('\n❌ NETWORK ERROR:', error);
        }

    } catch (dbError) {
        console.error('❌ Database Error:', dbError);
    } finally {
        await sql.end();
    }
}

verifyInstagramSend();
