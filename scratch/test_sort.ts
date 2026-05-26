require('dotenv').config({ path: '.env.local' });
async function main() {
  const { db } = await import('../src/lib/db');
  const { kanbanBoards } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  // Let's use the actual fetchLeadsData logic from route.ts to see what it returns
  // For the funnel ENCONTRO DE CASAIS
  const boardId = '72e90627-1f9c-493e-a243-71ef668c021a'; 
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

  // I will just copy the fetch logic here to debug
  const { kanbanLeads, contacts, conversations, messages } = await import('../src/lib/db/schema');
  const { and, asc, inArray, min } = await import('drizzle-orm');

  const [board] = await db.select().from(kanbanBoards).where(and(
    eq(kanbanBoards.id, boardId),
    eq(kanbanBoards.companyId, companyId)
  ));

  const flatLeadsAndContacts = await db
    .select({
      lead: kanbanLeads,
      contact: {
        id: contacts.id,
        name: contacts.name,
      },
    })
    .from(kanbanLeads)
    .innerJoin(contacts, eq(kanbanLeads.contactId, contacts.id))
    .where(eq(kanbanLeads.boardId, boardId))
    .orderBy(asc(kanbanLeads.createdAt));

  const leads = flatLeadsAndContacts.map(r => ({ ...r.lead, contact: r.contact }));

  const stagesList = (board.stages as any[]) || [];
  const novoLeadStageIds = new Set(
    stagesList
      .filter((s: any, idx: number) => {
        const t = (s.title || '').toLowerCase();
        return idx === 0 || t.includes('lead novo') || t.includes('novo lead');
      })
      .map((s: any) => s.id)
  );

  console.log('First stage IDs:', Array.from(novoLeadStageIds));

  leads.sort((a: any, b: any) => {
      const getSortTime = (leadObj: any) => {
          if (novoLeadStageIds.has(leadObj.stageId)) {
              return leadObj.createdAt ? new Date(leadObj.createdAt).getTime() : 0;
          }
          const time1 = 0;
          const time2 = leadObj.createdAt ? new Date(leadObj.createdAt).getTime() : 0;
          return Math.max(time1, time2);
      };

      const timeA = getSortTime(a);
      const timeB = getSortTime(b);
      return timeB - timeA;
  });

  const firstStageLeads = leads.filter(l => novoLeadStageIds.has(l.stageId));
  console.log(`First stage leads: ${firstStageLeads.length}`);
  
  firstStageLeads.forEach((l, i) => {
    if (l.contact.name.includes('Priscilla') || l.contact.name.includes('Kayra')) {
      console.log(`Pos ${i+1}: ${l.contact.name} | CreatedAt: ${l.createdAt}`);
    }
  });

  process.exit(0);
}
main().catch(console.error);
