const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });
c.connect().then(async () => {
    const r = await c.query("SELECT id, name, provider, model FROM ai_personas WHERE id = '68242b1c-fb13-4084-83b6-de3025d50801'");
    console.log('PERSONA:', JSON.stringify(r.rows[0], null, 2));
    const r2 = await c.query("SELECT id, provider, LENGTH(api_key) as key_len FROM ai_credentials WHERE company_id = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'");
    console.log('AI CREDS:', JSON.stringify(r2.rows, null, 2));
    await c.end();
}).catch(e => console.error(e.message));
