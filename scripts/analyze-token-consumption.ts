// Script para analisar consumo médio de tokens por conversa/mensagem
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('📊 Analisando consumo de tokens da Empresa de Desenvolvimento Master...\n');

    const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

    // 1. Total de tokens usados este mês
    const quotaResult = await db.execute(sql`
        SELECT current_ai_tokens_month, max_ai_tokens
        FROM company_quotas
        WHERE company_id = ${COMPANY_ID}
    `);
    const quota = (Array.isArray(quotaResult) ? quotaResult[0] : (quotaResult as any)?.rows?.[0]) || {};
    const totalTokens = quota.current_ai_tokens_month || 0;

    // 2. Contar mensagens de IA deste mês
    const msgCountResult = await db.execute(sql`
        SELECT COUNT(*) as ai_messages
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE c.company_id = ${COMPANY_ID}
        AND m.sender_type = 'AI'
        AND m.sent_at >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    const aiMessages = Number((Array.isArray(msgCountResult) ? msgCountResult[0] : (msgCountResult as any)?.rows?.[0])?.ai_messages || 0);

    // 3. Contar conversas distintas com IA este mês
    const convoCountResult = await db.execute(sql`
        SELECT COUNT(DISTINCT m.conversation_id) as conversations
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE c.company_id = ${COMPANY_ID}
        AND m.sender_type = 'AI'
        AND m.sent_at >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    const conversationsWithAI = Number((Array.isArray(convoCountResult) ? convoCountResult[0] : (convoCountResult as any)?.rows?.[0])?.conversations || 0);

    // 4. Média de mensagens IA por conversa
    const avgMessagesPerConvo = conversationsWithAI > 0 ? (aiMessages / conversationsWithAI).toFixed(1) : 0;

    // 5. Tokens médios por mensagem IA
    const tokensPerMessage = aiMessages > 0 ? Math.round(totalTokens / aiMessages) : 0;

    // 6. Tokens médios por conversa
    const tokensPerConversation = conversationsWithAI > 0 ? Math.round(totalTokens / conversationsWithAI) : 0;

    // 7. Amostra de mensagens IA recentes com tamanho
    const sampleResult = await db.execute(sql`
        SELECT 
            m.content,
            LENGTH(m.content) as content_length,
            ct.name as contact_name,
            m.sent_at
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        JOIN contacts ct ON ct.id = c.contact_id
        WHERE c.company_id = ${COMPANY_ID}
        AND m.sender_type = 'AI'
        ORDER BY m.sent_at DESC
        LIMIT 10
    `);
    const samples = Array.isArray(sampleResult) ? sampleResult : (sampleResult as any)?.rows || [];

    console.log('═'.repeat(70));
    console.log('📈 RESUMO DE CONSUMO DE TOKENS (Este Mês)');
    console.log('═'.repeat(70));
    console.log(`\n🔢 Total de tokens consumidos: ${totalTokens.toLocaleString()}`);
    console.log(`🤖 Mensagens de IA enviadas: ${aiMessages.toLocaleString()}`);
    console.log(`💬 Conversas com IA: ${conversationsWithAI.toLocaleString()}`);
    console.log(`📊 Média de mensagens IA por conversa: ${avgMessagesPerConvo}`);

    console.log('\n' + '─'.repeat(70));
    console.log('💰 CONSUMO MÉDIO');
    console.log('─'.repeat(70));
    console.log(`📝 Tokens por MENSAGEM IA: ~${tokensPerMessage.toLocaleString()} tokens`);
    console.log(`💬 Tokens por CONVERSA: ~${tokensPerConversation.toLocaleString()} tokens`);

    console.log('\n' + '─'.repeat(70));
    console.log('📜 AMOSTRA DE RESPOSTAS RECENTES');
    console.log('─'.repeat(70));
    for (const s of samples.slice(0, 5)) {
        const preview = (s.content || '').substring(0, 60).replace(/\n/g, ' ');
        console.log(`\n👤 ${s.contact_name}`);
        console.log(`   Tamanho: ${s.content_length} caracteres`);
        console.log(`   Preview: ${preview}...`);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('📊 PROJEÇÃO');
    console.log('═'.repeat(70));
    const tokensFor1000Msgs = tokensPerMessage * 1000;
    const tokensFor1000Convos = tokensPerConversation * 1000;
    console.log(`\n📮 1.000 mensagens IA = ~${tokensFor1000Msgs.toLocaleString()} tokens`);
    console.log(`💬 1.000 conversas = ~${tokensFor1000Convos.toLocaleString()} tokens`);
    console.log(`\n🎯 Com 2.000.000 tokens você pode fazer:`);
    console.log(`   - ~${Math.floor(2000000 / tokensPerMessage).toLocaleString()} mensagens IA`);
    console.log(`   - ~${Math.floor(2000000 / tokensPerConversation).toLocaleString()} conversas completas`);

    process.exit(0);
}

main().catch(err => {
    console.error('Erro:', err);
    process.exit(1);
});
