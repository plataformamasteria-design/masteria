import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { voiceCalls, voiceDeliveryReports } from '@/lib/db/schema';
import { sql, gte, eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    logger.info(`[VoiceAnalytics] Fetching for company ${companyId}`);

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // SECURITY: Filtrar por companyId para isolamento multi-tenant
    const [callStatsResult, deliveryStatsResult] = await Promise.all([
      db
        .select({
          totalCalls: sql<number>`COUNT(*)`,
          totalDuration: sql<number>`COALESCE(SUM(duration), 0)`,
          avgDuration: sql<number>`COALESCE(AVG(duration), 0)`,
          inboundCalls: sql<number>`COUNT(*) FILTER (WHERE direction = 'inbound')`,
          outboundCalls: sql<number>`COUNT(*) FILTER (WHERE direction = 'outbound')`,
          endedCalls: sql<number>`COUNT(*) FILTER (WHERE status = 'ended')`,
          failedCalls: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`,
        })
        .from(voiceCalls)
        .where(and(
          eq(voiceCalls.companyId, companyId),
          gte(voiceCalls.createdAt, startDate)
        )),
      
      db
        .select({
          total: sql<number>`COUNT(*)`,
          answered: sql<number>`COUNT(*) FILTER (WHERE call_outcome = 'answered')`,
          notAnswered: sql<number>`COUNT(*) FILTER (WHERE call_outcome = 'not_answered')`,
          voicemail: sql<number>`COUNT(*) FILTER (WHERE call_outcome = 'voicemail')`,
          busy: sql<number>`COUNT(*) FILTER (WHERE call_outcome = 'busy')`,
          failed: sql<number>`COUNT(*) FILTER (WHERE call_outcome = 'failed')`,
        })
        .from(voiceDeliveryReports)
        .where(eq(voiceDeliveryReports.companyId, companyId)),
    ]);

    const stats = callStatsResult[0];
    const delivery = deliveryStatsResult[0];

    logger.info('Voice analytics fetched from local DB', { 
      totalCalls: stats?.totalCalls ?? 0,
      days,
    });

    return NextResponse.json({
      success: true,
      data: {
        totalCalls: Number(stats?.totalCalls ?? 0),
        totalDuration: Number(stats?.totalDuration ?? 0),
        avgDuration: Number(stats?.avgDuration ?? 0),
        totalCost: 0,
        callsByStatus: {
          ended: Number(stats?.endedCalls ?? 0),
          failed: Number(stats?.failedCalls ?? 0),
        },
        callsByDirection: {
          inbound: Number(stats?.inboundCalls ?? 0),
          outbound: Number(stats?.outboundCalls ?? 0),
        },
        campaignDelivery: {
          total: Number(delivery?.total ?? 0),
          answered: Number(delivery?.answered ?? 0),
          notAnswered: Number(delivery?.notAnswered ?? 0),
          voicemail: Number(delivery?.voicemail ?? 0),
          busy: Number(delivery?.busy ?? 0),
          failed: Number(delivery?.failed ?? 0),
        },
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
      },
      source: 'local_database',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching voice analytics', { error });
    // Also log to console for immediate visibility in Replit logs
    console.error('[VoiceAnalytics] Error:', error);
    return NextResponse.json(
      { error: 'Falha ao buscar analytics de voz', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
