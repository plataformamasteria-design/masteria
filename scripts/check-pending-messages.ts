// Script simplificado para identificar conversas pendentes
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🔍 Buscando conversas com mensagens não respondidas...\n');

    // Query direta - retorna array direto
    const rows = await db.execute(sql`
        SELECT 
            c.id as conversation_id,
            ct.name as contact_name,
            ct.phone as contact_phone,
            conn.config_name as connection_name,
            c.ai_active,
            c.last_message_at,
            (SELECT m.sender_type FROM messages m WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC LIMIT 1) as last_sender,
            (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC LIMIT 1) as last_content
        FROM conversations c
        LEFT JOIN contacts ct ON ct.id = c.contact_id
        LEFT JOIN connections conn ON conn.id = c.connection_id
        WHERE c.ai_active = true
        ORDER BY c.last_message_at DESC
        LIMIT 100
    `);

    // db.execute retorna diretamente o array
    const data = Array.isArray(rows) ? rows : (rows as any)?.rows || [];

    console.log(`📋 Encontradas ${data.length} conversas nas últimas 8 horas:\n`);

    let pendingCount = 0;
    const pendingConversations: string[] = [];

    for (const row of data) {
        const needsResponse = row.last_sender === 'CONTACT';
        if (needsResponse) {
            pendingCount++;
            pendingConversations.push(row.conversation_id as string);
        }

        console.log('─'.repeat(60));
        console.log(`📞 ${row.contact_name || row.contact_phone || 'N/A'}`);
        console.log(`   Conexão: ${row.connection_name}`);
        console.log(`   aiActive: ${row.ai_active ? '✅' : '❌'}`);
        console.log(`   Última msg: ${row.last_message_at}`);
        console.log(`   Último remetente: ${row.last_sender}`);
        console.log(`   ⚠️ Precisa resposta: ${needsResponse ? '🔴 SIM' : '🟢 NÃO'}`);
        console.log(`   Conteúdo: ${(row.last_content as string || '').substring(0, 60)}...`);
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`📊 RESUMO:`);
    console.log(`   Total de conversas recentes: ${data.length}`);
    console.log(`   🔴 Pendentes de resposta: ${pendingCount}`);

    if (pendingConversations.length > 0) {
        console.log(`\n🔧 IDs das conversas pendentes:`);
        for (const id of pendingConversations) {
            console.log(`   - ${id}`);
        }
    }

    process.exit(0);
}

main().catch(console.error);
