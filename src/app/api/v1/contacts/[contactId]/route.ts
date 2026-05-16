
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { contacts, contactsToContactLists, contactsToTags, tags, contactLists, kanbanLeads, kanbanBoards, automationFlowExecutions, automationFlows, automationNodes } from '@/lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { logContactEvent } from '@/lib/contact-events';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';

const contactUpdateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').optional(),
  phone: z.string().min(10, 'Telefone inválido').optional(),
  email: z.string().email('Email inválido').optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  addressStreet: z.string().optional().nullable(),
  addressNumber: z.string().optional().nullable(),
  addressComplement: z.string().optional().nullable(),
  addressDistrict: z.string().optional().nullable(),
  addressCity: z.string().optional().nullable(),
  addressState: z.string().optional().nullable(),
  addressZipCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customFields: z.record(z.string(), z.string()).optional().nullable(),
  listIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
});


// GET /api/v1/contacts/[contactId]

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { contactId } = await params;
    const results = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyId)));

    if (results.length === 0) {
      return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 });
    }

    const contact = results[0];
    if (!contact) {
      return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 });
    }

    const contactTags = await db.select({
      id: tags.id,
      name: tags.name,
      color: tags.color
    }).from(tags)
      .innerJoin(contactsToTags, eq(tags.id, contactsToTags.tagId))
      .where(and(
        eq(contactsToTags.contactId, contact.id),
        eq(contactsToTags.companyId, companyId),
        eq(tags.companyId, companyId)
      ));

    const contactContactLists = await db.select({
      id: contactLists.id,
      name: contactLists.name,
    }).from(contactLists)
      .innerJoin(contactsToContactLists, eq(contactLists.id, contactsToContactLists.listId))
      .where(and(
        eq(contactsToContactLists.contactId, contact.id),
        eq(contactsToContactLists.companyId, companyId),
        eq(contactLists.companyId, companyId)
      ));

    // ✅ CORREÇÃO: Buscar apenas conversas ativas com connectionId válido
    // Filtrar conversas órfãs (sem connectionId) e agrupar por número de telefone
    // Retornar apenas uma conversa por número (a mais recente)
    const activeConversationsRaw = await db.execute(sql`
      WITH ranked_conversations AS (
        SELECT 
          c.id,
          c.connection_id as "connectionId",
          conn.config_name as "connectionName",
          conn.connection_type as "connectionType",
          conn.phone as "connectionPhone",
          c.status,
          c.last_message_at as "lastMessageAt",
          c.ai_active as "aiActive",
          ROW_NUMBER() OVER (PARTITION BY COALESCE(conn.phone, 'SEM_TELEFONE') ORDER BY c.last_message_at DESC) as rn
        FROM conversations c
        INNER JOIN connections conn ON c.connection_id = conn.id
        WHERE c.contact_id = ${contact.id}
          AND c.company_id = ${companyId}
          AND c.archived_at IS NULL
          AND c.connection_id IS NOT NULL
          AND conn.phone IS NOT NULL
      )
      SELECT 
        id,
        "connectionId",
        "connectionName",
        "connectionType",
        "connectionPhone",
        status,
        "lastMessageAt",
        "aiActive"
      FROM ranked_conversations
      WHERE rn = 1
      ORDER BY "lastMessageAt" DESC
    `);

    const activeConversations = (Array.isArray(activeConversationsRaw)
      ? activeConversationsRaw
      : (activeConversationsRaw as any).rows || []) as Array<{
        id: string;
        connectionId: string;
        connectionName: string | null;
        connectionType: string | null;
        connectionPhone: string | null;
        status: string;
        lastMessageAt: Date | null;
        aiActive: boolean | null;
      }>;

    // Buscar Funis (Kanban Leads) associados a este contato
    const funnelsRaw = await db.select({
      leadId: kanbanLeads.id,
      boardId: kanbanLeads.boardId,
      boardName: kanbanBoards.name,
      stageId: kanbanLeads.stageId,
      stagesJson: kanbanBoards.stages,
      value: kanbanLeads.value
    })
    .from(kanbanLeads)
    .innerJoin(kanbanBoards, eq(kanbanLeads.boardId, kanbanBoards.id))
    .where(and(
      eq(kanbanLeads.contactId, contact.id),
      eq(kanbanLeads.companyId, companyId)
    ));

    const funnels = funnelsRaw.map(f => {
      // Find stage name from stagesJson
      const stages = Array.isArray(f.stagesJson) ? f.stagesJson as any[] : [];
      const currentStage = stages.find(s => s.id === f.stageId);
      return {
        leadId: f.leadId,
        boardId: f.boardId,
        boardName: f.boardName,
        stageId: f.stageId,
        stageName: currentStage ? currentStage.name : 'Desconhecida',
        boardStages: stages,
        value: f.value
      };
    });

    // Buscar Automações associadas a este contato
    const automations = await db.select({
      executionId: automationFlowExecutions.id,
      flowId: automationFlowExecutions.flowId,
      flowName: automationFlows.name,
      status: automationFlowExecutions.status,
      currentStepId: automationFlowExecutions.currentStepId,
      currentStepLabel: automationNodes.label,
      startedAt: automationFlowExecutions.startedAt,
      finishedAt: automationFlowExecutions.finishedAt
    })
    .from(automationFlowExecutions)
    .innerJoin(automationFlows, eq(automationFlowExecutions.flowId, automationFlows.id))
    .leftJoin(automationNodes, and(
      eq(automationFlowExecutions.currentStepId, automationNodes.id),
      eq(automationNodes.automationId, automationFlows.id)
    ))
    .where(and(
      eq(automationFlowExecutions.contactId, contact.id),
      eq(automationFlowExecutions.companyId, companyId)
    ))
    .orderBy(sql`${automationFlowExecutions.startedAt} DESC`);

    const response = {
      ...contact,
      tags: contactTags,
      lists: contactContactLists,
      activeConversations: activeConversations,
      funnels: funnels,
      automations: automations
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Erro ao buscar contato:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
    return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
  }
}

