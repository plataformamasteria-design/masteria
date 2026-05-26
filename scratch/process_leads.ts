require('dotenv').config({ path: '.env.local' });
import xlsx from 'xlsx';

async function main() {
  const { db } = await import('../src/lib/db');
  const { companies, kanbanBoards, kanbanLeads, contacts } = await import('../src/lib/db/schema');
  const { eq, ilike, and, inArray, lt } = await import('drizzle-orm');

  const funnelsConfig = [
    { name: 'FUNIL MENTORIA', file: 'C:/Users/Administrator/Desktop/MASTER-IA-PROJECT/FORM FUNIL/20260525-antonio-diagnostico-empresarial-funil-mentoria-mcbwxkbj5fafanbdr6gwp1xun.xlsx' },
    { name: 'FUNIL ENCONTRO DE CASAIS', file: 'C:/Users/Administrator/Desktop/MASTER-IA-PROJECT/FORM FUNIL/20260525-encontro-de-casais-n8lfobymxrhwthg63pkstay4x.xlsx' },
    { name: 'FUNIL EVENTO GCR', file: 'C:/Users/Administrator/Desktop/MASTER-IA-PROJECT/FORM FUNIL/20260525-antonio-3gcr-inside-sales-dictqrqo2yzjrvysh1n4o1xhb.xlsx' },
    { name: 'FUNIL EDN [ATUAL]', file: 'C:/Users/Administrator/Desktop/MASTER-IA-PROJECT/FORM FUNIL/20260525-aplicacao-7-edn-encontro-de-negocios-alphaville-antonio-rgtdin8xjmwdsjnylppi43djh.xlsx' }
  ];

  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Empresa de Desenvolvimento Master%')
  });

  if (!company) {
    console.log('Company not found!');
    process.exit(1);
  }

  let totalToDelete = 0;
  const cutoffDate = new Date('2026-05-19T00:00:00-03:00'); 

  for (const config of funnelsConfig) {
    console.log(`\n--- Processing ${config.name} ---`);
    const board = await db.query.kanbanBoards.findFirst({
      where: and(eq(kanbanBoards.companyId, company.id), eq(kanbanBoards.name, config.name))
    });

    if (!board) {
      console.log(`Board ${config.name} not found!`);
      continue;
    }

    const firstStageId = board.stages[0]?.id;
    console.log(`Board ID: ${board.id} | First Stage: ${board.stages[0]?.title} (${firstStageId})`);

    const workbook = xlsx.readFile(config.file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet) as any[];

    console.log(`Excel has ${data.length} rows.`);

    const targetPhones = data.map(row => {
      let phone = row["Descreva um número que podemos entrar em contato"] || row["Qual seu Whatsapp?"] || row["Phone"] || row["Telefone"] || row["Celular"];
      if (!phone) {
        const key = Object.keys(row).find(k => k.toLowerCase().includes('whatsapp') || k.toLowerCase().includes('número') || k.toLowerCase().includes('telefone') || k.toLowerCase().includes('celular') || k.toLowerCase().includes('contato'));
        if (key) phone = row[key];
      }
      if (phone) return String(phone).replace(/\D/g, '');
      return null;
    }).filter(Boolean);

    console.log(`Extracted ${targetPhones.length} valid phone numbers from Excel.`);

    if (targetPhones.length === 0) continue;

    // chunking to avoid "too many parameters" if array is large (Postgres max is 65535, but smaller is better)
    let matchedContacts: any[] = [];
    const chunkSize = 500;
    for (let i = 0; i < targetPhones.length; i += chunkSize) {
      const chunk = targetPhones.slice(i, i + chunkSize);
      const res = await db.query.contacts.findMany({
        where: and(eq(contacts.companyId, company.id), inArray(contacts.phone, chunk as string[]))
      });
      matchedContacts = matchedContacts.concat(res);
    }

    console.log(`Matched ${matchedContacts.length} contacts in DB.`);

    if (matchedContacts.length === 0) continue;

    const contactIds = matchedContacts.map(c => c.id);

    let leadsToDelete: any[] = [];
    for (let i = 0; i < contactIds.length; i += chunkSize) {
      const chunk = contactIds.slice(i, i + chunkSize);
      const res = await db.query.kanbanLeads.findMany({
        where: and(
          eq(kanbanLeads.boardId, board.id),
          eq(kanbanLeads.stageId, firstStageId),
          inArray(kanbanLeads.contactId, chunk),
          lt(kanbanLeads.createdAt, cutoffDate)
        ),
        with: { contact: true }
      });
      leadsToDelete = leadsToDelete.concat(res);
    }

    console.log(`Found ${leadsToDelete.length} leads in first stage created before 19/05/2026.`);
    totalToDelete += leadsToDelete.length;

    // ACTUALLY DELETE THEM (if there are any)
    if (leadsToDelete.length > 0) {
      const idsToDelete = leadsToDelete.map(l => l.id);
      console.log(`Deleting ${idsToDelete.length} leads...`);
      for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        await db.delete(kanbanLeads).where(inArray(kanbanLeads.id, chunk));
      }
      console.log('✅ Delete complete for this funnel.');
    }
  }

  console.log(`\nTotal leads deleted across all boards: ${totalToDelete}`);
  process.exit(0);
}

main().catch(console.error);
