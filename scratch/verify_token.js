const { Client } = require('pg');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Usar a mesma ENCRYPTION_KEY do .env
const ENCRYPTION_KEY = 'pt?AFZHD}e4E<d2!R:~?WqLL}*Z>j3&rm';
let key;
if (ENCRYPTION_KEY.length === 32) {
    key = Buffer.from(ENCRYPTION_KEY, 'utf-8');
} else {
    key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

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
        console.error("Decryption failed:", error.message);
        return '';
    }
}

function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
    const r = await client.query(`SELECT id, access_token FROM connections WHERE id = '81994284-e8f0-4a2b-b17b-a9440a0d563a'`);
    const conn = r.rows[0];
    
    console.log('=== TOKEN FROM DB ===');
    console.log('Encrypted length:', conn.access_token.length);
    console.log('First 50 chars:', conn.access_token.substring(0, 50));
    
    const decrypted = decrypt(conn.access_token);
    console.log('\n=== DECRYPTED TOKEN ===');
    console.log('Decrypted length:', decrypted.length);
    console.log('First 30 chars:', decrypted.substring(0, 30));
    console.log('Is empty?', decrypted === '');
    
    // Comparar com o token fornecido pelo user
    const expectedToken = 'EAAWZBb0ILajQBRUAwJld9pT89bZBYWKzfx9Jx6bfqNCJ0YNocCiIZBoNLgyUgLjXZBRhhMSHCzJjbIseMUepRXbvV44qawuOTwAoLHnIMrH3tzpo6T0eht6ZAPCaHzLKELzo7nh3XH6Be3AhhdP8F9gySCvgSeZCmuQOqsXtQIchf8OL6vSFPZAbop0YBrmBExyIJ12wFK7TjfHlCZBi50hGodPF43K5utrYpGnP2EZA9drOw6DcnXyIovasb5jQFzjuQewYDiDMuEDxhJftex1sTXjBCsT0DfMZARmAZDZD';
    
    if (decrypted === expectedToken) {
        console.log('\n✅ TOKEN MATCHES! O token armazenado é idêntico ao fornecido.');
    } else if (decrypted === '') {
        console.log('\n❌ DECRYPTION FAILED! Token não pode ser descriptografado.');
        console.log('Atualizando o token no banco com o novo valor...');
        
        const newEncrypted = encrypt(expectedToken);
        await client.query(`UPDATE connections SET access_token = $1 WHERE id = '81994284-e8f0-4a2b-b17b-a9440a0d563a'`, [newEncrypted]);
        console.log('✅ Token atualizado com sucesso!');
        
        // Verificar se a re-encriptação funciona
        const verify = decrypt(newEncrypted);
        console.log('Verificação pós-update:', verify === expectedToken ? '✅ OK' : '❌ FALHA');
    } else {
        console.log('\n⚠️ TOKEN DIFFERENT! O token armazenado é diferente do fornecido.');
        console.log('Stored (first 30):', decrypted.substring(0, 30));
        console.log('Expected (first 30):', expectedToken.substring(0, 30));
    }
    
    await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
