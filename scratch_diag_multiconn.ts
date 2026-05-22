import 'dotenv/config';
import { db } from './src/lib/db';
import { companies, connections, contacts, conversations, messages, webhookLogs } from './src/lib/db/schema';
import { eq, and, ilike, desc, gte, or } from 'drizzle-orm';

async function main() {
  const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'; // Empresa de Desenvolvimento Master
  const BRUNO_CONN_ID = '29e9fc09-7572-4175-ab98-749ad08f16cb';
  const HEITOR_CONN_ID = '8f2c21fa-04be-4b26-9063-a9fc90a8f70b';

  console.log('\n========================================');
  console.log('DIAGNÓSTICO DETALHADO — Empresa de Desenvolvimento Master');
  console.log('========================================\n');

  // 1. Verificar status REAL das duas conexões
  const [bruno] = await db.select().from(connections).where(eq(connections.id, BRUNO_CONN_ID));
  const [heitor] = await db.select().from(connections).where(eq(connections.id, HEITOR_CONN_ID));

  console.log('📡 CONEXÃO BRUNO MACEDO:');
  console.log(`  status=${bruno?.status} | isActive=${bruno?.isActive} | sessionName=${bruno?.sessionName}`);
  console.log(`  wahaUrl=${bruno?.wahaUrl || 'N/A'} | phone=${bruno?.phone || 'N/A'}`);
  console.log(`  connectionType=${bruno?.connectionType}`);

  console.log('\n📡 CONEXÃO HEITOR SANTOS:');
  console.log(`  status=${heitor?.status} | isActive=${heitor?.isActive} | sessionName=${heitor?.sessionName}`);
  console.log(`  wahaUrl=${heitor?.wahaUrl || 'N/A'} | phone=${heitor?.phone || 'N/A'}`);
  console.log(`  connectionType=${heitor?.connectionType}`);

  // 2. Encontrar o Deivid Rodrigues nessa empresa
  const [contact] = await db.select().from(contacts)
    .where(and(
      eq(contacts.companyId, COMPANY_ID),
      or(
        ilike(contacts.name, '%deivid%'),
        ilike(contacts.phone, '%5588920008007%'),
        ilike(contacts.phone, '+5588920008007%'),
      )
    ))
    .orderBy(desc(contacts.createdAt))
    .limit(1);

  if (!contact) {
    console.log('\n❌ Contato Deivid Rodrigues (5588920008007) não encontrado na Empresa de Desenvolvimento Master');
    console.log('   Isso significa: a mensagem via Heitor Santos NUNCA chegou ao webhook (ou chegou mas o contato não foi criado)');
    
    // Verificar logs de webhook recentes para ver se Heitor chegou a receber algo
    const twoHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const recentLogs = await db.select({
      id: webhookLogs.id,
      payload: webhookLogs.payload,
      createdAt: webhookLogs.createdAt,
    }).from(webhookLogs)
      .where(and(
        eq(webhookLogs.companyId, COMPANY_ID),
        gte(webhookLogs.createdAt, twoHoursAgo)
      ))
      .orderBy(desc(webhookLogs.createdAt))
      .limit(5);
    
    console.log(`\n📋 ÚLTIMOS WEBHOOK LOGS (Meta) da empresa nas últimas 3h: ${recentLogs.length}`);
    for (const log of recentLogs) {
      const p = log.payload as any;
      const from = p?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.wa_id || 'N/A';
      const phoneId = p?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || 'N/A';
      console.log(`  [${log.createdAt?.toISOString()}] from=${from} | phone_number_id=${phoneId}`);
    }
    process.exit(0);
  }

  console.log(`\n👤 CONTATO: ${contact.name} | phone=${contact.phone} | id=${contact.id}`);

  // 3. Verificar conversa desse contato
  const convs = await db.select({
    id: conversations.id,
    connectionId: conversations.connectionId,
    status: conversations.status,
    lastMessageAt: conversations.lastMessageAt,
    createdAt: conversations.createdAt,
  }).from(conversations)
    .where(and(
      eq(conversations.contactId, contact.id),
      eq(conversations.companyId, COMPANY_ID),
    ))
    .orderBy(desc(conversations.lastMessageAt));

  console.log(`\n💬 CONVERSAS DO CONTATO (${convs.length}):`);
  for (const cv of convs) {
    const connName = cv.connectionId === BRUNO_CONN_ID ? 'Bruno Macedo'
      : cv.connectionId === HEITOR_CONN_ID ? 'Heitor Santos'
      : cv.connectionId || 'SEM CONEXÃO';
    console.log(`  → id=${cv.id} | conexão=${connName} | status=${cv.status} | lastMsg=${cv.lastMessageAt?.toISOString()}`);
  }

  if (convs.length === 0) {
    console.log('  ❌ Nenhuma conversa encontrada para este contato nesta empresa');
    process.exit(0);
  }

  // 4. Últimas mensagens de TODAS as conversas desse contato
  for (const conv of convs) {
    const lastMsgs = await db.select({
      content: messages.content,
      senderType: messages.senderType,
      connectionId: messages.connectionId,
      sentAt: messages.sentAt,
      providerMessageId: messages.providerMessageId,
    }).from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(desc(messages.sentAt))
      .limit(8);

    console.log(`\n📨 MENSAGENS da conversa ${conv.id.substring(0, 8)}...:`);
    for (const m of lastMsgs) {
      const connName = m.connectionId === BRUNO_CONN_ID ? '🟢 Bruno Macedo'
        : m.connectionId === HEITOR_CONN_ID ? '🔵 Heitor Santos'
        : m.connectionId || '⚪ SEM CONEXÃO';
      console.log(`  [${m.sentAt?.toISOString()}] ${m.senderType} via ${connName} | "${m.content?.substring(0, 60)}"`);
    }
  }

  // 5. Verificar se o "Bom dia" via Heitor chegou mas foi bloqueado por deduplicação
  console.log('\n========================================');
  console.log('INVESTIGANDO "BOM DIA" NAS ÚLTIMAS 3H');
  console.log('========================================\n');

  const allBomDia = await db.select({
    content: messages.content,
    sentAt: messages.sentAt,
    connectionId: messages.connectionId,
    conversationId: messages.conversationId,
    providerMessageId: messages.providerMessageId,
  }).from(messages)
    .where(and(
      ilike(messages.content, '%bom dia%'),
      gte(messages.sentAt, new Date(Date.now() - 3 * 60 * 60 * 1000))
    ))
    .orderBy(desc(messages.sentAt))
    .limit(20);

  console.log(`  Total de mensagens "Bom dia" nas últimas 3h: ${allBomDia.length}`);
  for (const m of allBomDia) {
    const [conv] = await db.select({ companyId: conversations.companyId, contactId: conversations.contactId })
      .from(conversations).where(eq(conversations.id, m.conversationId));
    if (conv?.companyId !== COMPANY_ID) continue;
    const connName = m.connectionId === BRUNO_CONN_ID ? '🟢 Bruno Macedo'
      : m.connectionId === HEITOR_CONN_ID ? '🔵 Heitor Santos'
      : m.connectionId || '?';
    console.log(`  [${m.sentAt?.toISOString()}] via ${connName} | msgId=${m.providerMessageId} | conv=${m.conversationId.substring(0,8)}`);
  }

  console.log('\n========================================');
  console.log('CONCLUSÃO DO DIAGNÓSTICO');
  console.log('========================================\n');
  console.log('Heitor status:', heitor?.status, '| isActive:', heitor?.isActive);
  console.log('Bruno  status:', bruno?.status,  '| isActive:', bruno?.isActive);
  
  process.exit(0);
}

main().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });
