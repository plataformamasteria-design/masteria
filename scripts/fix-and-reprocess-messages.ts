// Script para reprocessar mensagens antigas que estavam classificadas incorretamente como USER
// E corrigir para CONTACT + disparar IA para responder

import { db } from '../src/lib/db';
import { messages, conversations, contacts, connections } from '../src/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { processIncomingMessageTrigger } from '../src/lib/automation-engine';

async function main() {
    console.log('🔧 Iniciando reprocessamento de mensagens classificadas incorretamente...\n');

    // Buscar conversas da conexão 8276 com última mensagem como USER (mas que são na verdade de clientes)
    const conversationsToFix = await db.execute(sql`
        SELECT 
            c.id as conversation_id,
            ct.name as contact_name,
            ct.phone as contact_phone,
            conn.config_name as connection_name,
            c.ai_active,
            m.id as message_id,
            m.content as message_content,
            m.sender_type,
            m.sent_at
        FROM conversations c
        JOIN contacts ct ON ct.id = c.contact_id
        JOIN connections conn ON conn.id = c.connection_id
        JOIN messages m ON m.conversation_id = c.id
        WHERE conn.config_name LIKE '%8276%'
        AND c.ai_active = true
        AND m.sender_type = 'USER'
        AND m.sent_at = (
            SELECT MAX(m2.sent_at) 
            FROM messages m2 
            WHERE m2.conversation_id = c.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM messages m3 
            WHERE m3.conversation_id = c.id 
            AND m3.sender_type = 'AI'
            AND m3.sent_at > m.sent_at - INTERVAL '1 minute'
        )
        ORDER BY m.sent_at DESC
        LIMIT 50
    `);

    const data = Array.isArray(conversationsToFix) ? conversationsToFix : (conversationsToFix as any)?.rows || [];

    console.log(`📋 Encontradas ${data.length} conversas para reprocessar:\n`);

    if (data.length === 0) {
        console.log('✅ Nenhuma conversa precisa ser reprocessada!');
        process.exit(0);
    }

    for (const row of data) {
        console.log('─'.repeat(60));
        console.log(`📞 ${row.contact_name} (${row.contact_phone})`);
        console.log(`   Mensagem: ${(row.message_content || '').substring(0, 50)}...`);
        console.log(`   Enviada em: ${row.sent_at}`);
        console.log(`   Corrigindo sender_type de USER para CONTACT...`);

        try {
            // Corrigir o sender_type da mensagem
            await db.update(messages)
                .set({ senderType: 'CONTACT' })
                .where(eq(messages.id, row.message_id));

            console.log(`   ✅ sender_type corrigido!`);
            console.log(`   🤖 Disparando processamento de IA...`);

            // Disparar o processamento de IA
            await processIncomingMessageTrigger(row.conversation_id, row.message_id);

            console.log(`   ✅ IA disparada com sucesso!`);
        } catch (error) {
            console.error(`   ❌ Erro ao processar: ${error}`);
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`✅ Reprocessamento concluído!`);
    console.log(`   ${data.length} mensagens corrigidas e enviadas para IA.`);

    // Aguardar um pouco para as respostas serem enviadas
    console.log('\n⏳ Aguardando 5 segundos para as respostas serem processadas...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    process.exit(0);
}

main().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});
