// scripts/investigate-ai-agent-responses.ts
import { db } from '@/lib/db';
import { connections, aiPersonas } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

const CONNECTION_NAME = 'wtz-6-iphone_-';
const PERSONA_NAME = 'EDN Atendimento - Antônio/Pablo';

async function main() {
  console.log('=== 🔍 INVESTIGAÇÃO: Respostas do Agente de IA ===\n');
  console.log(`Conexão: ${CONNECTION_NAME}`);
  console.log(`Agente: ${PERSONA_NAME}\n`);

  // 1. Buscar conexão
  const connection = await db.query.connections.findFirst({
    where: eq(connections.config_name, CONNECTION_NAME),
  });

  if (!connection) {
    console.error('❌ Conexão não encontrada');
    return;
  }

  console.log('📋 DADOS DA CONEXÃO:');
  console.log(`   ID: ${connection.id}`);
  console.log(`   Nome: ${connection.config_name}`);
  console.log(`   Tipo: ${connection.connectionType}`);
  console.log(`   Telefone: ${connection.phone || 'N/A'}`);
  console.log(`   Assigned Persona ID: ${connection.assignedPersonaId || 'NÃO CONFIGURADO'}`);
  console.log(`   Status: ${connection.status}`);
  console.log(`   Is Active: ${connection.isActive}\n`);

  // 2. Buscar persona configurada
  if (connection.assignedPersonaId) {
    const persona = await db.query.aiPersonas.findFirst({
      where: eq(aiPersonas.id, connection.assignedPersonaId),
    });

    if (persona) {
      console.log('🤖 DADOS DA PERSONA:');
      console.log(`   ID: ${persona.id}`);
      console.log(`   Nome: ${persona.name}`);
      console.log(`   Provider: ${persona.provider || 'N/A'}`);
      console.log(`   Model: ${persona.model || 'N/A'}`);
      console.log(`   Is Active: ${persona.isActive}`);
      console.log(`   System Prompt: ${persona.systemPrompt?.substring(0, 100) || 'N/A'}...\n`);
    } else {
      console.log('⚠️ Persona não encontrada no banco de dados\n');
    }
  }

  // 3. Buscar conversas desta conexão
  const conversationsRaw = await db.execute(sql`
    SELECT 
      c.id,
      c.status,
      c.ai_active as "aiActive",
      c.assigned_persona_id as "assignedPersonaId",
      c.last_message_at as "lastMessageAt",
      c.created_at as "createdAt",
      cont.phone as "contactPhone",
      cont.name as "contactName"
    FROM conversations c
    INNER JOIN contacts cont ON c.contact_id = cont.id
    WHERE c.connection_id = ${connection.id}
      AND c.archived_at IS NULL
    ORDER BY c.last_message_at DESC
    LIMIT 10
  `);

  const conversationsList = (Array.isArray(conversationsRaw) 
    ? conversationsRaw 
    : conversationsRaw.rows || []) as Array<{
    id: string;
    status: string;
    aiActive: boolean | null;
    assignedPersonaId: string | null;
    lastMessageAt: Date | null;
    createdAt: Date;
    contactPhone: string;
    contactName: string | null;
  }>;

  console.log(`💬 CONVERSAS DA CONEXÃO (últimas 10):`);
  console.log(`   Total encontradas: ${conversationsList.length}\n`);

  // 4. Para cada conversa, buscar mensagens do agente de IA
  for (const conv of conversationsList) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📞 CONVERSA: ${conv.id}`);
    console.log(`   Contato: ${conv.contactName || conv.contactPhone} (${conv.contactPhone})`);
    console.log(`   Status: ${conv.status}`);
    console.log(`   AI Active: ${conv.aiActive}`);
    console.log(`   Assigned Persona ID: ${conv.assignedPersonaId || 'N/A'}`);
    console.log(`   Última mensagem: ${conv.lastMessageAt || 'N/A'}`);

    // Buscar mensagens do agente de IA nesta conversa
    const aiMessagesRaw = await db.execute(sql`
      SELECT 
        id,
        content,
        sender_type as "senderType",
        sent_at as "sentAt",
        status
      FROM messages
      WHERE conversation_id = ${conv.id}
        AND sender_type IN ('AI', 'AGENT')
      ORDER BY sent_at DESC
      LIMIT 5
    `);

    const aiMessages = (Array.isArray(aiMessagesRaw) 
      ? aiMessagesRaw 
      : aiMessagesRaw.rows || []) as Array<{
      id: string;
      content: string;
      senderType: string;
      sentAt: Date;
      status: string | null;
    }>;

    console.log(`\n   🤖 MENSAGENS DO AGENTE IA (últimas 5): ${aiMessages.length}`);
    if (aiMessages.length === 0) {
      console.log(`   ⚠️ Nenhuma mensagem do agente encontrada`);
    } else {
      aiMessages.forEach((msg, idx) => {
        console.log(`\n   [${idx + 1}] ID: ${msg.id}`);
        console.log(`       Tipo: ${msg.senderType}`);
        console.log(`       Status: ${msg.status || 'N/A'}`);
        console.log(`       Enviada em: ${msg.sentAt}`);
        console.log(`       Conteúdo: ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}`);
      });
    }

    // Buscar logs de automação para esta conversa
    const automationLogsRaw = await db.execute(sql`
      SELECT 
        id,
        level,
        message,
        created_at as "createdAt"
      FROM automation_logs
      WHERE conversation_id = ${conv.id}
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const logs = (Array.isArray(automationLogsRaw) 
      ? automationLogsRaw 
      : automationLogsRaw.rows || []) as Array<{
      id: string;
      level: string;
      message: string;
      createdAt: Date;
    }>;

    console.log(`\n   📝 LOGS DE AUTOMAÇÃO (últimos 10): ${logs.length}`);
    if (logs.length === 0) {
      console.log(`   ⚠️ Nenhum log de automação encontrado`);
    } else {
      logs.forEach((log, idx) => {
        console.log(`\n   [${idx + 1}] [${log.level}] ${log.createdAt}`);
        console.log(`       ${log.message.substring(0, 200)}${log.message.length > 200 ? '...' : ''}`);
      });
    }
  }

  // 5. Buscar mensagens recentes do usuário que não receberam resposta
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📨 MENSAGENS DO USUÁRIO SEM RESPOSTA (últimas 10):\n');

  const unansweredMessagesRaw = await db.execute(sql`
    WITH user_messages AS (
      SELECT 
        m.id,
        m.conversation_id,
        m.content,
        m.sent_at,
        c.contact_id,
        cont.phone,
        cont.name
      FROM messages m
      INNER JOIN conversations c ON m.conversation_id = c.id
      INNER JOIN contacts cont ON c.contact_id = cont.id
      WHERE c.connection_id = ${connection.id}
        AND m.sender_type = 'USER'
        AND c.archived_at IS NULL
      ORDER BY m.sent_at DESC
      LIMIT 20
    ),
    ai_responses AS (
      SELECT DISTINCT conversation_id
      FROM messages
      WHERE sender_type IN ('AI', 'AGENT')
        AND sent_at > (SELECT MIN(sent_at) FROM user_messages)
    )
    SELECT 
      um.id,
      um.conversation_id,
      um.content,
      um.sent_at,
      um.phone,
      um.name
    FROM user_messages um
    LEFT JOIN ai_responses ar ON um.conversation_id = ar.conversation_id
    WHERE ar.conversation_id IS NULL
    ORDER BY um.sent_at DESC
    LIMIT 10
  `);

  const unansweredMessages = (Array.isArray(unansweredMessagesRaw) 
    ? unansweredMessagesRaw 
    : unansweredMessagesRaw.rows || []) as Array<{
    id: string;
    conversation_id: string;
    content: string;
    sent_at: Date;
    phone: string;
    name: string | null;
  }>;

  if (unansweredMessages.length === 0) {
    console.log('✅ Todas as mensagens receberam resposta');
  } else {
    console.log(`⚠️ Encontradas ${unansweredMessages.length} mensagens sem resposta:\n`);
    unansweredMessages.forEach((msg, idx) => {
      console.log(`[${idx + 1}] Conversation: ${msg.conversation_id}`);
      console.log(`    Contato: ${msg.name || msg.phone} (${msg.phone})`);
      console.log(`    Enviada em: ${msg.sent_at}`);
      console.log(`    Conteúdo: ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}\n`);
    });
  }

  // 6. Estatísticas gerais
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 ESTATÍSTICAS GERAIS:\n');

  const statsRaw = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT c.id) as "totalConversations",
      COUNT(DISTINCT CASE WHEN c.ai_active = true THEN c.id END) as "aiActiveConversations",
      COUNT(DISTINCT m.id) FILTER (WHERE m.sender_type = 'USER') as "userMessages",
      COUNT(DISTINCT m.id) FILTER (WHERE m.sender_type IN ('AI', 'AGENT')) as "aiMessages"
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.connection_id = ${connection.id}
      AND c.archived_at IS NULL
  `);

  const stats = (Array.isArray(statsRaw) 
    ? statsRaw[0] 
    : statsRaw.rows?.[0] || {}) as {
    totalConversations: number;
    aiActiveConversations: number;
    userMessages: number;
    aiMessages: number;
  };

  console.log(`   Total de conversas: ${stats.totalConversations || 0}`);
  console.log(`   Conversas com AI ativa: ${stats.aiActiveConversations || 0}`);
  console.log(`   Mensagens do usuário: ${stats.userMessages || 0}`);
  console.log(`   Mensagens do agente IA: ${stats.aiMessages || 0}`);
  
  if (stats.userMessages && stats.aiMessages) {
    const responseRate = ((stats.aiMessages / stats.userMessages) * 100).toFixed(2);
    console.log(`   Taxa de resposta: ${responseRate}%`);
  }

  process.exit(0);
}

main().catch(console.error);
