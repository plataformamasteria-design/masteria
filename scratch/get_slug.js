const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
    const res = await client.query("SELECT id, name, webhook_slug FROM companies WHERE id = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'");
    console.log(res.rows[0]);
    await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
