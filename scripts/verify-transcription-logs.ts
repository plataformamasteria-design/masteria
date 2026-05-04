
import { db } from '@/lib/db';
import { messages } from '@/lib/db/schema';
import { desc, like, and, gte } from 'drizzle-orm';

async function verifyTranscriptionLogs() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  INVESTIGAÇÃO DE EVIDÊNCIAS DE TRANSCRIÇÃO (REMOTO/DB)         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Buscar mensagens recentes (últimas 24h) que contenham o padrão de transcrição
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  console.log('🔍 Buscando mensagens com prefixo "[Áudio Transcrito]:"...');

  const transcribedMessages = await db.select().from(messages).where(
    and(
      like(messages.content, '%[Áudio Transcrito]:%'),
      gte(messages.sentAt, oneDayAgo)
    )
  ).orderBy(desc(messages.sentAt)).limit(10);

  if (transcribedMessages.length === 0) {
    console.log('⚠️  Nenhuma mensagem transcrita encontrada nas últimas 24h.');
    console.log('    Nota: Isso é esperado se nenhum áudio foi enviado para o bot recentemente.');
  } else {
    console.log(`✅ Encontradas ${transcribedMessages.length} mensagens transcritas recentes:\n`);
    
    transcribedMessages.forEach((msg, idx) => {
      console.log(`[${idx + 1}] ID: ${msg.id}`);
      console.log(`    Data: ${msg.sentAt.toLocaleString()}`);
      console.log(`    Conteúdo: ${msg.content.substring(0, 150)}...`);
      console.log('---------------------------------------------------');
    });
  }
}

verifyTranscriptionLogs().catch(console.error);
