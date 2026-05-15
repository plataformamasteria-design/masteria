require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const crypto = require('crypto');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '4edab1b04ecdae015204b556db32c047';
let key = Buffer.from(ENCRYPTION_KEY, 'utf-8');

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
        const newToken = 'EAAWZBb0ILajQBRXmRZAPIwZCDL9DgZC3ZCjcTPkcj5hOixzS2VDGGCEMmbFTQdPymvEJbTBXETu6ZCgjMHjTizwU1pcGeSidsUiHU5vZAlZAzVlWCzUunRKqDJAI01HQW493MDqZBnjqZBr8SWuBJ41zKEziqw30N98YPhbaWsZBtAybOSgXEVZC4WC3IgSDx0YBevDwmt4ppVSPWXojfOK8IlJW3uPS9JVZBwMGAWEBgadHCmZAAPaQ0ZCqXEVRZChZCQuFhRUzSfUGB5mAyVIdZBYsTrXGbNsmsDfgB6LSdbWgZDZD';
        
        const encryptedToken = encrypt(newToken);
        
        const res = await client.query("UPDATE connections SET access_token = $1 WHERE company_id = $2 AND connection_type = 'meta_api' RETURNING id", [encryptedToken, companyId]);
        console.log('Updated connection:', res.rows[0].id);
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await client.end();
    }
});
