require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const crypto = require('crypto');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '4edab1b04ecdae015204b556db32c047';
console.log('ENCRYPTION_KEY exists:', !!ENCRYPTION_KEY);
let key = Buffer.from(ENCRYPTION_KEY, 'utf-8');

function decrypt(encryptedHex) {
  if (!encryptedHex) return encryptedHex;
  try {
    const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
    const iv = encryptedBuffer.slice(0, IV_LENGTH);
    const authTag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = encryptedBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    return 'DECRYPT_ERROR: ' + error.message;
  }
}

const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
    try {
        const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
        const res = await client.query("SELECT access_token FROM connections WHERE company_id = $1 AND connection_type = 'meta_api'", [companyId]);
        const encrypted = res.rows[0].access_token;
        const decrypted = decrypt(encrypted);
        console.log('Decrypted token length:', decrypted.length);
        console.log('Decrypted starts with:', decrypted.substring(0, 5));
        console.log('Decrypted FULL (if error):', decrypted.startsWith('DECRYPT') ? decrypted : 'ok');
    } finally {
        await client.end();
    }
});
