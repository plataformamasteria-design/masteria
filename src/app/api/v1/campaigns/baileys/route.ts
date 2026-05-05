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

const baileysCampaignSchema = z.object({
  name: z.string().min(1, 'Nome da campanha é obrigatório'),
  connectionId: z.string().uuid('Selecione uma conexão válida'),
  messageText: z.string().min(1, 'Mensagem é obrigatória').max(4096, 'Mensagem muito longa (máx 4096 caracteres)'),
  variableMappings: z.record(variableMappingSchema),
  contactListIds: z.array(z.string()).optional().default([]),
  excludeListIds: z.array(z.string()).optional().default([]),
  tagIds: z.array(z.string()).optional().default([]),
  excludeTagIds: z.array(z.string()).optional().default([]),
  funnelIds: z.array(z.string()).optional().default([]),
  funnelStageIds: z.array(z.string()).optional().default([]),
  schedule: z.string().datetime({ offset: true }).nullable().optional(),
  minDelaySeconds: z.number().min(5).max(600).optional().default(11),
  maxDelaySeconds: z.number().min(10).max(900).optional().default(33),
}).refine(data => {
  return data.contactListIds.length > 0 || data.tagIds.length > 0 || data.funnelIds.length > 0 || data.funnelStageIds.length > 0;
}, {
  message: "Selecione pelo menos uma lista, etiqueta, funil ou etapa para a campanha.",
  path: ["contactListIds"]
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = baileysCampaignSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }

        const { 
            contactListIds, excludeListIds, tagIds, excludeTagIds, funnelIds, funnelStageIds,
            schedule, messageText, minDelaySeconds, maxDelaySeconds, ...campaignData 
        } = parsed.data;
        const isScheduled = !!schedule;
        
        const variableMappingsWithDelay = {
            ...campaignData.variableMappings,
            _minDelaySeconds: minDelaySeconds,
            _maxDelaySeconds: maxDelaySeconds,
        };

        // VALIDAÇÃO 1: Verificar ownership da conexão e que é Baileys
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

        if (connection.connectionType !== 'baileys') {
            return NextResponse.json({ 
                error: 'Tipo de conexão inválido', 
                description: 'Apenas conexões Baileys são permitidas para este tipo de campanha.' 
            }, { status: 400 });
        }

        // VALIDAÇÃO 2: (Removida a validação forte de listas vazias para permitir campanhas por Tags e Funil que serão resolvidas no Worker)
        // O Worker fará a busca final da intersecção de leads.
        const finalContactListIds = contactListIds;

        // Criar campanha (sem templateId para Baileys)
        const [newCampaign] = await db.insert(campaigns).values({
            companyId: companyId,
            name: campaignData.name,
            channel: 'WHATSAPP',
            status: isScheduled ? 'SCHEDULED' : 'QUEUED',
            connectionId: campaignData.connectionId,
            templateId: null,
            variableMappings: variableMappingsWithDelay,
            message: messageText,
            scheduledAt: schedule ? new Date(schedule) : null,
            contactListIds: finalContactListIds,
            excludeListIds,
            tagIds,
            excludeTagIds,
            funnelIds,
            funnelStageIds,
        }).returning();

        if (!newCampaign) {
          throw new Error("Não foi possível criar a campanha Baileys no banco de dados.");
        }
        
        // Se não for agendada, enfileira para processamento imediato
        if (!isScheduled) {
            await redis.lpush(WHATSAPP_CAMPAIGN_QUEUE, newCampaign.id);
        }

        let message = isScheduled 
            ? `Campanha "${newCampaign.name}" agendada com sucesso.`
            : `Campanha "${newCampaign.name}" adicionada à fila para envio.`;

        return NextResponse.json({ 
            success: true, 
            message: message, 
            campaignId: newCampaign.id,
            listsUsed: finalContactListIds.length,
            listsIgnored: ignoredListsCount
        }, { status: 201 });

    } catch (error) {
        console.error('Erro ao criar campanha Baileys:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
