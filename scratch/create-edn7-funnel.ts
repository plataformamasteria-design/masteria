import { db } from '../src/lib/db';
import { companies, kanbanBoards, contactLists, contactsToContactLists, kanbanLeads, contacts } from '../src/lib/db/schema';
import { eq, ilike, and } from 'drizzle-orm';
import crypto from 'crypto';

async function run() {
  try {
    console.log('Procurando a organização "Empresa de desenvolvimento Master"...');
    const [company] = await db.select().from(companies).where(ilike(companies.name, '%Empresa de desenvolvimento Master%'));
    
    if (!company) {
      console.error('Organização não encontrada.');
      process.exit(1);
    }
    console.log(`Organização encontrada: ${company.name} (ID: ${company.id})`);

    console.log('Procurando a lista "Disparofinalconvidados"...');
    const [list] = await db.select().from(contactLists).where(and(
      ilike(contactLists.name, '%Disparofinalconvidados%'),
      eq(contactLists.companyId, company.id)
    ));

    if (!list) {
      console.error('Lista não encontrada.');
      process.exit(1);
    }
    console.log(`Lista encontrada: ${list.name} (ID: ${list.id})`);

    const stages = [
      { id: crypto.randomUUID(), title: 'Lead Novo', type: 'NEUTRAL' },
      { id: crypto.randomUUID(), title: 'Tent de Lig 1', type: 'NEUTRAL' },
      { id: crypto.randomUUID(), title: 'Tent de Lig 2', type: 'NEUTRAL' },
      { id: crypto.randomUUID(), title: 'Lig Concluida', type: 'WIN' },
      { id: crypto.randomUUID(), title: 'Ligação Falha', type: 'LOSS' },
    ] as any;

    console.log('Criando o funil "Funil de Ligação EDN7"...');
    const [board] = await db.insert(kanbanBoards).values({
      companyId: company.id,
      name: 'Funil de Ligação EDN7',
      funnelType: 'GENERAL',
      stages: stages,
      settings: {}
    }).returning();
    
    console.log(`Funil criado com sucesso (ID: ${board.id})`);

    console.log('Buscando leads da lista sem filtro de companyId...');
    const listContacts = await db.select({ contactId: contactsToContactLists.contactId })
      .from(contactsToContactLists)
      .where(eq(contactsToContactLists.listId, list.id));
      
    console.log(`Foram encontrados ${listContacts.length} leads na lista (sem filtro de companyId).`);
    
    if (listContacts.length > 0) {
      console.log('Inserindo leads no funil...');
      
      const leadPayloads = listContacts.map(lc => ({
        companyId: company.id,
        boardId: board.id,
        stageId: stages[0].id,
        contactId: lc.contactId,
        status: 'ACTIVE',
        value: '0',
      }));

      const batchSize = 1000;
      for (let i = 0; i < leadPayloads.length; i += batchSize) {
        const batch = leadPayloads.slice(i, i + batchSize);
        await db.insert(kanbanLeads).values(batch).onConflictDoNothing();
        console.log(`Lote ${i/batchSize + 1} inserido (${batch.length} leads)`);
      }
      
      console.log('Todos os leads foram importados com sucesso para a primeira etapa!');
    }


  } catch (error: any) {
    console.error('Erro na execução:', error);
  }
  process.exit(0);
}

run();
