import { db } from '../src/lib/db';
import { kanbanLeads, contacts, kanbanBoards, companies, kanbanStagePersonas, tags, contactsToTags } from '../src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { utmAutoRouterService } from '../src/services/utm-auto-router.service';
import { v4 as uuidv4 } from 'uuid';

async function runTest() {
  console.log('--- Iniciando Teste do UTM Auto Router ---');
  
  // 1. Pegar a primeira empresa
  const comps = await db.select().from(companies).limit(1);
  if (comps.length === 0) {
    console.error('Nenhuma empresa encontrada.');
    process.exit(1);
  }
  const company = comps[0];
  console.log(`Empresa selecionada: ${company.name} (${company.id})`);

  // 2. Garantir que existem os funis "FUNIL EVENTO GCR", "FUNIL MENTORIA" e "ENTRADA GERAL"
  let gcrBoard = await db.query.kanbanBoards.findFirst({ where: eq(kanbanBoards.name, 'FUNIL EVENTO GCR') });
  if (!gcrBoard) {
    const [b] = await db.insert(kanbanBoards).values({
      id: uuidv4(), companyId: company.id, name: 'FUNIL EVENTO GCR',
      stages: [{ id: uuidv4(), title: 'Lead Novo', type: 'NEUTRAL' }]
    }).returning();
    gcrBoard = b;
    console.log('Criado FUNIL EVENTO GCR');
  }

  let mentoriaBoard = await db.query.kanbanBoards.findFirst({ where: eq(kanbanBoards.name, 'FUNIL MENTORIA') });
  if (!mentoriaBoard) {
    const [b] = await db.insert(kanbanBoards).values({
      id: uuidv4(), companyId: company.id, name: 'FUNIL MENTORIA',
      stages: [{ id: uuidv4(), title: 'Lead Novo', type: 'NEUTRAL' }]
    }).returning();
    mentoriaBoard = b;
    console.log('Criado FUNIL MENTORIA');
  }

  let entradaBoard = await db.query.kanbanBoards.findFirst({ where: eq(kanbanBoards.name, 'ENTRADA GERAL') });
  if (!entradaBoard) {
    const [b] = await db.insert(kanbanBoards).values({
      id: uuidv4(), companyId: company.id, name: 'ENTRADA GERAL',
      stages: [{ id: uuidv4(), title: 'Lead Novo', type: 'NEUTRAL' }]
    }).returning();
    entradaBoard = b;
    console.log('Criado ENTRADA GERAL');
  }

  // 3. Criar contato de teste com UTM dupla
  const contactId = uuidv4();
  const [contact] = await db.insert(contacts).values({
    id: contactId,
    companyId: company.id,
    name: 'Teste Multi UTM ' + Date.now(),
    phone: '5511999999999',
    customFields: {
      utm_campaign: 'evento gcr, mentoria'
    }
  }).returning();
  console.log(`Contato criado com utm_campaign: "evento gcr, mentoria"`);

  // 4. Inserir Lead no funil genérico
  const [lead] = await db.insert(kanbanLeads).values({
    id: uuidv4(),
    companyId: company.id,
    boardId: entradaBoard.id,
    contactId: contact.id,
    stageId: (entradaBoard.stages as any[])[0].id,
    title: contact.name,
    currentStage: (entradaBoard.stages as any[])[0],
    lastStageChangeAt: new Date(),
  }).returning();
  console.log(`Lead criado no funil genérico (ENTRADA GERAL) com ID ${lead.id}`);

  // 5. Executar o auto router
  console.log('\n--- Executando utmAutoRouterService.processAllCompanies() ---');
  await (utmAutoRouterService as any).processAllCompanies();
  console.log('--- Execução concluída ---\n');

  // 6. Verificar os leads do contato
  const finalLeads = await db.select({
    id: kanbanLeads.id,
    boardId: kanbanLeads.boardId,
    boardName: kanbanBoards.name
  })
  .from(kanbanLeads)
  .innerJoin(kanbanBoards, eq(kanbanLeads.boardId, kanbanBoards.id))
  .where(eq(kanbanLeads.contactId, contact.id));

  console.log('Leads finais do contato:');
  for (const l of finalLeads) {
    console.log(`- Lead ID: ${l.id} | Funil: ${l.boardName}`);
  }

  // 7. Validação e limpeza
  const isGCR = finalLeads.some(l => l.boardName === 'FUNIL EVENTO GCR');
  const isMentoria = finalLeads.some(l => l.boardName === 'FUNIL MENTORIA');
  const isEntrada = finalLeads.some(l => l.boardName === 'ENTRADA GERAL');

  if (isGCR && isMentoria && !isEntrada && finalLeads.length === 2) {
    console.log('\n✅ TESTE PASSOU: O lead foi movido para o GCR e clonado para a MENTORIA perfeitamente.');
  } else {
    console.error('\n❌ TESTE FALHOU: O resultado esperado não foi atingido.');
  }

  // Clean up
  await db.delete(contacts).where(eq(contacts.id, contact.id));
  console.log('\nLixo de teste limpo. Fim.');
  process.exit(0);
}

runTest().catch(e => {
  console.error(e);
  process.exit(1);
});
