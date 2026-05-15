const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
    // Buscar logs de automação recentes com ERRO para esta conexão
    const r = await client.query(`
        SELECT al.level, al.message, al.details, al.created_at 
        FROM automation_logs al 
        WHERE al.company_id = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'
          AND (al.level = 'ERROR' OR al.message LIKE '%falha%' OR al.message LIKE '%erro%' OR al.message LIKE '%Falha%')
        ORDER BY al.created_at DESC 
        LIMIT 15
    `);
    console.log('=== RECENT ERROR LOGS ===');
    for (const row of r.rows) {
        console.log(`[${row.level}] ${row.created_at.toISOString()} - ${row.message}`);
        if (row.details && Object.keys(row.details).length > 0) {
            console.log('  Details:', JSON.stringify(row.details).substring(0, 200));
        }
    }
    
    // Buscar últimas mensagens enviadas pela IA/AGENT nesta empresa
    const r2 = await client.query(`
        SELECT m.id, m.sender_type, m.status, m.content, m.sent_at, m.provider_message_id, cv.connection_id
        FROM messages m
        JOIN conversations cv ON m.conversation_id = cv.id
        WHERE m.company_id = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'
          AND m.sender_type IN ('AI', 'AGENT', 'BOT')
        ORDER BY m.sent_at DESC
        LIMIT 10
    `);
    console.log('\n=== RECENT AI/AGENT MESSAGES ===');
    for (const row of r2.rows) {
        console.log(`[${row.sender_type}] ${row.sent_at?.toISOString()} - Status: ${row.status} - ConnID: ${row.connection_id}`);
        console.log(`  Content: ${(row.content || '').substring(0, 100)}`);
        console.log(`  ProviderMsgId: ${row.provider_message_id || 'NULL'}`);
    }

    // Verificar logs do flow engine
    const r3 = await client.query(`
        SELECT ael.node_type, ael.status, ael.message, ael.output_data, ael.created_at
        FROM automation_execution_logs ael
        WHERE ael.company_id = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'
          AND (ael.status = 'error' OR ael.node_type LIKE '%send%')
        ORDER BY ael.created_at DESC
        LIMIT 10
    `);
    console.log('\n=== FLOW ENGINE SEND/ERROR LOGS ===');
    for (const row of r3.rows) {
        console.log(`[${row.node_type}] ${row.status} - ${row.created_at?.toISOString()}`);
        console.log(`  Message: ${row.message || 'N/A'}`);
        if (row.output_data) console.log(`  Output: ${JSON.stringify(row.output_data).substring(0, 200)}`);
    }
    
    await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
