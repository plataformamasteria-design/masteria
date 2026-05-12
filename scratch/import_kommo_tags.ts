import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { tags, contactsToTags, contacts, companies } from '../src/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import xlsx from 'xlsx';
import crypto from 'crypto';

const TARGET_IDENTIFIER = 'f28e5adf-ce84-436b-94c5-cd3941f254b7';
const FILE_PATH = 'kommo_export_leads_2026-05-11.xlsx';

const getRandomColor = () => {
  const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];
  return colors[Math.floor(Math.random() * colors.length)];
};

async function importTags() {
  console.log('Conectando ao banco de dados...');
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

  const wb = xlsx.readFile(FILE_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet) as any[];

  console.log(`Buscando todas as tags da empresa para não duplicar...`);
  const existingTags = await db.select().from(tags).where(eq(tags.companyId, COMPANY_ID));
  const tagMap = new Map(existingTags.map(t => [t.name.trim().toLowerCase(), t.id]));

  console.log(`Extraindo tags do Excel...`);
  
  const allExcelTags = new Set<string>();
  data.forEach(row => {
    const rawTags = row['Lead tags'];
    if (rawTags) {
      const splitTags = String(rawTags).split(',').map(t => t.trim()).filter(Boolean);
      splitTags.forEach(t => allExcelTags.add(t));
    }
  });

  const newTagsToInsert = [];
  for (const tagName of allExcelTags) {
    if (!tagMap.has(tagName.toLowerCase())) {
      const newId = crypto.randomUUID();
      newTagsToInsert.push({
        id: newId,
        companyId: COMPANY_ID,
        name: tagName,
        color: getRandomColor()
      });
      tagMap.set(tagName.toLowerCase(), newId);
    }
  }

  if (newTagsToInsert.length > 0) {
    console.log(`Criando ${newTagsToInsert.length} novas tags mestre...`);
    await db.insert(tags).values(newTagsToInsert).onConflictDoNothing();
  } else {
    console.log('Nenhuma tag mestre nova necessária.');
  }

  console.log(`Mapeando contatos do banco...`);
  const allContacts = await db.select({ id: contacts.id, externalId: contacts.externalId, phone: contacts.phone }).from(contacts).where(eq(contacts.companyId, COMPANY_ID));
  const contactMap = new Map();
  allContacts.forEach(c => {
    if (c.externalId) contactMap.set(c.externalId, c.id);
    contactMap.set(c.phone, c.id);
  });

  const linksToInsert = [];
  const uniqueLinks = new Set<string>();

  for (const row of data) {
    const rawTags = row['Lead tags'];
    if (!rawTags) continue;

    const externalId = String(row['ID']);
    let phone = String(row['Telefone comercial (contato)'] || '').replace(/\D/g, '');
    if (!phone) phone = 'SEM_TELEFONE_' + row['ID'];

    const contactId = contactMap.get(externalId) || contactMap.get(phone);
    if (!contactId) continue;

    const splitTags = String(rawTags).split(',').map(t => t.trim()).filter(Boolean);
    for (const tagName of splitTags) {
      const tagId = tagMap.get(tagName.toLowerCase());
      if (tagId) {
        const linkKey = `${contactId}_${tagId}`;
        if (!uniqueLinks.has(linkKey)) {
          uniqueLinks.add(linkKey);
          linksToInsert.push({
            contactId,
            tagId,
            companyId: COMPANY_ID
          });
        }
      }
    }
  }

  console.log(`Inserindo ${linksToInsert.length} associações de tags aos contatos em lotes...`);
  
  let linksInserted = 0;
  for (let i = 0; i < linksToInsert.length; i += 1000) {
    const chunk = linksToInsert.slice(i, i + 1000);
    if (chunk.length > 0) {
        await db.insert(contactsToTags).values(chunk).onConflictDoNothing();
        linksInserted += chunk.length;
    }
  }

  console.log(`✅ Importação de tags concluída com sucesso! ${newTagsToInsert.length} tags criadas, ${linksInserted} conexões feitas com os contatos.`);
  process.exit(0);
}

importTags().catch(console.error);
