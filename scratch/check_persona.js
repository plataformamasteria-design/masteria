const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
    // Buscar a persona atribuída à conexão
    const r = await client.query(`
        SELECT p.id, p.name, p.provider, p.model, p.is_active
        FROM ai_personas p
        WHERE p.id = '68242b1c-fb13-4084-83b6-de3025d50801'
    `);
    console.log('=== PERSONA ASSIGNED TO CONNECTION ===');
    console.log(JSON.stringify(r.rows[0], null, 2));

    // Verificar AI credentials da empresa
    const r2 = await client.query(`
        SELECT id, provider, LENGTH(api_key) as key_length, is_active, created_at
        FROM ai_credentials
        WHERE company_id = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'
    `);
    console.log('\n=== AI CREDENTIALS FOR COMPANY ===');
    console.log(JSON.stringify(r2.rows, null, 2));

    // Verificar se o webhook está retornando status 'failed' para mensagens enviadas
    const r3 = await client.query(`
        SELECT id, status, content, provider_message_id, sent_at
        FROM messages
        WHERE company_id = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'
          AND sender_type = 'AGENT'
          AND status = 'failed'
        ORDER BY sent_at DESC
        LIMIT 5
    `);
    console.log('\n=== FAILED AGENT MESSAGES ===');
    for (const row of r3.rows) {
        console.log(`${row.sent_at?.toISOString()} | Status: ${row.status} | MsgId: ${row.provider_message_id || 'NULL'}`);
        console.log(`  Content: ${(row.content || '').substring(0, 80)}`);
    }

    await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
