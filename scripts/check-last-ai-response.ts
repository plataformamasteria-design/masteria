// scripts/check-last-ai-response.ts
import { db } from '@/lib/db';
import { messages } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

const CONVERSATION_ID = '98fd5446-4b55-4b57-9924-6140e2d6747d';

async function main() {
  console.log('=== 🔍 VERIFICANDO ÚLTIMA RESPOSTA DO AGENTE ===\n');
  console.log(`Conversa: ${CONVERSATION_ID}\n`);

  // Buscar todas as mensagens da conversa
  const allMessages = await db.query.messages.findMany({
    where: eq(messages.conversationId, CONVERSATION_ID),
    orderBy: [desc(messages.sentAt)],
    limit: 10,
  });

  console.log(`📨 TOTAL DE MENSAGENS: ${allMessages.length}\n`);

  allMessages.forEach((msg, idx) => {
    console.log(`[${idx + 1}] ${msg.senderType} - ${msg.sentAt}`);
    console.log(`    Status: ${msg.status || 'N/A'}`);
    console.log(`    Conteúdo: ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}\n`);
  });

  const aiMessages = allMessages.filter(m => m.senderType === 'AGENT' || m.senderType === 'AI');
  console.log(`\n🤖 MENSAGENS DO AGENTE: ${aiMessages.length}`);

  if (aiMessages.length > 0) {
    console.log('\n✅ ÚLTIMA RESPOSTA DO AGENTE:');
    const lastAi = aiMessages[0];
    console.log(`   ID: ${lastAi.id}`);
    console.log(`   Tipo: ${lastAi.senderType}`);
    console.log(`   Status: ${lastAi.status || 'N/A'}`);
    console.log(`   Enviada em: ${lastAi.sentAt}`);
    console.log(`   Conteúdo completo:\n${lastAi.content}\n`);
  } else {
    console.log('\n⚠️ Nenhuma mensagem do agente encontrada');
  }

  process.exit(0);
}

main().catch(console.error);
