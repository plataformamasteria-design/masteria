import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { kanbanBoards, kanbanLeads, contacts, tags, contactsToTags } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import * as xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';


export const dynamic = 'force-dynamic';
export const maxDuration = 300; 

function cleanPhone(phone: string | undefined | null) {
  if (!phone) return null;
  const cleaned = phone.toString().replace(/\D/g, '');
  if (!cleaned) return null;
  if (cleaned.length < 10) return null;
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `55${cleaned}`;
  }
  return cleaned;
}

function extractFunnelFromUTM(row: any): string | null {
  // Find any UTM campaign key (case insensitive)
  const utmKey = Object.keys(row).find(k => k.toLowerCase().includes('utm_campaign') || k.toLowerCase().includes('utm campaing') || k.toLowerCase().includes('utm campaign'));
  
  if (!utmKey) return null;
  const utmValue = String(row[utmKey] || '').toUpperCase();
  
  if (!utmValue) return null;

  if (utmValue.includes('EVENTO-GCR') || utmValue.includes('GCR')) {
    return 'FUNIL EVENTO GCR';
  }
  if (utmValue.includes('ENCONTRO DE NEGOCIOS') || utmValue.includes('ENCONTRO PARA CASAIS') || utmValue.includes('CASAL DE NEGOCIOS') || utmValue.includes('EVENTO-CASAL')) {
    return 'FUNIL ENCONTRO DE CASAIS';
  }
  if (utmValue.includes('EDN')) {
    return 'FUNIL EDN [ATUAL]';
  }
  if (utmValue.includes('MENTORIA')) {
    return 'FUNIL MENTORIA';
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const targetFunnelName = formData.get('targetFunnelName') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    
    const data: any[] = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (data.length === 0) {
      return NextResponse.json({ error: 'Planilha vazia.' }, { status: 400 });
    }

    logger.debug(`[IMPORT KOMMO] Iniciando importação de ${data.length} linhas.`);

    // 1. Mapeamento de Memória
    const uniqueBoards = new Map<string, any>(); // nome -> { ...board }
    const uniqueTags = new Set<string>();
    const uniqueContacts = new Map<string, any>(); // phone -> { ...contactData }
    const leadsData: any[] = [];
    const contactTagsMap = new Map<string, Set<string>>(); // phone -> Set of tagNames

    const standardKeys = [
      'ID', 'Lead título', 'Contato principal', 'Etapa do lead', 'Funil de vendas', 'Venda',
      'Data Criada', 'Criado por', 'Última modificação', 'Modificado por', 'Lead tags',
      'Telefone comercial (contato)', 'Celular (contato)', 'Tel. direto com. (contato)',
      'Email comercial (contato)', 'Email pessoal (contato)', 'Empresa lead \'s', 'Empresa do contato',
      'Lead usuário responsável'
    ];

    // Carregar boards existentes
    const existingBoards = await db.select().from(kanbanBoards).where(eq(kanbanBoards.companyId, companyId));
    existingBoards.forEach(b => uniqueBoards.set(b.name.toLowerCase().trim(), b));

    let dummyCounter = 0;

    for (const row of data) {
      let funnelName = extractFunnelFromUTM(row);
      
      if (!funnelName) {
        if (targetFunnelName) {
          funnelName = targetFunnelName;
        } else {
          funnelName = (row['Funil de vendas'] || 'Funil Importado').toString().trim();
        }
      }

      const stageName = (row['Etapa do lead'] || 'Nova Oportunidade').toString().trim();
      const leadTitle = (row['Lead título'] || 'Lead sem nome').toString().trim();
      const contactName = (row['Contato principal'] || row['Nome'] || leadTitle).toString().trim();
      
      const phoneRaw = row['Telefone comercial (contato)'] || row['Celular (contato)'] || row['Tel. direto com. (contato)'];
      let phone = cleanPhone(phoneRaw);
      if (!phone) {
        dummyCounter++;
        phone = `55000000${dummyCounter.toString().padStart(6, '0')}`;
      }
      
      const email = (row['Email comercial (contato)'] || row['Email pessoal (contato)'] || '').toString().trim();
      const value = parseFloat(row['Venda']) || 0;
      const rawTags = (row['Lead tags'] || '').toString().split(',').map((t: string) => t.trim()).filter(Boolean);

      const customFields: Record<string, string> = {};
      for (const [key, val] of Object.entries(row)) {
        if (!standardKeys.includes(key) && val !== '') {
          customFields[key] = String(val);
        }
      }

      // Preparar Board & Stage localmente
      let board = uniqueBoards.get(funnelName.toLowerCase());
      if (!board) {
        board = {
          id: uuidv4(),
          companyId,
          name: funnelName,
          funnelType: 'GENERAL',
          stages: [{ id: uuidv4(), title: stageName, type: 'NEUTRAL' }],
          _isNew: true
        };
        uniqueBoards.set(funnelName.toLowerCase(), board);
      } else {
        let stages = Array.isArray(board.stages) ? [...board.stages] : [];
        let stage = stages.find((s: any) => s.title.toLowerCase().trim() === stageName.toLowerCase());
        if (!stage) {
          stages.push({ id: uuidv4(), title: stageName, type: 'NEUTRAL' });
          board.stages = stages;
          board._needsUpdate = true;
        }
      }

      // Preparar Contato
      if (!uniqueContacts.has(phone)) {
        uniqueContacts.set(phone, {
          companyId,
          name: contactName,
          phone,
          email: email || null,
          customFields
        });
      } else {
        // Merge customFields localmente se houver repetição do mesmo telefone na planilha
        const existing = uniqueContacts.get(phone);
        existing.customFields = { ...existing.customFields, ...customFields };
      }

      // Preparar Tags
      const cTags = contactTagsMap.get(phone) || new Set<string>();
      rawTags.forEach(t => {
        uniqueTags.add(t);
        cTags.add(t);
      });
      contactTagsMap.set(phone, cTags);

      // Salvar Lead para inserir depois
      leadsData.push({
        funnelName,
        stageName,
        phone,
        leadTitle,
        value
      });
    }

    // 2. Persistir Boards e Stages
    logger.debug(`[IMPORT KOMMO] Sincronizando ${uniqueBoards.size} boards...`);
    for (const [_, board] of uniqueBoards) {
      if (board._isNew) {
        await db.insert(kanbanBoards).values({
          id: board.id,
          companyId: board.companyId,
          name: board.name,
          funnelType: board.funnelType,
          stages: board.stages
        });
        board._isNew = false;
      } else if (board._needsUpdate) {
        await db.update(kanbanBoards).set({ stages: board.stages }).where(eq(kanbanBoards.id, board.id));
        board._needsUpdate = false;
      }
    }

    // 3. Persistir Tags em Bulk
    logger.debug(`[IMPORT KOMMO] Sincronizando ${uniqueTags.size} tags...`);
    const tagNameToId = new Map<string, string>();
    if (uniqueTags.size > 0) {
      const allTagNames = Array.from(uniqueTags);
      // Fetch existing
      const existingDbTags = await db.select().from(tags).where(
        and(eq(tags.companyId, companyId), inArray(tags.name, allTagNames))
      );
      existingDbTags.forEach(t => tagNameToId.set(t.name.toLowerCase().trim(), t.id));

      // Insert missing
      const missingTags = allTagNames.filter(t => !tagNameToId.has(t.toLowerCase().trim())).map(t => ({
        id: uuidv4(),
        companyId,
        name: t,
        color: '#10b981'
      }));

      if (missingTags.length > 0) {
        const chunkedTags = chunkArray(missingTags, 100);
        for (const chunk of chunkedTags) {
          const inserted = await db.insert(tags).values(chunk).returning();
          inserted.forEach(t => tagNameToId.set(t.name.toLowerCase().trim(), t.id));
        }
      }
    }

    // 4. Persistir Contatos em Bulk
    logger.debug(`[IMPORT KOMMO] Sincronizando ${uniqueContacts.size} contatos...`);
    const phoneToContactId = new Map<string, string>();
    const allPhones = Array.from(uniqueContacts.keys());
    
    // Processar em chunks para evitar sobrecarga (MAX 100 por select/insert)
    const phoneChunks = chunkArray(allPhones, 100);
    
    for (const pChunk of phoneChunks) {
      const existingDbContacts = await db.select().from(contacts).where(
        and(eq(contacts.companyId, companyId), inArray(contacts.phone, pChunk))
      );
      
      existingDbContacts.forEach(c => phoneToContactId.set(c.phone, c.id));
      
      const missingPhones = pChunk.filter(p => !phoneToContactId.has(p));
      if (missingPhones.length > 0) {
        const newContacts = missingPhones.map(p => {
          const cData = uniqueContacts.get(p);
          return {
            id: uuidv4(),
            companyId: cData.companyId,
            name: cData.name,
            phone: cData.phone,
            email: cData.email,
            customFields: cData.customFields
          };
        });
        
        const inserted = await db.insert(contacts).values(newContacts).returning();
        inserted.forEach(c => phoneToContactId.set(c.phone, c.id));
      }
    }

    // 5. Persistir ContactsToTags em Bulk
    logger.debug(`[IMPORT KOMMO] Sincronizando Tags dos contatos...`);
    const contactsToTagsData: any[] = [];
    for (const [phone, cTags] of contactTagsMap) {
      const contactId = phoneToContactId.get(phone);
      if (contactId) {
        cTags.forEach(tagName => {
          const tagId = tagNameToId.get(tagName.toLowerCase().trim());
          if (tagId) {
            contactsToTagsData.push({ contactId, tagId, companyId });
          }
        });
      }
    }

    if (contactsToTagsData.length > 0) {
      const cttChunks = chunkArray(contactsToTagsData, 200);
      for (const chunk of cttChunks) {
        await db.insert(contactsToTags).values(chunk).onConflictDoNothing();
      }
    }

    // 6. Persistir Leads em Bulk
    logger.debug(`[IMPORT KOMMO] Inserindo ${leadsData.length} leads...`);
    const finalLeadsData: any[] = [];
    for (const lData of leadsData) {
      const board = uniqueBoards.get(lData.funnelName.toLowerCase());
      const stage = board?.stages.find((s: any) => s.title.toLowerCase().trim() === lData.stageName.toLowerCase());
      const contactId = phoneToContactId.get(lData.phone);

      if (board && stage && contactId) {
        finalLeadsData.push({
          id: uuidv4(),
          companyId,
          boardId: board.id,
          stageId: stage.id,
          contactId,
          title: lData.leadTitle,
          value: lData.value.toString(),
          currentStage: stage
        });
      }
    }

    if (finalLeadsData.length > 0) {
      const leadsChunks = chunkArray(finalLeadsData, 200);
      for (const chunk of leadsChunks) {
        await db.insert(kanbanLeads).values(chunk);
      }
    }

    logger.debug(`[IMPORT KOMMO] Sucesso! ${finalLeadsData.length} leads criados.`);
    return NextResponse.json({ success: true, leadsCount: finalLeadsData.length });
    
  } catch (error: any) {
    console.error('[IMPORT KOMMO] Error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao importar leads.' }, { status: 500 });
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
