import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { metaWebhookHealthEvents, connections } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    const { connectionId } = await params;

    try {
        const authResult = await requireCompanyIdOr401();
        if (authResult instanceof NextResponse) {
            return authResult; // Retorna 401 se não autenticado
        }
        const { companyId } = authResult;

        // SECURITY: Validar tenant ao buscar conexão
        const [connection] = await db.select({ 
            id: connections.id,
            connectionType: connections.connectionType 
        })
            .from(connections)
            .where(and(
                eq(connections.id, connectionId),
                eq(connections.companyId, companyId)
            ))
            .limit(1);

        if (!connection) {
            return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
        }

        // SECURITY: Validar tenant ao buscar eventos de webhook (via connectionId já validado)
        const recentEvents = await db.select({
            id: metaWebhookHealthEvents.id,
            status: metaWebhookHealthEvents.status,
            validatedAt: metaWebhookHealthEvents.validatedAt,
            errorMessage: metaWebhookHealthEvents.errorMessage,
        })
            .from(metaWebhookHealthEvents)
            .where(eq(metaWebhookHealthEvents.connectionId, connectionId))
            .orderBy(desc(metaWebhookHealthEvents.validatedAt))
            .limit(20);

        if (recentEvents.length === 0) {
            // Se for conexão oficial (Meta API) e não tiver dados, assumimos 'healthy' (sem tráfego recente)
            // Para Baileys, 'no_data' é apropriado pois depende de sessão ativa
            const optimisticStatus = connection.connectionType === 'meta_api' ? 'healthy' : 'no_data';
            
            return NextResponse.json({
                status: optimisticStatus,
                successRate: null,
                lastValidatedAt: null,
                totalEvents: 0,
                successCount: 0,
                failureCount: 0,
                message: connection.connectionType === 'meta_api' ? 'Aguardando primeiros eventos' : 'Sem dados recentes'
            });
        }

        const successCount = recentEvents.filter(e => e.status === 'success').length;
        const failureCount = recentEvents.filter(e => e.status === 'failure').length;
        const totalEvents = recentEvents.length;
        const successRate = Math.round((successCount / totalEvents) * 100);

        let status: 'healthy' | 'warning' | 'error' | 'no_data';
        if (successRate >= 90) {
            status = 'healthy';
        } else if (successRate >= 50) {
            status = 'warning';
        } else {
            status = 'error';
        }

        const lastValidatedAt = recentEvents[0]?.validatedAt || null;
        const lastError = recentEvents.find(e => e.status === 'failure')?.errorMessage || null;

        return NextResponse.json({
            status,
            successRate,
            lastValidatedAt,
            totalEvents,
            successCount,
            failureCount,
            lastError,
        });
    } catch (error) {
        console.error('[Webhook Health] Error fetching health:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
