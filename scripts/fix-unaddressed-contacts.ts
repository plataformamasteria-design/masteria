import { db } from '@/lib/db';
import { messages, conversations, contacts } from '@/lib/db/schema';
import { processIncomingMessageTrigger } from '@/lib/automation-engine';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

async function fixUnaddressedContacts() {
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
  const connectionId = '39a65782-5443-4f59-8d93-c0323981972a';
  const personaId = '7e719d33-7c15-40ab-80b1-88a942c55aa5';
  
  const phones = [
    '554588044245',
    '556194613917',
    '5516991942163'
  ];

  console.log('--- Iniciando Recuperação de Contatos ---');

  for (const phone of phones) {
    try {
      console.log(`Processando: ${phone}`);
      
      let contactList = await db.select().from(contacts).where(eq(contacts.phone, phone)).limit(1);
      let contact = contactList[0];
      
      if (!contact) {
        console.log(`Contato ${phone} não encontrado. Criando...`);
        const [newContact] = await db.insert(contacts).values({
          id: crypto.randomUUID(),
          companyId,
          name: phone === '5516991942163' ? 'Interessado 2163' : 'Contato Recuperado',
          phone,
          status: 'ACTIVE',
        }).returning();
        contact = newContact;
      }

      if (!contact) throw new Error(`Falha ao obter contato para ${phone}`);

      let conversationList = await db.select().from(conversations).where(and(
        eq(conversations.contactId, contact.id),
        eq(conversations.connectionId, connectionId)
      )).limit(1);
      
      let conversation = conversationList[0];
      
      if (!conversation) {
        const [newConversation] = await db.insert(conversations).values({
          id: crypto.randomUUID(),
          companyId,
          contactId: contact.id,
          connectionId,
          status: 'NEW',
          aiActive: true,
          assignedPersonaId: personaId,
          contactType: 'PASSIVE',
          source: 'recovery_script',
          lastMessageAt: new Date(),
        }).returning();
        conversation = newConversation;
      } else {
        await db.update(conversations)
          .set({ aiActive: true, assignedPersonaId: personaId })
          .where(eq(conversations.id, conversation.id));
      }

      if (!conversation) throw new Error(`Falha ao obter conversa para ${phone}`);

      const messageId = crypto.randomUUID();
      await db.insert(messages).values({
        id: messageId,
        companyId,
        conversationId: conversation.id,
        senderType: 'USER',
        senderId: 'system_recovery',
        content: 'tenho interesse',
        contentType: 'TEXT',
        sentAt: new Date(),
        status: 'RECEIVED',
        direction: 'INBOUND',
      } as any);

      console.log(`Disparando IA para ${phone} (Conversa: ${conversation.id})`);
      await processIncomingMessageTrigger(conversation.id, messageId);
      
      console.log(`✅ Sucesso para ${phone}`);
    } catch (err) {
      console.error(`❌ Erro ao processar ${phone}:`, err);
    }
  }
  
  console.log('--- Processo Concluído ---');
}

fixUnaddressedContacts().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
