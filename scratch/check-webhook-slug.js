require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

console.log("NEXT_PUBLIC_BASE_URL:", process.env.NEXT_PUBLIC_BASE_URL);

const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
    try {
        const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
        const res = await client.query("SELECT webhook_slug FROM companies WHERE id = $1", [companyId]);
        console.log('Company:', res.rows[0]);
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await client.end();
    }
});
