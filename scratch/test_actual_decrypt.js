require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
require('ts-node/register'); // if ts-node is available, or we can compile

const { decrypt } = require('./src/lib/crypto.ts');
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
    try {
        const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
        const res = await client.query("SELECT access_token FROM connections WHERE company_id = $1 AND connection_type = 'meta_api'", [companyId]);
        const encrypted = res.rows[0].access_token;
        const decrypted = decrypt(encrypted);
        console.log('Decrypted token:', decrypted);
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await client.end();
    }
});
