// scripts/monitor-ai-response-detailed.ts
import { db } from '@/lib/db';
import { messages, automationLogs } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

const CONVERSATION_ID = '98fd5446-4b55-4b57-9924-6140e2d6747d';

async function main() {
  console.log('=== 🔍 MONITORAMENTO DETALHADO: Resposta do Agente ===\n');
  console.log(`Conversa: ${CONVERSATION_ID}\n`);

  // Buscar todas as mensagens da conversa ordenadas por data
  const allMessages = await db.query.messages.findMany({
    where: eq(messages.conversationId, CONVERSATION_ID),
    orderBy: [desc(messages.sentAt)],
    limit: 20,
  });

  console.log(`📨 TOTAL DE MENSAGENS: ${allMessages.length}\n`);

  // Separar mensagens por tipo
  const userMessages = allMessages.filter(m => m.senderType === 'USER' || m.senderType === 'CONTACT');
  const aiMessages = allMessages.filter(m => m.senderType === 'AI' || m.senderType === 'AGENT');

  console.log(`👤 Mensagens do usuário: ${userMessages.length}`);
  console.log(`🤖 Mensagens do agente: ${aiMessages.length}\n`);

  // Mostrar últimas mensagens
  console.log('📋 ÚLTIMAS MENSAGENS (mais recentes primeiro):\n');
  allMessages.slice(0, 10).forEach((msg, idx) => {
    const timeAgo = Math.floor((Date.now() - new Date(msg.sentAt).getTime()) / 1000);
    console.log(`[${idx + 1}] ${msg.senderType} - ${timeAgo}s atrás`);
    console.log(`    ID: ${msg.id}`);
    console.log(`    Status: ${msg.status || 'N/A'}`);
    console.log(`    Conteúdo: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}\n`);
  });

  // Buscar logs de automação recentes
  console.log('\n📝 LOGS DE AUTOMAÇÃO RECENTES:\n');
  const logs = await db.query.automationLogs.findMany({
    where: eq(automationLogs.conversationId, CONVERSATION_ID),
    orderBy: [desc(automationLogs.createdAt)],
    limit: 15,
  });

  logs.forEach((log, idx) => {
    const timeAgo = Math.floor((Date.now() - new Date(log.createdAt).getTime()) / 1000);
    console.log(`[${idx + 1}] [${log.level}] ${timeAgo}s atrás`);
    console.log(`    ${log.message.substring(0, 200)}${log.message.length > 200 ? '...' : ''}\n`);
  });

  // Verificar erros
  const errors = logs.filter(log => log.level === 'ERROR');
  const quotaErrors = logs.filter(log => 
    log.message.includes('COTA EXCEDIDA') || 
    log.message.includes('quota') ||
    log.message.includes('RESOURCE_EXHAUSTED')
  );

  console.log('\n' + '='.repeat(80));
  console.log('📊 RESUMO:\n');
  console.log(`✅ Total de mensagens: ${allMessages.length}`);
  console.log(`✅ Mensagens do usuário: ${userMessages.length}`);
  console.log(`✅ Mensagens do agente: ${aiMessages.length}`);
  console.log(`${errors.length === 0 ? '✅' : '❌'} Erros encontrados: ${errors.length}`);
  console.log(`${quotaErrors.length === 0 ? '✅' : '❌'} Erros de quota: ${quotaErrors.length}`);

  if (aiMessages.length > 0) {
    const lastAi = aiMessages[0];
    console.log(`\n✅ ÚLTIMA RESPOSTA DO AGENTE:`);
    console.log(`   ID: ${lastAi.id}`);
    console.log(`   Tipo: ${lastAi.senderType}`);
    console.log(`   Status: ${lastAi.status || 'N/A'}`);
    console.log(`   Enviada há: ${Math.floor((Date.now() - new Date(lastAi.sentAt).getTime()) / 1000)}s`);
    console.log(`   Conteúdo completo:\n${lastAi.content}\n`);
  } else {
    console.log('\n⚠️ Nenhuma mensagem do agente encontrada ainda');
    console.log('   Isso pode ser normal se o delay humanizado ainda não passou.');
  }

  if (quotaErrors.length > 0) {
    console.log('\n❌ ERROS DE QUOTA ENCONTRADOS:');
    quotaErrors.forEach((log, idx) => {
      console.log(`\n[${idx + 1}] ${log.createdAt}`);
      console.log(`    ${log.message}`);
    });
  }

  process.exit(0);
}

main().catch(console.error);
