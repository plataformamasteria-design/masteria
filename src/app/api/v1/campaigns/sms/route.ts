// src/app/api/v1/campaigns/sms/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { campaigns, contactLists, contactsToContactLists } from '@/lib/db/schema';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';
import redis from '@/lib/redis';
import { inArray, eq, and, sql } from 'drizzle-orm';

const SMS_CAMPAIGN_QUEUE = 'sms_campaign_queue';

const smsCampaignSchema = z.object({
  name: z.string().min(1, 'Nome da campanha é obrigatório'),
  message: z.string().min(1, 'A mensagem é obrigatória'),
  schedule: z.string().datetime({ offset: true }).nullable().optional(),
  contactListIds: z.array(z.string()).min(1, 'Selecione pelo menos uma lista.'),
  smsGatewayId: z.string().uuid('Selecione um gateway de envio.'),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = smsCampaignSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }

        const { contactListIds, smsGatewayId, schedule, ...campaignData } = parsed.data;
        const isScheduled = !!schedule;

        // Validar ownership das listas
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
        
        // Buscar quais listas têm contatos
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
            channel: 'SMS',
            status: isScheduled ? 'SCHEDULED' : 'QUEUED',
            smsGatewayId: smsGatewayId,
            message: campaignData.message,
            scheduledAt: schedule ? new Date(schedule) : null,
            contactListIds: finalContactListIds,
        }).returning();

        if (!newCampaign) {
          throw new Error("Não foi possível criar a campanha no banco de dados.");
        }
        
        // Se for envio imediato, adicionar à fila e disparar processamento
        if (!isScheduled) {
            console.log(`[SMS Campaign] Adicionando campanha ${newCampaign.id} à fila para processamento imediato`);
            
            // Adicionar à fila Redis (mesmo padrão do trigger individual)
            await redis.lpush(SMS_CAMPAIGN_QUEUE, newCampaign.id);
            
            // Disparar o trigger CRON para processar imediatamente (fire-and-forget)
            // Usamos fetch interno para não bloquear a resposta
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
                    console.warn(`[SMS Campaign] Trigger retornou status ${res.status}`);
                }
            }).catch(err => {
                console.error(`[SMS Campaign] Erro ao disparar trigger: ${err.message}`);
            });
            
            console.log(`[SMS Campaign] Trigger disparado para campanha ${newCampaign.id}`);
        }

        const ignoredListsCount = contactListIds.length - finalContactListIds.length;
        let message = isScheduled 
            ? 'Campanha agendada com sucesso. Ela será enviada na data programada pelo nosso sistema.'
            : 'Campanha criada! O envio está sendo processado. Acompanhe o progresso na lista de campanhas.';
        
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
        console.error('Erro ao criar campanha de SMS:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
