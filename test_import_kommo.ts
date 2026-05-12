import { db } from './src/lib/db';
import { companies } from './src/lib/db/schema';
import * as xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { kanbanBoards, kanbanLeads, contacts, tags, contactsToTags } from './src/lib/db/schema';
import { eq, and } from 'drizzle-orm';

function cleanPhone(phone: string | undefined | null) {
  if (!phone) return null;
  const cleaned = phone.toString().replace(/\D/g, '');
  if (!cleaned) return null;
  if (cleaned.length < 10) return null; // Inválido
  // Se não tem DDI, assume +55
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `55${cleaned}`;
  }
  return cleaned;
}

async function run() {
  console.log('Buscando companyId válido...');
  const [company] = await db.select().from(companies).limit(1);
  if (!company) {
    console.error('Nenhuma company encontrada.');
    process.exit(1);
  }
  const companyId = company.id;
  console.log(`Usando companyId: ${companyId}`);

  const filePath = 'kommo_export_leads_2026-05-11.xlsx';

  console.log('Reading file...');
  const buffer = fs.readFileSync(filePath);
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  
  const data: any[] = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`Found ${data.length} rows.`);

  let leadsCount = 0;

  const boardsCache = new Map<string, any>();
  const tagsCache = new Map<string, string>();

  const existingBoards = await db.select().from(kanbanBoards).where(eq(kanbanBoards.companyId, companyId));
  existingBoards.forEach(b => boardsCache.set(b.name.toLowerCase().trim(), b));

  for (const row of data) {
    const funnelName = (row['Funil de vendas'] || 'Funil Importado').toString().trim();
    const stageName = (row['Etapa do lead'] || 'Nova Oportunidade').toString().trim();
    const leadTitle = (row['Lead título'] || 'Lead sem nome').toString().trim();
    const contactName = (row['Contato principal'] || row['Nome'] || leadTitle).toString().trim();
    
    const phoneRaw = row['Telefone comercial (contato)'] || row['Celular (contato)'] || row['Tel. direto com. (contato)'];
    const phone = cleanPhone(phoneRaw);
    
    const email = (row['Email comercial (contato)'] || row['Email pessoal (contato)'] || '').toString().trim();
    const value = parseFloat(row['Venda']) || 0;
    const rawTags = (row['Lead tags'] || '').toString().split(',').map((t: string) => t.trim()).filter(Boolean);

    const standardKeys = [
      'ID', 'Lead título', 'Contato principal', 'Etapa do lead', 'Funil de vendas', 'Venda',
      'Data Criada', 'Criado por', 'Última modificação', 'Modificado por', 'Lead tags',
      'Telefone comercial (contato)', 'Celular (contato)', 'Tel. direto com. (contato)',
      'Email comercial (contato)', 'Email pessoal (contato)', 'Empresa lead \'s', 'Empresa do contato',
      'Lead usuário responsável'
    ];

    const customFields: Record<string, string> = {};
    for (const [key, val] of Object.entries(row)) {
      if (!standardKeys.includes(key) && val !== '') {
        customFields[key] = String(val);
      }
    }

    let board = boardsCache.get(funnelName.toLowerCase());
    if (!board) {
      console.log(`Criando board: ${funnelName}`);
      const newBoardId = uuidv4();
      const initialStage = {
        id: uuidv4(),
        title: stageName,
        type: 'NEUTRAL'
      };
      const [insertedBoard] = await db.insert(kanbanBoards).values({
        id: newBoardId,
        companyId,
        name: funnelName,
        funnelType: 'GENERAL',
        stages: [initialStage]
      }).returning();
      board = insertedBoard;
      boardsCache.set(funnelName.toLowerCase(), board);
    }

    let stages = Array.isArray(board.stages) ? [...board.stages] : [];
    let stage = stages.find((s: any) => s.title.toLowerCase().trim() === stageName.toLowerCase());
    if (!stage) {
      console.log(`Criando stage: ${stageName}`);
      stage = {
        id: uuidv4(),
        title: stageName,
        type: 'NEUTRAL'
      };
      stages.push(stage);
      
      await db.update(kanbanBoards)
        .set({ stages })
        .where(eq(kanbanBoards.id, board.id));
        
      board.stages = stages;
      boardsCache.set(funnelName.toLowerCase(), board);
    }

    const safePhone = phone || `55000000${Math.floor(Math.random() * 1000000)}`;
    
    let [contact] = await db.select().from(contacts).where(
      and(eq(contacts.companyId, companyId), eq(contacts.phone, safePhone))
    );

    if (!contact) {
      const [inserted] = await db.insert(contacts).values({
        companyId,
        name: contactName,
        phone: safePhone,
        email: email || null,
        customFields
      }).returning();
      contact = inserted;
    } else {
      const mergedCustomFields = {
        ...(contact.customFields as Record<string, string> || {}),
        ...customFields
      };
      await db.update(contacts).set({ customFields: mergedCustomFields }).where(eq(contacts.id, contact.id));
    }

    for (const tagName of rawTags) {
      let tagId = tagsCache.get(tagName.toLowerCase());
      if (!tagId) {
        const [existingTag] = await db.select().from(tags).where(
          and(eq(tags.companyId, companyId), eq(tags.name, tagName))
        );
        if (existingTag) {
          tagId = existingTag.id;
        } else {
          const [newTag] = await db.insert(tags).values({
            companyId,
            name: tagName,
            color: '#10b981'
          }).returning();
          tagId = newTag.id;
        }
        tagsCache.set(tagName.toLowerCase(), tagId!);
      }

      try {
        await db.insert(contactsToTags).values({
          contactId: contact.id,
          tagId: tagId,
          companyId
        }).onConflictDoNothing();
      } catch (e) {
      }
    }

    await db.insert(kanbanLeads).values({
      companyId,
      boardId: board.id,
      stageId: stage.id,
      contactId: contact.id,
      title: leadTitle,
      value: value.toString(),
      currentStage: stage
    });

    leadsCount++;
  }

  console.log(`Success! Imported ${leadsCount} leads.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
