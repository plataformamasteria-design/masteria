import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { campaigns, contactLists, contactsToContactLists, voiceAgents } from '@/lib/db/schema';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';
import redis from '@/lib/redis';
import { inArray, eq, and, sql } from 'drizzle-orm';

const VOICE_CAMPAIGN_QUEUE = 'voice_campaign_queue';

const voiceCampaignSchema = z.object({
  name: z.string().min(1, 'Nome da campanha é obrigatório'),
  voiceAgentId: z.string().min(1, 'Selecione um agente de voz'),
  fromNumber: z.string().optional(),
  schedule: z.string().datetime({ offset: true }).nullable().optional(),
  contactListIds: z.array(z.string().uuid('ID de lista inválido')).min(1, 'Selecione pelo menos uma lista.'),
  enableRetry: z.boolean().optional().default(false),
  maxRetryAttempts: z.number().min(0).max(5).optional().default(3),
  retryDelayMinutes: z.number().min(5).max(120).optional().default(30),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = voiceCampaignSchema.safeParse(body);

        if (!parsed.success) {
            console.error('[Voice Campaign] Validação falhou:', JSON.stringify(parsed.error.flatten()));
            return NextResponse.json({ 
                error: 'Dados inválidos.', 
                details: parsed.error.flatten(),
                receivedData: {
                    name: typeof body.name,
                    voiceAgentId: body.voiceAgentId,
                    contactListIds: body.contactListIds,
                    schedule: body.schedule
                }
            }, { status: 400 });
        }

        const { contactListIds, voiceAgentId, fromNumber, schedule, name, enableRetry, maxRetryAttempts, retryDelayMinutes } = parsed.data;
        const isScheduled = !!schedule;

        const agent = await db.query.voiceAgents.findFirst({
            where: and(
                eq(voiceAgents.id, voiceAgentId),
                eq(voiceAgents.companyId, companyId)
            ),
        });

        if (!agent) {
            return NextResponse.json({ 
                error: 'Agente inválido', 
                description: 'O agente de voz selecionado não existe. Verifique se o agente está configurado corretamente.' 
            }, { status: 403 });
        }

        const _retellAgentId = agent.retellAgentId || voiceAgentId;

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
        
        const listsWithContacts = await db
            .select({ 
                listId: contactsToContactLists.listId,
                contactCount: sql<number>`COUNT(DISTINCT ${contactsToContactLists.contactId})`.as('contact_count')
            })
            .from(contactsToContactLists)
            .where(inArray(contactsToContactLists.listId, contactListIds))
            .groupBy(contactsToContactLists.listId);
        
        const validListIds = listsWithContacts
            .filter(l => Number(l.contactCount) > 0)
            .map(l => l.listId);
        
        if (validListIds.length === 0) {
            return NextResponse.json({ 
                error: 'Nenhum contato disponível', 
                description: 'Todas as listas selecionadas estão vazias. Adicione contatos a pelo menos uma lista antes de criar a campanha.' 
            }, { status: 400 });
        }
        
        const finalContactListIds = validListIds;

        const [newCampaign] = await db.insert(campaigns).values({
            companyId: companyId,
            name: name,
            channel: 'VOICE',
            status: isScheduled ? 'SCHEDULED' : 'QUEUED',
            voiceAgentId: voiceAgentId,
            scheduledAt: schedule ? new Date(schedule) : null,
            contactListIds: finalContactListIds,
            batchSize: 20,
            batchDelaySeconds: 50,
            enableRetry: enableRetry,
            maxRetryAttempts: maxRetryAttempts,
            retryDelayMinutes: retryDelayMinutes,
            variableMappings: fromNumber ? { fromNumber } : undefined,
        }).returning();

        if (!newCampaign) {
          throw new Error("Não foi possível criar a campanha no banco de dados.");
        }
        
        if (!isScheduled) {
            console.log(`[Voice Campaign] Adicionando campanha ${newCampaign.id} à fila para processamento imediato`);
            
            await redis.lpush(VOICE_CAMPAIGN_QUEUE, newCampaign.id);
            
            let baseUrl: string;
            if (process.env.NEXT_PUBLIC_APP_URL) {
                baseUrl = process.env.NEXT_PUBLIC_APP_URL;
            } else if (process.env.VERCEL_URL) {
                baseUrl = `https://${process.env.VERCEL_URL}`;
            } else {
                baseUrl = 'http://localhost:5000';
            }
            
            fetch(`${baseUrl}/api/v1/campaigns/trigger`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }).then(res => {
                if (!res.ok) {
                    console.warn(`[Voice Campaign] Trigger retornou status ${res.status}`);
                }
            }).catch(err => {
                console.error(`[Voice Campaign] Erro ao disparar trigger: ${err.message}`);
            });
            
            console.log(`[Voice Campaign] Trigger disparado para campanha ${newCampaign.id}`);
        }

        const ignoredListsCount = contactListIds.length - finalContactListIds.length;
        let message = isScheduled 
            ? 'Campanha de voz agendada com sucesso. Ela será processada na data programada.'
            : 'Campanha de voz criada! As ligações estão sendo iniciadas. Acompanhe o progresso na lista de campanhas.';
        
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
        console.error('Erro ao criar campanha de voz:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
