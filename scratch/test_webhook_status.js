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

function decrypt(text) {
  if (!text) return text;
  const buffer = Buffer.from(text, 'hex');
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

const fetch = require('node-fetch');

async function getAppAccessToken(appId, appSecret) {
    const url = `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || !data.access_token) {
        throw new Error("Não foi possível obter o Token de Acesso do Aplicativo: " + JSON.stringify(data));
    }
    return data.access_token;
}

async function testWebhookStatus() {
    const appId = '1616759942244916';
    const encryptedSecret = 'efc5e69427d91956d1376aa127ab2f82f1e63ce009246f1a783af8d38440943270aa7562b511f9c41e462cab6ff0b08e735a302c4149054cbf3db641c0e08d80';
    
    try {
        const appSecret = decrypt(encryptedSecret);
        console.log("Decrypted App Secret:", appSecret);
        
        const appAccessToken = await getAppAccessToken(appId, appSecret);
        console.log("Got app access token successfully");
        
        const url = `https://graph.facebook.com/v20.0/${appId}/subscriptions?access_token=${appAccessToken}&fields=object,callback_url,subscribed_fields`;
        const response = await fetch(url);
        const data = await response.json();
        
        console.log("Subscriptions Data:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("TEST FAILED:", e.message);
    }
}

testWebhookStatus();
