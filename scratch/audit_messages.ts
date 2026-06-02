import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from '@/lib/db';
import { messages, conversations, contacts, automationLogs } from '@/lib/db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import '@/lib/server-init';

async function audit() {
  console.log('--- 1. Leads com Conversas sem mensagens ---');
  const convsWithoutMsgs = await db.execute(sql`
    SELECT c.id as conversation_id, ct.name as contact_name, ct.phone
    FROM conversations c
    JOIN contacts ct ON c.contact_id = ct.id
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE m.id IS NULL
    ORDER BY c.created_at DESC
    LIMIT 10
  `);
  console.log(`Encontradas ${convsWithoutMsgs.length} conversas sem mensagens.`);
  console.log(convsWithoutMsgs);

  console.log('\n--- 2. Mensagens com Erro ---');
  const errorMsgs = await db.select({
    id: messages.id,
    content: messages.content,
    status: messages.status,
    senderType: messages.senderType,
    sentAt: messages.sentAt,
    contactName: contacts.name,
    conversationId: conversations.id
  })
  .from(messages)
  .leftJoin(conversations, eq(messages.conversationId, conversations.id))
  .leftJoin(contacts, eq(conversations.contactId, contacts.id))
  .where(inArray(messages.status, ['ERROR', 'FAILED', 'FAILED_FATAL']))
  .orderBy(desc(messages.sentAt))
  .limit(10);
  
  console.log(`Encontradas ${errorMsgs.length} mensagens com erro (amostra de 10).`);
  for (const msg of errorMsgs) {
    console.log(`\nMensagem ID: ${msg.id}`);
    console.log(`Status: ${msg.status}`);
    console.log(`Contato: ${msg.contactName}`);
    console.log(`Data: ${msg.sentAt}`);
    
    // Buscar log de automação recente para esta conversa
    const logs = await db.select({ message: automationLogs.message, details: automationLogs.details })
      .from(automationLogs)
      .where(and(
         eq(automationLogs.conversationId, msg.conversationId || ''),
         eq(automationLogs.level, 'ERROR')
      ))
      .orderBy(desc(automationLogs.createdAt))
      .limit(3);
    console.log(`Logs de Erro da Conversa:`, JSON.stringify(logs, null, 2));
  }

  process.exit(0);
}

audit().catch(console.error);
