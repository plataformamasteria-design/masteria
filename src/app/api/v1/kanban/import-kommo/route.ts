import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { kanbanBoards, kanbanLeads, contacts, tags, contactsToTags } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import * as xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
// Aumentar tempo limite para processamento de planilhas grandes (max 5 minutos na Vercel pro, mas vamos limitar no Next config se precisar)
export const maxDuration = 300; 

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

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    
    // Obter dados em formato JSON com header na primeira linha
    const data: any[] = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (data.length === 0) {
      return NextResponse.json({ error: 'Planilha vazia.' }, { status: 400 });
    }

    let leadsCount = 0;

    // Cache local para otimizar banco de dados
    const boardsCache = new Map<string, any>();
    const tagsCache = new Map<string, string>();

    // Carregar funis existentes
    const existingBoards = await db.select().from(kanbanBoards).where(eq(kanbanBoards.companyId, companyId));
    existingBoards.forEach(b => boardsCache.set(b.name.toLowerCase().trim(), b));

    for (const row of data) {
      // Identificar colunas do Kommo
      const funnelName = (row['Funil de vendas'] || 'Funil Importado').toString().trim();
      const stageName = (row['Etapa do lead'] || 'Nova Oportunidade').toString().trim();
      const leadTitle = (row['Lead título'] || 'Lead sem nome').toString().trim();
      const contactName = (row['Contato principal'] || row['Nome'] || leadTitle).toString().trim();
      
      const phoneRaw = row['Telefone comercial (contato)'] || row['Celular (contato)'] || row['Tel. direto com. (contato)'];
      const phone = cleanPhone(phoneRaw);
      
      const email = (row['Email comercial (contato)'] || row['Email pessoal (contato)'] || '').toString().trim();
      const value = parseFloat(row['Venda']) || 0;
      const rawTags = (row['Lead tags'] || '').toString().split(',').map((t: string) => t.trim()).filter(Boolean);

      // Campos customizados: tudo que não for padrão
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

      // 1. Resolver Board
      let board = boardsCache.get(funnelName.toLowerCase());
      if (!board) {
        // Criar novo board
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

      // 2. Resolver Stage
      let stages = Array.isArray(board.stages) ? [...board.stages] : [];
      let stage = stages.find((s: any) => s.title.toLowerCase().trim() === stageName.toLowerCase());
      if (!stage) {
        stage = {
          id: uuidv4(),
          title: stageName,
          type: 'NEUTRAL'
        };
        stages.push(stage);
        
        // Atualizar board no banco
        await db.update(kanbanBoards)
          .set({ stages })
          .where(eq(kanbanBoards.id, board.id));
          
        board.stages = stages;
        boardsCache.set(funnelName.toLowerCase(), board);
      }

      // 3. Resolver Contato (Upsert via Telefone)
      // Se não tiver telefone válido, gera um dummy ou pula? Vamos gerar um dummy seguro.
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
        // Mesclar customFields existentes
        const mergedCustomFields = {
          ...(contact.customFields as Record<string, string> || {}),
          ...customFields
        };
        await db.update(contacts).set({ customFields: mergedCustomFields }).where(eq(contacts.id, contact.id));
      }

      // 4. Tags
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
              color: '#10b981' // emerald default
            }).returning();
            tagId = newTag.id;
          }
          tagsCache.set(tagName.toLowerCase(), tagId!);
        }

        // Associar tag ao contato (ignorar erro se já existir PK)
        try {
          await db.insert(contactsToTags).values({
            contactId: contact.id,
            tagId: tagId,
            companyId
          }).onConflictDoNothing();
        } catch (e) {
          // Ignore
        }
      }

      // 5. Inserir Lead
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

    return NextResponse.json({ success: true, leadsCount });
    
  } catch (error: any) {
    console.error('[IMPORT KOMMO] Error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao importar leads.' }, { status: 500 });
  }
}
