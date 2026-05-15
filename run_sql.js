const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client(process.env.DATABASE_URL);
    await client.connect();
    const res = await client.query(process.argv[2]);
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
}
run().catch(console.error);
