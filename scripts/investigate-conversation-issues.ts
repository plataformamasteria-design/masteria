// scripts/investigate-conversation-issues.ts
import { db } from '@/lib/db';
import { conversations, contacts } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

const CONVERSATION_ID = '98585976-9289-40fb-a1e3-481d24e26fc2';

async function main() {
  console.log('=== INVESTIGAÇÃO: Problemas na Conversa ===\n');
  console.log(`Conversation ID: ${CONVERSATION_ID}\n`);

  // 1. Buscar conversa
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, CONVERSATION_ID),
    with: {
      contact: true,
      connection: true,
    },
  });

  if (!conversation) {
    console.error('❌ Conversa não encontrada');
    return;
  }

  console.log('📋 DADOS DA CONVERSA:');
  console.log(`   Contact ID: ${conversation.contactId}`);
  console.log(`   Connection ID: ${conversation.connectionId}`);
  console.log(`   Status: ${conversation.status}`);
  console.log(`   Phone: ${conversation.contact?.phone}`);
  console.log(`   Connection Name: ${conversation.connection?.config_name}`);
  console.log(`   Connection Type: ${conversation.connection?.connectionType}`);
  console.log(`   Connection Phone: ${conversation.connection?.phone}\n`);

  // 2. Buscar mensagens "não suportadas"
  const unsupportedMessagesRaw = await db.execute(sql`
    SELECT 
      id,
      content,
      content_type as "contentType",
      sender_type as "senderType",
      provider_message_id as "providerMessageId",
      sent_at::text as "sentAt"
    FROM messages
    WHERE conversation_id = ${CONVERSATION_ID}
      AND content = 'Mensagem não suportada'
    ORDER BY sent_at DESC
    LIMIT 10
  `);
  
  const unsupportedMessages = (Array.isArray(unsupportedMessagesRaw) ? unsupportedMessagesRaw : unsupportedMessagesRaw.rows || []) as Array<{
    id: string;
    content: string;
    contentType: string | null;
    senderType: string;
    providerMessageId: string | null;
    sentAt: string;
  }>;

  console.log(`\n📨 MENSAGENS "NÃO SUPORTADAS" (últimas 10):`);
  console.log(`   Total encontradas: ${unsupportedMessages.length}`);
  unsupportedMessages.forEach((msg, idx) => {
    console.log(`\n   [${idx + 1}] ID: ${msg.id}`);
    console.log(`       Content Type: ${msg.contentType}`);
    console.log(`       Sender Type: ${msg.senderType}`);
    console.log(`       Provider Message ID: ${msg.providerMessageId || 'N/A'}`);
      console.log(`       Sent At: ${msg.sentAt}`);
  });

  // 3. Buscar todas as conversas ativas do contato
  const contactId = conversation.contactId;
  const allActiveConversationsRaw = await db.execute(sql`
    SELECT 
      c.id,
      c.connection_id as "connectionId",
      conn.config_name as "connectionName",
      conn.connection_type as "connectionType",
      conn.phone as "connectionPhone",
      c.status,
      c.last_message_at as "lastMessageAt"
    FROM conversations c
    LEFT JOIN connections conn ON c.connection_id = conn.id
    WHERE c.contact_id = ${contactId}
      AND c.company_id = ${conversation.companyId}
      AND c.archived_at IS NULL
    ORDER BY c.last_message_at
  `);
  
  const allActiveConversations = (Array.isArray(allActiveConversationsRaw) ? allActiveConversationsRaw : allActiveConversationsRaw.rows || []) as Array<{
    id: string;
    connectionId: string;
    connectionName: string | null;
    connectionType: string | null;
    connectionPhone: string | null;
    status: string;
    lastMessageAt: Date | null;
  }>;

  console.log(`\n\n💬 CONVERSAS ATIVAS DO CONTATO:`);
  console.log(`   Total: ${allActiveConversations.length}`);
  console.log(`   Contact Phone: ${conversation.contact?.phone}\n`);

  // Agrupar por connectionPhone para ver quantos números diferentes
  const byPhone = new Map<string, number>();
  allActiveConversations.forEach(conv => {
    const phone = conv.connectionPhone || 'SEM_TELEFONE';
    byPhone.set(phone, (byPhone.get(phone) || 0) + 1);
  });

  console.log(`   Conversas por número de telefone:`);
  byPhone.forEach((count, phone) => {
    console.log(`     ${phone}: ${count} conversa(s)`);
  });

  console.log(`\n   Detalhes das conversas:`);
  allActiveConversations.forEach((conv, idx) => {
    console.log(`\n   [${idx + 1}] Conversation ID: ${conv.id}`);
    console.log(`       Connection ID: ${conv.connectionId}`);
    console.log(`       Connection Name: ${conv.connectionName || 'N/A'}`);
    console.log(`       Connection Type: ${conv.connectionType || 'N/A'}`);
    console.log(`       Connection Phone: ${conv.connectionPhone || 'N/A'}`);
    console.log(`       Status: ${conv.status}`);
    console.log(`       Last Message: ${conv.lastMessageAt || 'N/A'}`);
  });

  // 4. Verificar tipos de mensagem não tratados
  const allMessageTypesRaw = await db.execute(sql`
    SELECT 
      content_type as "contentType",
      content,
      count(*)::int as count
    FROM messages
    WHERE conversation_id = ${CONVERSATION_ID}
    GROUP BY content_type, content
    ORDER BY count(*)::int DESC
  `);
  
  const allMessageTypes = (Array.isArray(allMessageTypesRaw) ? allMessageTypesRaw : allMessageTypesRaw.rows || []) as Array<{
    contentType: string | null;
    content: string | null;
    count: number;
  }>;

  console.log(`\n\n📊 TIPOS DE MENSAGEM NA CONVERSA:`);
  allMessageTypes.forEach(type => {
    console.log(`   ${type.contentType || 'NULL'}: ${type.count} (exemplo: "${type.content?.substring(0, 50)}")`);
  });

  // 5. Verificar se há mensagens de grupos
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, contactId),
  });

  console.log(`\n\n👥 DADOS DO CONTATO:`);
  console.log(`   Phone: ${contact?.phone}`);
  console.log(`   Is Group: ${contact?.isGroup}`);
  console.log(`   Name: ${contact?.name}`);
  console.log(`   WhatsApp Name: ${contact?.whatsappName}`);

  process.exit(0);
}

main().catch(console.error);
