const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
    try {
        const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
        const res = await client.query("SELECT id, config_name, access_token, phone_number_id, waba_id, is_active FROM connections WHERE company_id = $1 AND connection_type = 'meta_api'", [companyId]);
        console.table(res.rows.map(r => ({ id: r.id, name: r.config_name, has_token: !!r.access_token, phone: r.phone_number_id, waba: r.waba_id, active: r.is_active })));
    } catch (e) {
        console.error('ERRO:', e.message);
    } finally {
        await client.end();
    }
});
