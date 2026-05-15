const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
    const res = await client.query("SELECT id, name, phone FROM contacts WHERE phone LIKE '%88920008007%'");
    console.log('Contato com 9:', res.rows);
    await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
