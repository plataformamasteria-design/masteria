// src/app/api/v1/alerts/history/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { getCompanyIdFromSession, getUserIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { alerts } from '@/lib/db/schema';
import { eq, desc, gte, lte, and, sql } from 'drizzle-orm';

// GET /api/v1/alerts/history - Get alert history

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    const userId = await getUserIdFromSession();
    
    if (!companyId || !userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    
    // Parse parameters
    const params = {
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      severity: searchParams.get('severity'),
      alertType: searchParams.get('alertType'),
      status: searchParams.get('status'),
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };
    
    // Build query conditions
    const conditions = [eq(alerts.companyId, companyId)];
    
    if (params.startDate) {
      conditions.push(gte(alerts.createdAt, new Date(params.startDate)));
    }
    
    if (params.endDate) {
      conditions.push(lte(alerts.createdAt, new Date(params.endDate)));
    }
    
    if (params.severity) {
      conditions.push(eq(alerts.severity, params.severity as any));
    }
    
    if (params.alertType) {
      conditions.push(eq(alerts.alertType, params.alertType as any));
    }
    
    if (params.status) {
      conditions.push(eq(alerts.status, params.status as any));
    }
    
    // Get alert history
    const [alertHistory, totalCount] = await Promise.all([
      db
        .select({
          id: alerts.id,
          alertType: alerts.alertType,
          severity: alerts.severity,
          status: alerts.status,
          title: alerts.title,
          message: alerts.message,
          metric: alerts.metric,
          threshold: alerts.threshold,
          currentValue: alerts.currentValue,
          occurrenceCount: alerts.occurrenceCount,
          firstOccurredAt: alerts.firstOccurredAt,
          lastOccurredAt: alerts.lastOccurredAt,
          acknowledgedAt: alerts.acknowledgedAt,
          resolvedAt: alerts.resolvedAt,
          createdAt: alerts.createdAt,
        })
        .from(alerts)
        .where(and(...conditions))
        .orderBy(desc(alerts.createdAt))
        .limit(params.limit)
        .offset(params.offset),
        
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(alerts)
        .where(and(...conditions))
        .then(result => result[0]?.count || 0),
    ]);
    
    // Get aggregated statistics for the period
    const statistics = await db
      .select({
        totalAlerts: sql<number>`count(*)::int`,
        criticalCount: sql<number>`count(*) filter (where ${alerts.severity} = 'CRITICAL')::int`,
        highCount: sql<number>`count(*) filter (where ${alerts.severity} = 'HIGH')::int`,
        mediumCount: sql<number>`count(*) filter (where ${alerts.severity} = 'MEDIUM')::int`,
        lowCount: sql<number>`count(*) filter (where ${alerts.severity} = 'LOW')::int`,
        avgResolutionTime: sql<number>`
          avg(
            extract(epoch from (${alerts.resolvedAt} - ${alerts.createdAt}))
          ) filter (where ${alerts.status} = 'resolved')
        `,
        avgAcknowledgmentTime: sql<number>`
          avg(
            extract(epoch from (${alerts.acknowledgedAt} - ${alerts.createdAt}))
          ) filter (where ${alerts.acknowledgedAt} is not null)
        `,
      })
      .from(alerts)
      .where(and(...conditions))
      .then(result => result[0]);
    
    // Get top alert types
    const topAlertTypes = await db
      .select({
        alertType: alerts.alertType,
        count: sql<number>`count(*)::int`,
      })
      .from(alerts)
      .where(and(...conditions))
      .groupBy(alerts.alertType)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(5);
    
    return NextResponse.json({
      alerts: alertHistory,
      pagination: {
        total: totalCount,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + params.limit < totalCount,
      },
      statistics: statistics ? {
        ...statistics,
        avgResolutionTimeMinutes: statistics.avgResolutionTime 
          ? Math.round(statistics.avgResolutionTime / 60) 
          : null,
        avgAcknowledgmentTimeMinutes: statistics.avgAcknowledgmentTime
          ? Math.round(statistics.avgAcknowledgmentTime / 60)
          : null,
        topAlertTypes,
      } : {
        avgResolutionTime: null,
        avgAcknowledgmentTime: null,
        avgResolutionTimeMinutes: null,
        avgAcknowledgmentTimeMinutes: null,
        topAlertTypes: [],
      },
    });
  } catch (error) {
    console.error('[API] Error fetching alert history:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar histórico de alertas' },
      { status: 500 }
    );
  }
}