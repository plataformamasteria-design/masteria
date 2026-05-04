import { db } from '@/lib/db';
import { messages, conversations, contacts } from '@/lib/db/schema';
import { processIncomingMessageTrigger } from '@/lib/automation-engine';
import { eq, and, desc } from 'drizzle-orm';

async function triggerAIForPending() {
  const phones = ['554588044245', '556194613917', '5516991942163'];
  
  console.log('--- Iniciando Disparo de IA ---');

  for (const phone of phones) {
    try {
      // 1. Encontrar o contato e a mensagem de gatilho mais recente
      const result = await db.select({
        conversationId: conversations.id,
        messageId: messages.id
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(and(
        eq(contacts.phone, phone),
        eq(messages.content, 'tenho interesse'),
        eq(messages.senderId, 'system_recovery')
      ))
      .orderBy(desc(messages.sentAt))
      .limit(1);

      if (result.length > 0) {
        const { conversationId, messageId } = result[0];
        console.log(`Disparando IA para ${phone} (Conv: ${conversationId}, Msg: ${messageId})`);
        await processIncomingMessageTrigger(conversationId, messageId);
        console.log(`✅ IA Acionada para ${phone}`);
      } else {
        console.warn(`⚠️ Gatilho não encontrado para ${phone}`);
      }
    } catch (err) {
      console.error(`❌ Erro em ${phone}:`, err);
    }
  }
}

triggerAIForPending().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
