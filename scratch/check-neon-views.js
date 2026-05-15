require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
    try {
        const res = await client.query("SELECT * FROM information_schema.views WHERE table_name = 'vw_trafego_funil_mensal'");
        if (res.rows.length > 0) {
            console.log("View exists!");
        } else {
            console.log("View does NOT exist.");
        }
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await client.end();
    }
});
