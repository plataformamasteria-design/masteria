// src/app/api/v1/campaigns/[campaignId]/retry-failed/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { campaigns, whatsappDeliveryReports, smsDeliveryReports, connections, smsGateways } from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import redis from '@/lib/redis';

const WHATSAPP_CAMPAIGN_QUEUE = 'whatsapp_campaign_queue';
const SMS_CAMPAIGN_QUEUE = 'sms_campaign_queue';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { campaignId } = await params;
        
        const [originalCampaign] = await db.select()
            .from(campaigns)
            .where(and(eq(campaigns.id, campaignId), eq(campaigns.companyId, companyId)));

        if (!originalCampaign) {
            return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });
        }
        
        if (!['COMPLETED', 'PARTIAL_FAILURE', 'FAILED'].includes(originalCampaign.status)) {
            return NextResponse.json({ 
                error: 'Não é possível reenviar falhas', 
                description: 'Apenas campanhas finalizadas ou com falhas podem ter mensagens reenviadas.' 
            }, { status: 400 });
        }

        let failedContactIds: string[] = [];
        let failedCount = 0;
        
        if (originalCampaign.channel === 'WHATSAPP') {
            const failedReports = await db
                .select({ contactId: whatsappDeliveryReports.contactId })
                .from(whatsappDeliveryReports)
                .where(and(
                    eq(whatsappDeliveryReports.campaignId, campaignId),
                    inArray(whatsappDeliveryReports.status, ['failed', 'FAILED'])
                ));
            
            failedContactIds = failedReports.map(r => r.contactId).filter((id): id is string => id !== null);
            failedCount = failedContactIds.length;
            
        } else if (originalCampaign.channel === 'SMS') {
            const failedReports = await db
                .select({ contactId: smsDeliveryReports.contactId })
                .from(smsDeliveryReports)
                .where(and(
                    eq(smsDeliveryReports.campaignId, campaignId),
                    inArray(smsDeliveryReports.status, ['failed', 'FAILED'])
                ));
            
            failedContactIds = failedReports.map(r => r.contactId).filter((id): id is string => id !== null);
            failedCount = failedContactIds.length;
        }
        
        if (failedCount === 0) {
            return NextResponse.json({ 
                error: 'Nenhuma falha encontrada', 
                description: 'Não há mensagens com falha para reenviar nesta campanha.' 
            }, { status: 400 });
        }

        if (originalCampaign.channel === 'WHATSAPP' && originalCampaign.connectionId) {
            const [connection] = await db.select()
                .from(connections)
                .where(and(
                    eq(connections.id, originalCampaign.connectionId),
                    eq(connections.companyId, companyId)
                ));
            
            if (!connection || !connection.isActive) {
                return NextResponse.json({ 
                    error: 'Conexão indisponível', 
                    description: 'A conexão usada na campanha original não está mais ativa.' 
                }, { status: 400 });
            }
        }

        if (originalCampaign.channel === 'SMS' && originalCampaign.smsGatewayId) {
            const [gateway] = await db.select()
                .from(smsGateways)
                .where(and(
                    eq(smsGateways.id, originalCampaign.smsGatewayId),
                    eq(smsGateways.companyId, companyId)
                ));
            
            if (!gateway || !gateway.isActive) {
                return NextResponse.json({ 
                    error: 'Gateway SMS indisponível', 
                    description: 'O gateway SMS usado na campanha original não está mais ativo.' 
                }, { status: 400 });
            }
        }

        const retryCount = (originalCampaign.name.match(/\(Reenvio( \d+)?\)$/) || []).length > 0 
            ? parseInt(originalCampaign.name.match(/\(Reenvio (\d+)\)$/)?.[1] || '1') + 1
            : 1;
        
        const baseName = originalCampaign.name.replace(/\s*\(Reenvio( \d+)?\)$/, '');
        const newCampaignName = retryCount === 1 
            ? `${baseName} (Reenvio)` 
            : `${baseName} (Reenvio ${retryCount})`;

        const [newCampaign] = await db.insert(campaigns).values({
            companyId: companyId,
            name: newCampaignName,
            channel: originalCampaign.channel,
            status: 'QUEUED',
            connectionId: originalCampaign.connectionId,
            templateId: originalCampaign.templateId,
            variableMappings: originalCampaign.variableMappings,
            mediaAssetId: originalCampaign.mediaAssetId,
            smsGatewayId: originalCampaign.smsGatewayId,
            message: originalCampaign.message,
            scheduledAt: null,
            contactListIds: [],
            retryContactIds: failedContactIds,
            parentCampaignId: originalCampaign.id,
            batchSize: originalCampaign.batchSize,
            batchDelaySeconds: originalCampaign.batchDelaySeconds,
        }).returning();

        if (!newCampaign) {
            throw new Error('Não foi possível criar a campanha de reenvio.');
        }

        if (originalCampaign.channel === 'WHATSAPP') {
            await redis.lpush(WHATSAPP_CAMPAIGN_QUEUE, newCampaign.id);
        } else if (originalCampaign.channel === 'SMS') {
            await redis.lpush(SMS_CAMPAIGN_QUEUE, newCampaign.id);
        }

        return NextResponse.json({ 
            success: true, 
            message: `Campanha de reenvio "${newCampaignName}" criada com ${failedCount} contatos.`,
            campaignId: newCampaign.id,
            failedCount,
            originalCampaignId: originalCampaign.id,
        }, { status: 201 });

    } catch (error) {
        console.error(`Erro ao reenviar falhas da campanha ${campaignId}:`, error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { campaignId } = await params;
        
        const [campaign] = await db.select({ channel: campaigns.channel })
            .from(campaigns)
            .where(and(eq(campaigns.id, campaignId), eq(campaigns.companyId, companyId)));

        if (!campaign) {
            return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });
        }
        
        let failedCount = 0;
        
        if (campaign.channel === 'WHATSAPP') {
            const result = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(whatsappDeliveryReports)
                .where(and(
                    eq(whatsappDeliveryReports.campaignId, campaignId),
                    inArray(whatsappDeliveryReports.status, ['failed', 'FAILED'])
                ));
            failedCount = result[0]?.count || 0;
            
        } else if (campaign.channel === 'SMS') {
            const result = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(smsDeliveryReports)
                .where(and(
                    eq(smsDeliveryReports.campaignId, campaignId),
                    inArray(smsDeliveryReports.status, ['failed', 'FAILED'])
                ));
            failedCount = result[0]?.count || 0;
        }

        return NextResponse.json({ 
            campaignId,
            failedCount,
            canRetry: failedCount > 0
        });

    } catch (error) {
        console.error(`Erro ao verificar falhas da campanha ${campaignId}:`, error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