// PUT /api/v1/contacts/[contactId]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { contactId } = await params;

    const body = await request.json();
    const parsed = contactUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
    }

    const { listIds, tagIds, ...contactData } = parsed.data;

    const updatedContact = await db.transaction(async (tx) => {
      const contactDataToUpdate = Object.fromEntries(
        Object.entries(contactData).filter(([_, v]) => v !== undefined)
      );

      if (Object.keys(contactDataToUpdate).length > 0) {
        await tx
          .update(contacts)
          .set(contactDataToUpdate)
          .where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyId)));
      }

      if (listIds !== undefined) {
        await tx.delete(contactsToContactLists).where(and(
          eq(contactsToContactLists.contactId, contactId),
          eq(contactsToContactLists.companyId, companyId)
        ));
        if (listIds.length > 0) {
          await tx.insert(contactsToContactLists).values(listIds.map(listId => ({
            contactId,
            listId,
            companyId
          })));
        }
      }

      if (tagIds !== undefined) {
        await tx.delete(contactsToTags).where(and(
          eq(contactsToTags.contactId, contactId),
          eq(contactsToTags.companyId, companyId)
        ));
        if (tagIds.length > 0) {
          await tx.insert(contactsToTags).values(tagIds.map(tagId => ({
            contactId,
            tagId,
            companyId
          })));
        }

        // Registrar no Histórico de Eventos do Contato
        try {
          if (tagIds.length > 0) {
            const newTags = await tx.select({ name: tags.name }).from(tags).where(inArray(tags.id, tagIds));
            const tagNames = newTags.map(t => t.name).join(', ');
            await logContactEvent(companyId, contactId, 'TAG', `Etiquetas atualizadas: ${tagNames}`);
          } else {
            await logContactEvent(companyId, contactId, 'TAG', `Todas as etiquetas foram removidas`);
          }
        } catch (e) {
          console.warn('[logContactEvent] Falha ao logar atualização de tags', e);
        }
      }

      const [finalContact] = await tx.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyId)));
      return finalContact;
    });

    if (!updatedContact) {
      return NextResponse.json({ error: 'Contato não encontrado ou não pertence à empresa.' }, { status: 404 });
    }

    return NextResponse.json(updatedContact);

  } catch (error) {
    console.error('Erro ao atualizar contato:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
    return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
  }
}

// DELETE /api/v1/contacts/[contactId]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { contactId } = await params;
    await db.transaction(async (tx) => {
      await tx.delete(contactsToContactLists).where(and(
        eq(contactsToContactLists.contactId, contactId),
        eq(contactsToContactLists.companyId, companyId)
      ));
      await tx.delete(contactsToTags).where(and(
        eq(contactsToTags.contactId, contactId),
        eq(contactsToTags.companyId, companyId)
      ));
      await tx.delete(contacts).where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyId)));
    });

    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error('Erro ao excluir contato:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
    return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
  }
}
