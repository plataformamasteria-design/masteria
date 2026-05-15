const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
    try {
        const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
        const res = await client.query("SELECT * FROM connections WHERE company_id = $1 AND phone_number_id = '677001625502474'", [companyId]);
        console.table(res.rows.map(r => ({ id: r.id, name: r.name || r.id, has_token: !!r.meta_access_token, created: r.created_at })));
    } catch (e) {
        console.error('ERRO:', e.message);
    } finally {
        await client.end();
    }
});
