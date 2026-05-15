const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
    const r1 = await client.query(`
        SELECT id, content, status, provider_message_id, sent_at
        FROM messages 
        WHERE content LIKE 'Teste de envio via API%' 
           OR provider_message_id = 'wamid.HBgMNTU2NDk5NTI2ODcwFQIAERgSQzBEMzE4NzEyNkUxMzE4RkJCAA=='
        ORDER BY sent_at DESC LIMIT 5
    `);
    console.log('=== MY RECENT TEST MESSAGES ===');
    console.log(JSON.stringify(r1.rows, null, 2));

    const r2 = await client.query(`
        SELECT id, content, status, provider_message_id, sent_at, failure_reason
        FROM messages 
        WHERE company_id = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'
          AND sender_type = 'AGENT'
          AND status = 'failed'
        ORDER BY sent_at DESC LIMIT 5
    `);
    console.log('\n=== FAILED MESSAGES IN DB ===');
    console.log(JSON.stringify(r2.rows, null, 2));

    await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
