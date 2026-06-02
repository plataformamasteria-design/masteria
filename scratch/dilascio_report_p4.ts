/**
 * Script parte 4 — usa postgres-js diretamente (igual ao db/index.ts)
 */
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = postgres(DATABASE_URL, { ssl: 'require', max: 3 });
const companyId = 'f04e4c54-4514-4373-82d0-8bf7b7d91cbf';

async function run() {
  // Stats gerais de mensagens
  const msgStats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE sender_type = 'CONTACT') as from_contacts,
      COUNT(*) FILTER (WHERE sender_type = 'USER') as from_agents,
      COUNT(*) FILTER (WHERE is_ai_generated = true) as from_ai,
      TO_CHAR(MIN(sent_at), 'YYYY-MM-DD') as first_message,
      TO_CHAR(MAX(sent_at), 'YYYY-MM-DD') as last_message
    FROM messages
    WHERE company_id = ${companyId}
  `;
  console.log('MSG STATS:', JSON.stringify(msgStats[0], null, 2));

  // Mensagens por mês
  const msgByMonth = await sql`
    SELECT 
      TO_CHAR(sent_at, 'YYYY-MM') as month,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE sender_type = 'CONTACT') as inbound,
      COUNT(*) FILTER (WHERE sender_type = 'USER') as from_agents,
      COUNT(*) FILTER (WHERE is_ai_generated = true) as from_ai
    FROM messages
    WHERE company_id = ${companyId}
    GROUP BY TO_CHAR(sent_at, 'YYYY-MM')
    ORDER BY month DESC
  `;
  console.log('\nMENSAGENS POR MÊS:', JSON.stringify(msgByMonth, null, 2));

  // Primeiras mensagens dos leads (o que eles perguntam)
  const firstMessages = await sql`
    SELECT DISTINCT ON (conv.id)
      c.name as contact_name,
      c.phone,
      m.content as first_message,
      TO_CHAR(m.sent_at, 'YYYY-MM-DD HH24:MI') as sent_at
    FROM conversations conv
    JOIN contacts c ON c.id = conv.contact_id
    JOIN messages m ON m.conversation_id = conv.id AND m.sender_type = 'CONTACT'
    WHERE conv.company_id = ${companyId}
    ORDER BY conv.id, m.sent_at ASC
    LIMIT 100
  `;
  console.log('\nPRIMEIRAS MENSAGENS DOS LEADS:', JSON.stringify(firstMessages, null, 2));

  // Padrão horário
  const hourPattern = await sql`
    SELECT 
      EXTRACT(HOUR FROM sent_at)::int as hour,
      COUNT(*) as messages
    FROM messages
    WHERE company_id = ${companyId}
      AND sender_type = 'CONTACT'
    GROUP BY EXTRACT(HOUR FROM sent_at)::int
    ORDER BY messages DESC
  `;
  console.log('\nHORÁRIOS MAIS ATIVOS:', JSON.stringify(hourPattern, null, 2));

  // Dia da semana
  const dayPattern = await sql`
    SELECT 
      EXTRACT(DOW FROM sent_at)::int as dow,
      TO_CHAR(MIN(sent_at), 'Day') as day_name,
      COUNT(*) as messages
    FROM messages
    WHERE company_id = ${companyId}
      AND sender_type = 'CONTACT'
    GROUP BY EXTRACT(DOW FROM sent_at)::int
    ORDER BY messages DESC
  `;
  console.log('\nDIAS DA SEMANA:', JSON.stringify(dayPattern, null, 2));

  // Leads mais engajados
  const mostEngaged = await sql`
    SELECT 
      c.name as contact_name,
      c.phone,
      conv.status,
      TO_CHAR(conv.created_at, 'YYYY-MM-DD') as created_at,
      TO_CHAR(conv.last_message_at, 'YYYY-MM-DD') as last_message_at,
      COUNT(m.id) as msg_count,
      conv.ai_active
    FROM conversations conv
    JOIN contacts c ON c.id = conv.contact_id
    LEFT JOIN messages m ON m.conversation_id = conv.id
    WHERE conv.company_id = ${companyId}
    GROUP BY conv.id, c.name, c.phone, conv.status, conv.created_at, conv.last_message_at, conv.ai_active
    ORDER BY msg_count DESC
    LIMIT 20
  `;
  console.log('\nLEADS MAIS ENGAJADOS:', JSON.stringify(mostEngaged, null, 2));

  // Últimas conversas com última mensagem
  const latestConvs = await sql`
    SELECT 
      c.name, c.phone,
      conv.status, 
      TO_CHAR(conv.last_message_at, 'YYYY-MM-DD HH24:MI') as last_message_at,
      conv.ai_active,
      (SELECT content FROM messages WHERE conversation_id = conv.id ORDER BY sent_at DESC LIMIT 1) as last_msg,
      (SELECT sender_type FROM messages WHERE conversation_id = conv.id ORDER BY sent_at DESC LIMIT 1) as last_msg_from
    FROM conversations conv
    JOIN contacts c ON c.id = conv.contact_id
    WHERE conv.company_id = ${companyId}
    ORDER BY conv.last_message_at DESC
    LIMIT 30
  `;
  console.log('\nÚLTIMAS CONVERSAS:', JSON.stringify(latestConvs, null, 2));

  // Leads frios (sem interação > 7 dias, ainda abertos)
  const silentLeads = await sql`
    SELECT 
      c.name, c.phone, 
      TO_CHAR(conv.created_at, 'YYYY-MM-DD') as created_at,
      TO_CHAR(conv.last_message_at, 'YYYY-MM-DD') as last_message_at,
      (SELECT count(*) FROM messages WHERE conversation_id = conv.id)::int as total_msgs
    FROM conversations conv
    JOIN contacts c ON c.id = conv.contact_id
    WHERE conv.company_id = ${companyId}
      AND conv.last_message_at < NOW() - INTERVAL '7 days'
      AND conv.status NOT IN ('RESOLVED', 'ARCHIVED')
    ORDER BY conv.last_message_at ASC
    LIMIT 50
  `;
  console.log('\nLEADS FRIOS (sem interação > 7 dias):', JSON.stringify(silentLeads, null, 2));

  // Crescimento de contatos por mês
  const contactGrowth = await sql`
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM') as month,
      COUNT(*) as new_contacts
    FROM contacts
    WHERE company_id = ${companyId}
      AND deleted_at IS NULL
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month DESC
  `;
  console.log('\nCRESCIMENTO DE CONTATOS POR MÊS:', JSON.stringify(contactGrowth, null, 2));

  // Atividade por dia (últimos 30 dias)
  const recentActivity = await sql`
    SELECT 
      DATE(last_message_at) as day,
      COUNT(*)::int as active_conversations
    FROM conversations
    WHERE company_id = ${companyId}
      AND last_message_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(last_message_at)
    ORDER BY day DESC
  `;
  console.log('\nATIVIDADE ÚLTIMOS 30 DIAS:', JSON.stringify(recentActivity, null, 2));

  await sql.end();
  console.log('\n=== FIM ===');
  process.exit(0);
}

run().catch(e => { console.error('ERROR:', e); process.exit(1); });
