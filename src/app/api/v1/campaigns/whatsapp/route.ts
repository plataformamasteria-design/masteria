

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { campaigns, contactLists, contactsToContactLists, connections } from '@/lib/db/schema';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';
import redis from '@/lib/redis';
import { inArray, eq, and, sql } from 'drizzle-orm';

const WHATSAPP_CAMPAIGN_QUEUE = 'whatsapp_campaign_queue';

const variableMappingSchema = z.object({
    type: z.enum(['fixed', 'dynamic']),
    value: z.string(),
});

const whatsappCampaignSchema = z.object({
  name: z.string().min(1, 'Nome da campanha é obrigatório'),
  connectionId: z.string().uuid('Selecione uma conexão válida'),
  templateId: z.string().uuid('Selecione um modelo válido'),
  variableMappings: z.record(variableMappingSchema),
  contactListIds: z.array(z.string()).min(1, 'Selecione pelo menos uma lista.'),
  schedule: z.string().datetime({ offset: true }).nullable().optional(),
  mediaAssetId: z.string().uuid('Asset de mídia inválido').optional().nullable(),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = whatsappCampaignSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }

        const { contactListIds, schedule, ...campaignData } = parsed.data;
        const isScheduled = !!schedule;

        // FASE 0: Validar conexão - verificar que existe, pertence à empresa e está ativa
        const [connection] = await db
            .select()
            .from(connections)
            .where(and(
                eq(connections.id, campaignData.connectionId),
                eq(connections.companyId, companyId)
            ));
        
        if (!connection) {
            return NextResponse.json({ 
                error: 'Conexão inválida', 
                description: 'A conexão selecionada não existe ou não pertence à sua empresa.' 
            }, { status: 403 });
        }
        
        if (!connection.isActive) {
            return NextResponse.json({ 
                error: 'Conexão inativa', 
                description: `A conexão "${connection.config_name}" está inativa. Por favor, ative a conexão antes de criar uma campanha.` 
            }, { status: 400 });
        }

        // FASE 1: Validar ownership - verificar que TODAS as listas pertencem à empresa
        const ownedLists = await db
            .select({ id: contactLists.id })
            .from(contactLists)
            .where(and(
                eq(contactLists.companyId, companyId),
                inArray(contactLists.id, contactListIds)
            ));
        
        if (ownedLists.length !== contactListIds.length) {
            return NextResponse.json({ 
                error: 'Lista(s) inválida(s)', 
                description: 'Uma ou mais listas selecionadas não existem ou não pertencem à sua empresa.' 
            }, { status: 403 });
        }
        
        // FASE 2: Buscar quais listas têm contatos (GROUP BY para evitar duplicatas)
        const listsWithContacts = await db
            .select({ 
                listId: contactsToContactLists.listId,
                contactCount: sql<number>`COUNT(DISTINCT ${contactsToContactLists.contactId})`.as('contact_count')
            })
            .from(contactsToContactLists)
            .where(inArray(contactsToContactLists.listId, contactListIds))
            .groupBy(contactsToContactLists.listId);
        
        // Filtrar apenas listas que têm contatos (ignorar listas vazias)
        const validListIds = listsWithContacts
            .filter(l => Number(l.contactCount) > 0)
            .map(l => l.listId);
        
        // Garantir que pelo menos uma lista tenha contatos
        if (validListIds.length === 0) {
            return NextResponse.json({ 
                error: 'Nenhum contato disponível', 
                description: 'Todas as listas selecionadas estão vazias. Adicione contatos a pelo menos uma lista antes de criar a campanha.' 
            }, { status: 400 });
        }
        
        // Usar apenas as listas válidas (com contatos) para a campanha
        const finalContactListIds = validListIds;

        const [newCampaign] = await db.insert(campaigns).values({
            companyId: companyId,
            name: campaignData.name,
            channel: 'WHATSAPP',
            status: isScheduled ? 'SCHEDULED' : 'QUEUED',
            connectionId: campaignData.connectionId,
            templateId: campaignData.templateId,
            variableMappings: campaignData.variableMappings,
            mediaAssetId: campaignData.mediaAssetId,
            scheduledAt: schedule ? new Date(schedule) : null,
            contactListIds: finalContactListIds,
        }).returning();

        if (!newCampaign) {
          throw new Error("Não foi possível criar a campanha de WhatsApp no banco de dados.");
        }
        
        // Se não for agendada, enfileira para processamento imediato pelo worker.
        if (!isScheduled) {
            await redis.lpush(WHATSAPP_CAMPAIGN_QUEUE, newCampaign.id);
        }

        const ignoredListsCount = contactListIds.length - finalContactListIds.length;
        let message = isScheduled 
            ? `Campanha "${newCampaign.name}" agendada com sucesso.`
            : `Campanha "${newCampaign.name}" adicionada à fila para envio.`;
        
        if (ignoredListsCount > 0) {
            message += ` (${ignoredListsCount} lista${ignoredListsCount !== 1 ? 's' : ''} vazia${ignoredListsCount !== 1 ? 's' : ''} ignorada${ignoredListsCount !== 1 ? 's' : ''})`;
        }

        return NextResponse.json({ 
            success: true, 
            message: message, 
            campaignId: newCampaign.id,
            listsUsed: finalContactListIds.length,
            listsIgnored: ignoredListsCount
        }, { status: 201 });

    } catch (error) {
        console.error('Erro ao criar campanha de WhatsApp:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
