/**
 * EXTRAÇÃO COMPLETA - Clínica Dilascio's
 * Puxa TODAS as conversas com TODAS as mensagens, uma a uma.
 */
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = postgres(DATABASE_URL, { ssl: 'require', max: 3 });
const companyId = 'f04e4c54-4514-4373-82d0-8bf7b7d91cbf';

async function run() {
  // 1. Puxar TODAS as conversas com dados do contato
  const allConversations = await sql`
    SELECT 
      conv.id as conv_id,
      conv.status,
      conv.ai_active,
      conv.contact_type,
      conv.source,
      TO_CHAR(conv.created_at, 'YYYY-MM-DD HH24:MI') as created_at,
      TO_CHAR(conv.last_message_at, 'YYYY-MM-DD HH24:MI') as last_message_at,
      TO_CHAR(conv.resolved_at, 'YYYY-MM-DD HH24:MI') as resolved_at,
      c.name as contact_name,
      c.phone as contact_phone,
      c.notes as contact_notes,
      c.custom_fields,
      c.vak_profile,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = conv.id)::int as msg_count,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = conv.id AND m.sender_type = 'CONTACT')::int as inbound_count,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = conv.id AND (m.sender_type = 'USER' OR m.is_ai_generated = true))::int as outbound_count
    FROM conversations conv
    JOIN contacts c ON c.id = conv.contact_id
    WHERE conv.company_id = ${companyId}
    ORDER BY conv.last_message_at DESC
  `;

  console.log(`\nTOTAL DE CONVERSAS: ${allConversations.length}`);

  // 2. Para cada conversa, puxar todas as mensagens
  const fullData: any[] = [];
  
  for (const conv of allConversations) {
    const messages = await sql`
      SELECT 
        m.sender_type,
        m.is_ai_generated,
        m.content,
        m.content_type,
        TO_CHAR(m.sent_at, 'YYYY-MM-DD HH24:MI') as sent_at,
        m.status
      FROM messages m
      WHERE m.conversation_id = ${conv.conv_id}
      ORDER BY m.sent_at ASC
    `;

    fullData.push({
      ...conv,
      messages: messages
    });
  }

  // Salvar para análise
  console.log(JSON.stringify(fullData, null, 2));

  await sql.end();
  process.exit(0);
}

run().catch(e => { console.error('ERROR:', e); process.exit(1); });
