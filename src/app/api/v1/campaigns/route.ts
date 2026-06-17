import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { campaigns, connections, smsGateways, smsDeliveryReports, messageTemplates, whatsappDeliveryReports } from '@/lib/db/schema';
import { eq, and, desc, sql, type SQL, count, inArray } from 'drizzle-orm';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { getCachedOrFetch, CacheTTL } from '@/lib/api-cache';

export const dynamic = 'force-dynamic';

// GET /api/v1/campaigns
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireCompanyIdOr401();
        if (authResult instanceof NextResponse) {
            return authResult; // Retorna 401 se não autenticado
        }
        const { companyId } = authResult;
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const channel = searchParams.get('channel');
        const connectionId = searchParams.get('connectionId');
        const templateId = searchParams.get('templateId');
        const gatewayId = searchParams.get('gatewayId');
        const offset = (page - 1) * limit;
        
        const cacheKey = `campaigns:${companyId}:${page}:${limit}:${channel || ''}:${connectionId || ''}:${templateId || ''}:${gatewayId || ''}`;
        const data = await getCachedOrFetch(cacheKey, async () => {
            return await fetchCampaignsDataOptimized({ companyId, page, limit, channel, connectionId, templateId, gatewayId, offset });
        }, CacheTTL.REAL_TIME);

        return NextResponse.json(data);

    } catch (error) {
        // Se já é uma resposta NextResponse (401), retorna diretamente
        if (error instanceof NextResponse) {
            return error;
        }
        console.error('Erro ao buscar campanhas:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

type DeliveryStats = {
    campaignId: string;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
};

async function fetchCampaignsDataOptimized(params: {
    companyId: string;
    page: number;
    limit: number;
    channel: string | null;
    connectionId: string | null;
    templateId: string | null;
    gatewayId: string | null;
    offset: number;
}) {
    const { companyId, limit, channel, connectionId, templateId, gatewayId, offset } = params;
        
    const whereClauses: (SQL | undefined)[] = [
        eq(campaigns.companyId, companyId),
    ];

    if (channel === 'WHATSAPP' || channel === 'SMS') {
        whereClauses.push(eq(campaigns.channel, channel));
    }
    if (connectionId) {
        whereClauses.push(eq(campaigns.connectionId, connectionId));
    }
    if (templateId) {
        whereClauses.push(eq(campaigns.templateId, templateId));
    }
    if (gatewayId) {
        whereClauses.push(eq(campaigns.smsGatewayId, gatewayId));
    }

    const finalWhereClauses = and(...whereClauses.filter((c): c is SQL => !!c));

    const [totalResult, paginatedCampaigns] = await Promise.all([
        db.select({ count: count() }).from(campaigns).where(finalWhereClauses),
        db.select({
            id: campaigns.id,
            name: campaigns.name,
            channel: campaigns.channel,
            status: campaigns.status,
            scheduledAt: campaigns.scheduledAt,
            sentAt: campaigns.sentAt,
            connectionId: campaigns.connectionId,
            smsGatewayId: campaigns.smsGatewayId,
            templateId: campaigns.templateId,
            message: campaigns.message,
            connectionName: connections.config_name,
            smsGatewayName: smsGateways.name,
            templateName: messageTemplates.name,
        })
        .from(campaigns)
        .leftJoin(connections, eq(campaigns.connectionId, connections.id))
        .leftJoin(smsGateways, eq(campaigns.smsGatewayId, smsGateways.id))
        .leftJoin(messageTemplates, eq(campaigns.templateId, messageTemplates.id))
        .where(finalWhereClauses)
        .orderBy(desc(campaigns.createdAt))
        .limit(limit)
        .offset(offset)
    ]);

    const totalCampaigns = totalResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCampaigns / limit);

    if (paginatedCampaigns.length === 0) {
        return { data: [], totalPages };
    }

    const _campaignIds = paginatedCampaigns.map(c => c.id);
    const whatsappCampaigns = paginatedCampaigns.filter(c => c.channel === 'WHATSAPP').map(c => c.id);
    const smsCampaigns = paginatedCampaigns.filter(c => c.channel === 'SMS').map(c => c.id);

    const deliveryStatsPromises: Promise<DeliveryStats[]>[] = [];

    if (whatsappCampaigns.length > 0) {
        // SECURITY: Validar tenant ao buscar relatórios de entrega WhatsApp
        deliveryStatsPromises.push(
            db.select({
                campaignId: whatsappDeliveryReports.campaignId,
                sent: sql<number>`count(*)::int`.as('sent'),
                delivered: sql<number>`count(*) FILTER (WHERE ${whatsappDeliveryReports.status} IN ('delivered', 'read'))::int`.as('delivered'),
                read: sql<number>`count(*) FILTER (WHERE ${whatsappDeliveryReports.status} = 'read')::int`.as('read'),
                failed: sql<number>`count(*) FILTER (WHERE ${whatsappDeliveryReports.status} IN ('failed', 'FAILED'))::int`.as('failed'),
            })
            .from(whatsappDeliveryReports)
            .where(and(
                inArray(whatsappDeliveryReports.campaignId, whatsappCampaigns),
                eq(whatsappDeliveryReports.companyId, companyId)
            ))
            .groupBy(whatsappDeliveryReports.campaignId)
        );
    }

    if (smsCampaigns.length > 0) {
        // SECURITY: Validar tenant ao buscar relatórios de entrega SMS
        deliveryStatsPromises.push(
            db.select({
                campaignId: smsDeliveryReports.campaignId,
                sent: sql<number>`count(*)::int`.as('sent'),
                delivered: sql<number>`0`.as('delivered'),
                read: sql<number>`0`.as('read'),
                failed: sql<number>`count(*) FILTER (WHERE ${smsDeliveryReports.status} = 'FAILED')::int`.as('failed'),
            })
            .from(smsDeliveryReports)
            .where(and(
                inArray(smsDeliveryReports.campaignId, smsCampaigns),
                eq(smsDeliveryReports.companyId, companyId)
            ))
            .groupBy(smsDeliveryReports.campaignId)
        );
    }

    const deliveryStatsResults = await Promise.all(deliveryStatsPromises);
    const statsMap = new Map<string, DeliveryStats>();
    
    for (const resultSet of deliveryStatsResults) {
        for (const stat of resultSet) {
            statsMap.set(stat.campaignId, stat);
        }
    }

    const enrichedCampaigns = paginatedCampaigns.map(campaign => {
        const stats = statsMap.get(campaign.id);
        const sent = stats?.sent ?? 0;
        const delivered = stats?.delivered ?? 0;
        const read = stats?.read ?? 0;
        const failed = stats?.failed ?? 0;
        
        // Calcular progresso baseado em entregues/lidos vs enviados viáveis
        let progress = 0;
        if (campaign.channel === 'SMS') {
            progress = sent > 0 ? 100 : 0; // SMS considera 100% ao disparar tudo
        } else {
            const sentViable = Math.max(0, sent - failed);
            if (sentViable > 0) {
                progress = Math.round(((delivered + read) / (sentViable * 2)) * 100);
            } else if (sent > 0 && failed === sent) {
                progress = 100; // Todas falharam, mas o processo terminou
            }
        }
        
        return {
            ...campaign,
            sent,
            delivered,
            read,
            failed,
            progress: Math.min(progress, 100),
        };
    });

    return {
        data: enrichedCampaigns,
        totalPages,
    };
}
