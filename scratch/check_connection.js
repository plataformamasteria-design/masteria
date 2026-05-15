const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
    // Buscar a conexão pelo phoneNumberId
    const r = await client.query(`SELECT id, company_id, config_name, connection_type, phone_number_id, phone_number, waba_id, is_active, status, assigned_persona_id, LENGTH(access_token) as token_length FROM connections WHERE phone_number_id = '677001625502474' OR waba_id = '1126122359328176' LIMIT 3`);
    console.log('=== CONNECTIONS ===');
    console.log(JSON.stringify(r.rows, null, 2));
    
    // Buscar um contato ativo para testar envio
    if (r.rows[0]) {
        const connId = r.rows[0].id;
        const r2 = await client.query(`SELECT c.phone, c.name, cv.id as conversation_id FROM conversations cv JOIN contacts c ON cv.contact_id = c.id WHERE cv.connection_id = $1 AND c.phone NOT LIKE 'ig:%' ORDER BY cv.last_message_at DESC LIMIT 5`, [connId]);
        console.log('=== RECENT CONTACTS ===');
        console.log(JSON.stringify(r2.rows, null, 2));
    }
    
    await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
