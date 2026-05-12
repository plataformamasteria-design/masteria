import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { kanbanBoards, kanbanLeads, contacts, companies } from '../src/lib/db/schema';
import { eq, and, or, sql as dSql } from 'drizzle-orm';
import xlsx from 'xlsx';

const TARGET_IDENTIFIER = 'f28e5adf-ce84-436b-94c5-cd3941f254b7';
const FUNNEL_NAME = 'FUNIL EDN [ATUAL]';
const FILE_PATH = 'kommo_export_leads_2026-05-11.xlsx';

async function importLeadsBatch() {
  console.log(`Conectando ao banco de dados...`);
  const sql = postgres(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const companyResults = await db.select().from(companies).where(
    or(eq(companies.id, TARGET_IDENTIFIER), eq(companies.webhookSlug, TARGET_IDENTIFIER))
  ).limit(1);

  if (companyResults.length === 0) {
    console.error(`❌ Empresa não encontrada!`);
    process.exit(1);
  }
  const COMPANY_ID = companyResults[0].id;

  const boards = await db.select().from(kanbanBoards).where(
    and(eq(kanbanBoards.companyId, COMPANY_ID), eq(kanbanBoards.name, FUNNEL_NAME))
  ).limit(1);

  if (boards.length === 0) {
    console.error(`❌ Funil não encontrado!`);
    process.exit(1);
  }
  
  const board = boards[0];
  const stages = board.stages as { id: string, title: string }[];
  
  const wb = xlsx.readFile(FILE_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet) as any[];

  console.log(`Encontrados ${data.length} registros. Processando em lotes...`);

  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < data.length; i += 200) {
    const chunk = data.slice(i, i + 200);
    const contactsPayload = [];
    const leadsPayloadMap = new Map();

    for (const row of chunk) {
      let phone = String(row['Telefone comercial (contato)'] || '').replace(/\D/g, '');
      if (!phone) phone = 'SEM_TELEFONE_' + row['ID'];

      const email = row['Email comercial (contato)'] || null;
      let name = row['Contato principal'] || row['Lead título'] || 'Contato Desconhecido';

      const stageName = row['Etapa do lead'];
      const stageObj = stages.find(s => s.title === stageName);
      const stageId = stageObj ? stageObj.id : stages[0].id;

      let value = String(row['Venda'] || '0').replace(/[^\d.,]/g, '').replace(',', '.');
      if (isNaN(parseFloat(value))) value = '0';

      const externalId = String(row['ID']);

      contactsPayload.push({
        companyId: COMPANY_ID,
        phone,
        name,
        email,
        status: 'ACTIVE',
        externalId,
        externalProvider: 'kommo'
      });

      // Keep only the first mapping per phone in a chunk to avoid unique constraint collisions within the same array
      if (!leadsPayloadMap.has(phone)) {
        leadsPayloadMap.set(phone, {
          companyId: COMPANY_ID,
          boardId: board.id,
          stageId,
          title: row['Lead título'] || name,
          value,
          externalId,
          externalProvider: 'kommo'
        });
      }
    }

    // Deduplicate contacts payload before inserting to prevent multiple inserts of same phone in one chunk
    const uniqueContactsPayload = Array.from(new Map(contactsPayload.map(c => [c.phone, c])).values());

    try {
      const insertedContacts = await db.insert(contacts)
        .values(uniqueContactsPayload)
        .onConflictDoUpdate({
          target: [contacts.phone, contacts.companyId],
          set: { name: dSql`EXCLUDED.name`, email: dSql`EXCLUDED.email` }
        })
        .returning({ id: contacts.id, phone: contacts.phone });

      const leadsPayload = insertedContacts.map(c => {
        const leadData = leadsPayloadMap.get(c.phone);
        return {
          ...leadData,
          contactId: c.id
        };
      }).filter(Boolean); // Filter out any undefined

      if (leadsPayload.length > 0) {
        await db.insert(kanbanLeads)
          .values(leadsPayload)
          .onConflictDoUpdate({
            target: [kanbanLeads.externalId, kanbanLeads.externalProvider],
            set: { stageId: dSql`EXCLUDED.stage_id`, title: dSql`EXCLUDED.title`, value: dSql`EXCLUDED.value` }
          });
      }

      processed += chunk.length;
      console.log(`Lote finalizado. Total processado: ${processed}/${data.length}`);
    } catch (err) {
      console.error(`Erro no lote ${i} - ${i + 200}:`, err);
      skipped += chunk.length;
    }
  }

  console.log(`\n=== RESUMO DA IMPORTAÇÃO ===`);
  console.log(`Processados com sucesso: ${processed}`);
  console.log(`Pulados (Erro): ${skipped}`);
  
  process.exit(0);
}

importLeadsBatch().catch(console.error);
