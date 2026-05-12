import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { contacts, companies } from '../src/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import xlsx from 'xlsx';

const TARGET_IDENTIFIER = 'f28e5adf-ce84-436b-94c5-cd3941f254b7';
const FILE_PATH = 'kommo_export_leads_2026-05-11.xlsx';

async function importCustomFields() {
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

  console.log(`Lendo arquivo Excel...`);
  const wb = xlsx.readFile(FILE_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet) as any[];

  console.log(`Encontrados ${data.length} registros. Processando em lotes para atualização...`);

  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < data.length; i += 200) {
    const chunk = data.slice(i, i + 200);
    
    // Preparar as atualizações
    const updatePromises = chunk.map(async (row) => {
      const externalId = String(row['ID']);
      
      const customFields: Record<string, string> = {};
      
      if (row['Score']) customFields['score'] = String(row['Score']);
      if (row['Perfil']) customFields['perfil'] = String(row['Perfil']);
      if (row['Posição (contato)']) customFields['posicao'] = String(row['Posição (contato)']);
      if (row['Instagram']) customFields['instagram'] = String(row['Instagram']);
      if (row['N° de Colaboradores']) customFields['numero_colaboradores'] = String(row['N° de Colaboradores']);
      if (row['Segmento/Nicho']) customFields['nicho'] = String(row['Segmento/Nicho']);
      if (row['Principal Objetivo']) customFields['objetivo'] = String(row['Principal Objetivo']);
      if (row['Investimento']) customFields['investimento'] = String(row['Investimento']);
      if (row['Faturamento']) customFields['faturamento'] = String(row['Faturamento']);
      if (row['UTM Campaing']) customFields['utm_campaign'] = String(row['UTM Campaing']);
      if (row['UTM Medium']) customFields['utm_medium'] = String(row['UTM Medium']);
      if (row['UTM Source']) customFields['utm_source'] = String(row['UTM Source']);
      if (row['UTM Content']) customFields['utm_content'] = String(row['UTM Content']);

      // Apenas fazemos update se tiver algum campo customizado
      if (Object.keys(customFields).length > 0) {
        try {
          await db.update(contacts)
            .set({ customFields })
            .where(
              and(
                eq(contacts.companyId, COMPANY_ID),
                eq(contacts.externalId, externalId),
                eq(contacts.externalProvider, 'kommo')
              )
            );
          return true;
        } catch (err) {
          console.error(`Erro ao atualizar externalId ${externalId}:`, err);
          return false;
        }
      }
      return false; // Sem dados pra atualizar
    });

    const results = await Promise.all(updatePromises);
    const successCount = results.filter(r => r === true).length;
    processed += successCount;
    skipped += (chunk.length - successCount);

    console.log(`Lote finalizado. Total processado com sucesso: ${processed}/${data.length}`);
  }

  console.log(`\n=== RESUMO DO ENRIQUECIMENTO ===`);
  console.log(`Contatos atualizados com Custom Fields: ${processed}`);
  console.log(`Sem campos ou erros: ${skipped}`);
  
  process.exit(0);
}

importCustomFields().catch(console.error);
