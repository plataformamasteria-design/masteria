require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const crypto = require('crypto');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'pt?AFZHD}e4E<d2!R:~?WqLL}*Z>j3&rm';

let key;
if (ENCRYPTION_KEY.length === 32) {
    key = Buffer.from(ENCRYPTION_KEY, 'utf-8');
} else {
    key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
    try {
        const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
        const newToken = 'EAAWZBb0ILajQBRd2j8aMh880ZCvD9Sjt6OcjJAZBZAXxMV2IP0KsWO0qnMqjZCYcZAoo7DVZCSJPxX6t8vEmmq56BDHjqArcHRsBHZC7x5V7jWZCmAFKRFPXkKE1bWJwSfL6gGCjofk55669ZAIAPZBOts5haZBEAZBt6EZBGukT3LCR2h4ZB8VlwEkIXEEZCEyGUtd28wZDZD';
        
        const encryptedToken = encrypt(newToken);
        
        const res = await client.query("UPDATE connections SET access_token = $1 WHERE company_id = $2 AND connection_type = 'meta_api' RETURNING id", [encryptedToken, companyId]);
        console.log('Updated connection:', res.rows[0].id);
        console.log('Successfully updated token in the database.');
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await client.end();
    }
});
