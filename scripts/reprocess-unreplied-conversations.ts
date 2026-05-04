// Script para encontrar e reprocessar conversas sem resposta da IA
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import { processIncomingMessageTrigger } from '../src/lib/automation-engine';

const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

async function main() {
    console.log('🔍 Buscando conversas com mensagens de CONTACT não respondidas pela IA...\n');

    // Buscar conversas onde:
    // 1. A última mensagem é de CONTACT (cliente)
    // 2. Não há resposta de AI após essa mensagem
    // 3. aiActive = true na conversa
    const unrepliedResult = await db.execute(sql`
        WITH last_contact_messages AS (
            SELECT DISTINCT ON (m.conversation_id)
                m.id as message_id,
                m.conversation_id,
                m.content,
                m.sent_at,
                c.id as contact_id,
                c.name as contact_name,
                c.phone as contact_phone,
                conv.ai_active
            FROM messages m
            JOIN conversations conv ON conv.id = m.conversation_id
            JOIN contacts c ON c.id = conv.contact_id
            WHERE conv.company_id = ${COMPANY_ID}
            AND m.sender_type = 'CONTACT'
            AND conv.ai_active = true
            AND m.sent_at > NOW() - INTERVAL '7 days'
            ORDER BY m.conversation_id, m.sent_at DESC
        )
        SELECT 
            lcm.*,
            (
                SELECT COUNT(*) FROM messages ai_msg 
                WHERE ai_msg.conversation_id = lcm.conversation_id 
                AND ai_msg.sender_type = 'AI'
                AND ai_msg.sent_at > lcm.sent_at
            ) as ai_responses_after
        FROM last_contact_messages lcm
        WHERE NOT EXISTS (
            SELECT 1 FROM messages ai_msg 
            WHERE ai_msg.conversation_id = lcm.conversation_id 
            AND ai_msg.sender_type = 'AI'
            AND ai_msg.sent_at > lcm.sent_at
        )
        ORDER BY lcm.sent_at DESC
    `);

    const unreplied = Array.isArray(unrepliedResult) ? unrepliedResult : (unrepliedResult as any)?.rows || [];

    if (unreplied.length === 0) {
        console.log('✅ Todas as conversas ativas foram respondidas pela IA!');
        process.exit(0);
    }

    console.log(`📋 Encontradas ${unreplied.length} conversas sem resposta da IA:\n`);
    console.log('═'.repeat(60));

    for (const row of unreplied) {
        const preview = (row.content || '').substring(0, 50).replace(/\n/g, ' ');
        console.log(`\n📞 ${row.contact_name} (${row.contact_phone})`);
        console.log(`   Última msg: ${preview}...`);
        console.log(`   Data: ${new Date(row.sent_at).toLocaleString('pt-BR')}`);
        console.log(`   AI Active: ${row.ai_active ? '✅' : '❌'}`);

        console.log(`   🤖 Disparando IA...`);
        try {
            await processIncomingMessageTrigger(row.conversation_id, row.message_id, false);
            console.log(`   ✅ IA disparada com sucesso!`);
        } catch (err: any) {
            console.log(`   ❌ Erro: ${err.message}`);
        }

        // Delay entre processamentos
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`✅ Reprocessamento concluído! ${unreplied.length} conversas processadas.`);

    // Aguardar respostas serem enviadas
    console.log('\n⏳ Aguardando 10 segundos para as respostas serem processadas...');
    await new Promise(r => setTimeout(r, 10000));

    process.exit(0);
}

main().catch(err => {
    console.error('Erro:', err);
    process.exit(1);
});
