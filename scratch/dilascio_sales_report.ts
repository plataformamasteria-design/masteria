/**
 * Script de Diagnóstico e Relatório de Vendas - Clínica Dilascio's
 * Extrai: empresa, contatos, conversas, kanban leads, tags, usuários
 */
import { db } from '../src/lib/db';
import { 
  companies, contacts, conversations, messages, 
  kanbanBoards, kanbanLeads, tags, contactsToTags,
  users, connections, contactLists, contactsToContactLists
} from '../src/lib/db/schema';
import { eq, sql, desc, and, isNull, isNotNull, count, gte, lte, like, ilike } from 'drizzle-orm';

async function generateDilascioReport() {
  console.log('=== BUSCANDO EMPRESA ===');
  
  // 1. Buscar empresa
  const company = await db.select().from(companies)
    .where(ilike(companies.name, '%dilascio%'))
    .limit(1);
  
  if (!company[0]) {
    console.log('Empresa não encontrada');
    process.exit(1);
  }
  
  const org = company[0];
  const companyId = org.id;
  
  console.log('EMPRESA:', JSON.stringify(org, null, 2));
  
  // 2. Usuários da empresa
  console.log('\n=== USUÁRIOS ===');
  const orgUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt
  }).from(users).where(eq(users.companyId, companyId));
  console.log('USERS:', JSON.stringify(orgUsers, null, 2));

  // 3. Conexões
  console.log('\n=== CONEXÕES ===');
  const orgConnections = await db.select().from(connections).where(eq(connections.companyId, companyId));
  console.log('CONNECTIONS:', JSON.stringify(orgConnections.map(c => ({ id: c.id, name: c.config_name, type: c.connectionType, status: c.status, phone: c.phone })), null, 2));

  // 4. Estatísticas de contatos
  console.log('\n=== CONTATOS ===');
  const contactStats = await db.select({
    total: count(),
    active: sql<number>`COUNT(*) FILTER (WHERE status = 'ACTIVE')`,
    withNotes: sql<number>`COUNT(*) FILTER (WHERE notes IS NOT NULL AND notes != '')`,
  }).from(contacts).where(and(eq(contacts.companyId, companyId), isNull(contacts.deletedAt)));
  console.log('CONTACT STATS:', JSON.stringify(contactStats[0], null, 2));

  // Buscar todos os contatos com suas tags
  const allContacts = await db.select({
    id: contacts.id,
    name: contacts.name,
    phone: contacts.phone,
    status: contacts.status,
    notes: contacts.notes,
    customFields: contacts.customFields,
    vakProfile: contacts.vakProfile,
    createdAt: contacts.createdAt,
  }).from(contacts)
    .where(and(eq(contacts.companyId, companyId), isNull(contacts.deletedAt)))
    .orderBy(desc(contacts.createdAt))
    .limit(300);
  console.log(`\nTOTAL DE CONTATOS ATIVOS: ${allContacts.length}`);

  // 5. Tags disponíveis
  console.log('\n=== TAGS ===');
  const allTags = await db.select().from(tags).where(eq(tags.companyId, companyId));
  console.log('TAGS:', JSON.stringify(allTags, null, 2));

  // 6. Estatísticas de conversas
  console.log('\n=== CONVERSAS ===');
  const convStats = await db.select({
    total: count(),
    open: sql<number>`COUNT(*) FILTER (WHERE status = 'OPEN' OR status = 'NEW')`,
    resolved: sql<number>`COUNT(*) FILTER (WHERE status = 'RESOLVED')`,
    archived: sql<number>`COUNT(*) FILTER (WHERE archived_at IS NOT NULL)`,
    aiActive: sql<number>`COUNT(*) FILTER (WHERE ai_active = true)`,
  }).from(conversations).where(eq(conversations.companyId, companyId));
  console.log('CONV STATS:', JSON.stringify(convStats[0], null, 2));

  // Conversas por mês (últimos 6 meses)
  const convByMonth = await db.execute(sql`
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM') as month,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved,
      COUNT(*) FILTER (WHERE status IN ('OPEN', 'NEW')) as open
    FROM conversations
    WHERE company_id = ${companyId}
      AND created_at >= NOW() - INTERVAL '6 months'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month DESC
  `);
  console.log('\nCONVERSAS POR MÊS:', JSON.stringify(convByMonth.rows, null, 2));

  // 7. Kanban Boards
  console.log('\n=== KANBAN BOARDS ===');
  const boards = await db.select().from(kanbanBoards).where(eq(kanbanBoards.companyId, companyId));
  console.log('BOARDS:', JSON.stringify(boards.map(b => ({
    id: b.id, name: b.name, funnelType: b.funnelType, stages: b.stages
  })), null, 2));

  // 8. Kanban Leads por estágio (para cada board)
  for (const board of boards) {
    console.log(`\n=== LEADS NO BOARD: ${board.name} ===`);
    
    const leadsByStage = await db.execute(sql`
      SELECT 
        kl.stage_id,
        kl.current_stage,
        COUNT(*) as count,
        SUM(CAST(kl.value AS numeric)) as total_value,
        AVG(CAST(kl.value AS numeric)) as avg_value,
        MAX(kl.created_at) as last_lead_at,
        MIN(kl.created_at) as first_lead_at
      FROM kanban_leads kl
      WHERE kl.company_id = ${companyId}
        AND kl.board_id = ${board.id}
        AND kl.status = 'ACTIVE'
      GROUP BY kl.stage_id, kl.current_stage
      ORDER BY count DESC
    `);
    console.log(`LEADS POR ESTÁGIO [${board.name}]:`, JSON.stringify(leadsByStage.rows, null, 2));

    // Leads com valor
    const highValueLeads = await db.select({
      id: kanbanLeads.id,
      title: kanbanLeads.title,
      value: kanbanLeads.value,
      stageId: kanbanLeads.stageId,
      currentStage: kanbanLeads.currentStage,
      notes: kanbanLeads.notes,
      createdAt: kanbanLeads.createdAt,
      updatedAt: kanbanLeads.updatedAt,
      contactId: kanbanLeads.contactId,
    }).from(kanbanLeads)
      .where(and(
        eq(kanbanLeads.companyId, companyId),
        eq(kanbanLeads.boardId, board.id),
        sql`CAST(${kanbanLeads.value} AS numeric) > 0`
      ))
      .orderBy(desc(kanbanLeads.value))
      .limit(50);
    
    console.log(`\nLEADS COM VALOR [${board.name}]:`, JSON.stringify(highValueLeads, null, 2));

    // Leads em estágios de LOSS e WIN
    const lossWinLeads = await db.execute(sql`
      SELECT 
        kl.stage_id,
        kl.current_stage->>'type' as stage_type,
        kl.current_stage->>'title' as stage_title,
        COUNT(*) as count,
        SUM(CAST(kl.value AS numeric)) as total_value
      FROM kanban_leads kl
      WHERE kl.company_id = ${companyId}
        AND kl.board_id = ${board.id}
        AND (kl.current_stage->>'type' = 'WIN' OR kl.current_stage->>'type' = 'LOSS')
      GROUP BY kl.stage_id, kl.current_stage->>'type', kl.current_stage->>'title'
    `);
    console.log(`\nLEADS WIN/LOSS [${board.name}]:`, JSON.stringify(lossWinLeads.rows, null, 2));
  }

  // 9. Volume de mensagens
  console.log('\n=== VOLUME DE MENSAGENS ===');
  const msgStats = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE sender_type = 'CONTACT') as from_contacts,
      COUNT(*) FILTER (WHERE sender_type = 'USER') as from_agents,
      COUNT(*) FILTER (WHERE is_ai_generated = true) as from_ai,
      COUNT(*) FILTER (WHERE content_type = 'AUDIO') as audio_msgs,
      COUNT(*) FILTER (WHERE content_type = 'IMAGE') as image_msgs,
      TO_CHAR(MIN(sent_at), 'YYYY-MM-DD') as first_message,
      TO_CHAR(MAX(sent_at), 'YYYY-MM-DD') as last_message
    FROM messages
    WHERE company_id = ${companyId}
  `);
  console.log('MSG STATS:', JSON.stringify(msgStats.rows[0], null, 2));

  // Mensagens por mês
  const msgByMonth = await db.execute(sql`
    SELECT 
      TO_CHAR(sent_at, 'YYYY-MM') as month,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE sender_type = 'CONTACT') as inbound,
      COUNT(*) FILTER (WHERE sender_type IN ('USER', 'AI')) as outbound
    FROM messages
    WHERE company_id = ${companyId}
      AND sent_at >= NOW() - INTERVAL '6 months'
    GROUP BY TO_CHAR(sent_at, 'YYYY-MM')
    ORDER BY month DESC
  `);
  console.log('\nMENSAGENS POR MÊS:', JSON.stringify(msgByMonth.rows, null, 2));

  // 10. Top contatos mais ativos (por volume de conversas)
  console.log('\n=== TOP CONTATOS MAIS ATIVOS ===');
  const topContacts = await db.execute(sql`
    SELECT 
      c.name,
      c.phone,
      c.status,
      c.vak_profile,
      c.notes,
      c.custom_fields,
      COUNT(conv.id) as conversation_count,
      MAX(conv.last_message_at) as last_interaction
    FROM contacts c
    LEFT JOIN conversations conv ON conv.contact_id = c.id
    WHERE c.company_id = ${companyId}
      AND c.deleted_at IS NULL
    GROUP BY c.id, c.name, c.phone, c.status, c.vak_profile, c.notes, c.custom_fields
    ORDER BY conversation_count DESC, last_interaction DESC
    LIMIT 30
  `);
  console.log('TOP CONTACTS:', JSON.stringify(topContacts.rows, null, 2));

  // 11. Análise por hora do dia e dia da semana
  console.log('\n=== PADRÃO DE HORÁRIO DE ATENDIMENTO ===');
  const hourPattern = await db.execute(sql`
    SELECT 
      EXTRACT(HOUR FROM sent_at) as hour,
      COUNT(*) as messages
    FROM messages
    WHERE company_id = ${companyId}
      AND sender_type = 'CONTACT'
    GROUP BY EXTRACT(HOUR FROM sent_at)
    ORDER BY messages DESC
    LIMIT 10
  `);
  console.log('HORÁRIOS MAIS ATIVOS:', JSON.stringify(hourPattern.rows, null, 2));

  // 12. Listas de contatos
  console.log('\n=== LISTAS DE CONTATOS ===');
  const lists = await db.select().from(contactLists).where(eq(contactLists.companyId, companyId));
  console.log('LISTS:', JSON.stringify(lists, null, 2));

  // 13. Contatos com customFields preenchidos (indicadores de intenção)
  console.log('\n=== CONTATOS COM CAMPOS PERSONALIZADOS ===');
  const contactsWithCustomFields = await db.execute(sql`
    SELECT name, phone, custom_fields, notes, vak_profile, created_at
    FROM contacts
    WHERE company_id = ${companyId}
      AND deleted_at IS NULL
      AND (custom_fields IS NOT NULL AND custom_fields != '{}'::jsonb)
    ORDER BY created_at DESC
    LIMIT 50
  `);
  console.log('CONTACTS WITH CUSTOM FIELDS:', JSON.stringify(contactsWithCustomFields.rows, null, 2));

  // 14. Kanban leads com notas (informações sobre interesse)
  console.log('\n=== LEADS COM NOTAS ===');
  const leadsWithNotes = await db.execute(sql`
    SELECT 
      kl.title, kl.notes, kl.value, kl.stage_id,
      kl.current_stage->>'title' as stage_name,
      kl.current_stage->>'type' as stage_type,
      kl.created_at, kl.updated_at,
      c.name as contact_name, c.phone as contact_phone,
      c.notes as contact_notes, c.custom_fields
    FROM kanban_leads kl
    JOIN contacts c ON c.id = kl.contact_id
    WHERE kl.company_id = ${companyId}
      AND (kl.notes IS NOT NULL AND kl.notes != '')
    ORDER BY kl.updated_at DESC
    LIMIT 50
  `);
  console.log('LEADS WITH NOTES:', JSON.stringify(leadsWithNotes.rows, null, 2));

  // 15. Amostra de mensagens recentes para entender contexto
  console.log('\n=== AMOSTRA DE CONVERSAS RECENTES (últimas 10) ===');
  const recentConvSample = await db.execute(sql`
    SELECT 
      conv.id, conv.status, conv.created_at,
      c.name as contact_name, c.phone,
      (SELECT content FROM messages WHERE conversation_id = conv.id ORDER BY sent_at ASC LIMIT 1) as first_message,
      (SELECT content FROM messages WHERE conversation_id = conv.id ORDER BY sent_at DESC LIMIT 1) as last_message,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = conv.id) as message_count
    FROM conversations conv
    JOIN contacts c ON c.id = conv.contact_id
    WHERE conv.company_id = ${companyId}
    ORDER BY conv.last_message_at DESC
    LIMIT 10
  `);
  console.log('RECENT CONVERSATIONS:', JSON.stringify(recentConvSample.rows, null, 2));

  console.log('\n=== FIM DO RELATÓRIO RAW ===');
  process.exit(0);
}

generateDilascioReport().catch(e => { console.error('ERROR:', e); process.exit(1); });
