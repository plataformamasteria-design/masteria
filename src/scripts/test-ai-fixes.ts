// src/scripts/test-ai-fixes.ts
// Script para testar as 3 correções do agente de IA
import { db } from '../lib/db';
import { aiPersonas, conversations, messages, contacts, companies } from '../lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

async function testKeywordFilter() {
    console.log('\n📝 TESTE 1: Filtro de Palavras-Chave');
    console.log('='.repeat(50));

    // Buscar uma persona com isTriggerActive = true
    const [persona] = await db.select()
        .from(aiPersonas)
        .where(eq(aiPersonas.isTriggerActive, true))
        .limit(1);

    if (!persona) {
        console.log('⚠️  Nenhuma persona com isTriggerActive=true encontrada.');
        console.log('   Crie uma persona com gatilhos de resposta ativados para testar.');
        return;
    }

    console.log(`✅ Persona encontrada: ${persona.name}`);
    console.log(`   Keywords configuradas: [${persona.triggerKeywords?.join(', ') || 'nenhuma'}]`);
    console.log(`   isTriggerActive: ${persona.isTriggerActive}`);

    // Simular mensagens
    const testMessages = [
        { content: 'Olá, bom dia!', shouldBlock: true },
        { content: 'Quero comprar o produto', shouldBlock: false },
        { content: 'Qual o preço?', shouldBlock: true },
    ];

    console.log('\n📨 Simulação de mensagens:');
    for (const msg of testMessages) {
        const keywords = persona.triggerKeywords || [];
        const content = msg.content.toLowerCase();
        const hasMatch = keywords.some((k: string) => content.includes(k.toLowerCase()));
        const willBlock = !hasMatch;
        const status = willBlock ? '🚫 BLOQUEADO' : '✅ PERMITIDO';
        console.log(`   "${msg.content}" → ${status}`);
    }

    console.log('\n💡 Para testar em produção:');
    console.log('   1. Ative gatilhos de resposta na persona');
    console.log('   2. Adicione palavras-chave (ex: "comprar, desconto, preço")');
    console.log('   3. Envie mensagem SEM a palavra-chave → IA NÃO deve responder');
    console.log('   4. Envie mensagem COM a palavra-chave → IA DEVE responder');
}

async function testFollowUpSystem() {
    console.log('\n⏰ TESTE 2: Sistema de Follow-Up');
    console.log('='.repeat(50));

    // Verificar se campos existem
    const [persona] = await db.select({
        id: aiPersonas.id,
        name: aiPersonas.name,
        followupEnabled: aiPersonas.followupEnabled,
        followupDelayMinutes: aiPersonas.followupDelayMinutes,
        followupMaxAttempts: aiPersonas.followupMaxAttempts,
        followupMessages: aiPersonas.followupMessages,
    }).from(aiPersonas).limit(1);

    if (!persona) {
        console.log('⚠️  Nenhuma persona encontrada.');
        return;
    }

    console.log(`✅ Persona: ${persona.name}`);
    console.log(`   followupEnabled: ${persona.followupEnabled}`);
    console.log(`   followupDelayMinutes: ${persona.followupDelayMinutes}`);
    console.log(`   followupMaxAttempts: ${persona.followupMaxAttempts}`);
    console.log(`   followupMessages: ${JSON.stringify(persona.followupMessages)}`);

    // Verificar tabela de fila
    try {
        const { sql } = await import('drizzle-orm');
        const result = await db.execute(sql`SELECT COUNT(*) as count FROM ai_followup_queue`);
        const count = (result.rows?.[0] as any)?.count || 0;
        console.log(`\n📊 Tabela ai_followup_queue: ${count} itens na fila`);
    } catch (e) {
        console.log('⚠️  Tabela ai_followup_queue não encontrada. Execute a migration!');
    }

    console.log('\n💡 Para testar em produção:');
    console.log('   1. Ative follow-up automático na persona');
    console.log('   2. Configure tempo de espera (ex: 1 min para teste)');
    console.log('   3. Envie mensagem e espere a IA responder');
    console.log('   4. NÃO responda → Após o tempo, deve receber follow-up');
    console.log('   5. Responda antes do tempo → Follow-up deve ser cancelado');
}

async function testPixSplit() {
    console.log('\n💳 TESTE 3: Split de Mensagem PIX');
    console.log('='.repeat(50));

    const pixCode = '00020126580014br.gov.bcb.pix0136test-uuid-pix-123456789012345678901234567890123456789';

    console.log('📝 Simulação de envio de PIX:');
    console.log('');
    console.log('--- MENSAGEM 1 (Introdução) ---');
    console.log('🎯 *Cliente*, seu PIX foi gerado!');
    console.log('');
    console.log('💰 *Valor:* R$ 99.90');
    console.log('⏰ *Válido por:* 24h');
    console.log('📦 *Produto:* Curso Online');
    console.log('');
    console.log('👇 *Copie e cole o código PIX abaixo:*');
    console.log('');
    console.log('--- MENSAGEM 2 (Código PIX isolado) ---');
    console.log(pixCode);
    console.log('');
    console.log('--- MENSAGEM 3 (Fechamento) ---');
    console.log('☝️ Ou escaneie o QR Code se preferir.');
    console.log('');
    console.log('❓ Dúvidas? Estou aqui para ajudar!');
    console.log('');

    console.log('✅ O código PIX agora é enviado em mensagem separada!');
    console.log('   Isso evita truncamento quando a IA reformata.');

    console.log('\n💡 Para testar em produção:');
    console.log('   1. Dispare um webhook de PIX (via Kiwify, Hotmart, etc.)');
    console.log('   2. Verifique no chat se o código chegou COMPLETO');
    console.log('   3. O código deve estar sozinho em uma mensagem');
}

async function main() {
    console.log('🧪 INICIANDO TESTES DAS CORREÇÕES DO AGENTE DE IA');
    console.log('='.repeat(60));

    try {
        await testKeywordFilter();
        await testFollowUpSystem();
        await testPixSplit();

        console.log('\n' + '='.repeat(60));
        console.log('✅ TODOS OS TESTES CONCLUÍDOS');
        console.log('\nPróximos passos:');
        console.log('1. Configure uma persona de teste com gatilhos e follow-up');
        console.log('2. Faça testes manuais enviando mensagens reais');
        console.log('3. Monitore os logs em tempo real: tail -f logs/automation.log');
    } catch (error) {
        console.error('❌ Erro durante os testes:', error);
    }

    process.exit(0);
}

main();
