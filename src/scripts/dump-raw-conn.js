
import postgres from 'postgres';
import 'dotenv/config';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!DATABASE_URL || !ENCRYPTION_KEY) {
    console.error('DATABASE_URL or ENCRYPTION_KEY missing.');
    process.exit(1);
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const key = ENCRYPTION_KEY.length === 32
    ? Buffer.from(ENCRYPTION_KEY, 'utf-8')
    : crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

function decrypt(encryptedHex) {
    if (!encryptedHex) return '';
    try {
        const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
        const iv = encryptedBuffer.slice(0, IV_LENGTH);
        const authTag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = encryptedBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (e) {
        return 'DECRYPTION_FAILED';
    }
}

async function main() {
    const sql = postgres(DATABASE_URL);

    try {
        const results = await sql`
            SELECT id, config_name, app_id, app_secret 
            FROM connections 
            WHERE config_name LIKE '1033_%' 
            LIMIT 1
        `;

        if (results.length === 0) {
            console.log('No connection starting with 1033_ found.');
            return;
        }

        const conn = results[0];
        console.log('--- Database Entry ---');
        console.log('ID:', conn.id);
        console.log('Name:', conn.config_name);
        console.log('App ID:', conn.app_id);

        const decryptedSecret = decrypt(conn.app_secret);
        console.log('App Secret (Decrypted):', decryptedSecret ? '[PRESENT]' : '[MISSING]');

        const expectedSecret = process.env.FACEBOOK_CLIENT_SECRET;
        if (expectedSecret && decryptedSecret === expectedSecret) {
            console.log('✅ Match! Stored secret matches environment variable.');
        } else if (!expectedSecret) {
            console.log('⚠️ Cannot verify - FACEBOOK_CLIENT_SECRET not set in environment.');
        } else {
            console.log('❌ Mismatch! Stored secret does not match environment variable.');
        }

    } catch (err) {
        console.error('Query failed:', err);
    } finally {
        await sql.end();
    }
}

main();
