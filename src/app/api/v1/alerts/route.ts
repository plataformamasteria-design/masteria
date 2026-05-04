// src/app/api/v1/alerts/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { getCompanyIdFromSession, getUserIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { alerts } from '@/lib/db/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { AlertService } from '@/services/alert.service';

// Schema validation
const getAlertsSchema = z.object({
  status: z.enum(['active', 'acknowledged', 'resolved', 'all']).optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

// GET /api/v1/alerts - List alerts

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
    const params = {
      status: searchParams.get('status') || 'active',
      severity: searchParams.get('severity'),
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };
    
    // Validate parameters
    try {
      getAlertsSchema.parse(params);
    } catch (error) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', details: error },
        { status: 400 }
      );
    }
    
    // Build query conditions
    const conditions = [eq(alerts.companyId, companyId)];
    
    if (params.status !== 'all') {
      if (params.status === 'active') {
        conditions.push(inArray(alerts.status, ['active', 'acknowledged'] as any));
      } else {
        conditions.push(eq(alerts.status, params.status as any));
      }
    }
    
    if (params.severity) {
      conditions.push(eq(alerts.severity, params.severity as any));
    }
    
    // Get alerts
    const [alertList, totalCount] = await Promise.all([
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
          context: alerts.context,
          occurrenceCount: alerts.occurrenceCount,
          firstOccurredAt: alerts.firstOccurredAt,
          lastOccurredAt: alerts.lastOccurredAt,
          acknowledgedAt: alerts.acknowledgedAt,
          acknowledgedBy: alerts.acknowledgedBy,
          resolvedAt: alerts.resolvedAt,
          resolvedBy: alerts.resolvedBy,
          createdAt: alerts.createdAt,
        })
        .from(alerts)
        .where(and(...conditions))
        .orderBy(desc(alerts.severity), desc(alerts.createdAt))
        .limit(params.limit)
        .offset(params.offset),
        
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(alerts)
        .where(and(...conditions))
        .then(result => result[0]?.count || 0),
    ]);
    
    // Get alert statistics
    const stats = await db
      .select({
        critical: sql<number>`count(*) filter (where ${alerts.severity} = 'CRITICAL' and ${alerts.status} in ('active', 'acknowledged'))::int`,
        high: sql<number>`count(*) filter (where ${alerts.severity} = 'HIGH' and ${alerts.status} in ('active', 'acknowledged'))::int`,
        medium: sql<number>`count(*) filter (where ${alerts.severity} = 'MEDIUM' and ${alerts.status} in ('active', 'acknowledged'))::int`,
        low: sql<number>`count(*) filter (where ${alerts.severity} = 'LOW' and ${alerts.status} in ('active', 'acknowledged'))::int`,
        active: sql<number>`count(*) filter (where ${alerts.status} = 'active')::int`,
        acknowledged: sql<number>`count(*) filter (where ${alerts.status} = 'acknowledged')::int`,
      })
      .from(alerts)
      .where(eq(alerts.companyId, companyId))
      .then(result => result[0]);
    
    return NextResponse.json({
      alerts: alertList,
      pagination: {
        total: totalCount,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + params.limit < totalCount,
      },
      statistics: stats,
    });
  } catch (error) {
    console.error('[API] Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar alertas' },
      { status: 500 }
    );
  }
}

// POST /api/v1/alerts - Create a custom alert
export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    const userId = await getUserIdFromSession();
    
    if (!companyId || !userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    
    const body = await request.json();
    
    const createAlertSchema = z.object({
      alertType: z.enum(['custom']),
      severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
      title: z.string().min(1).max(255),
      message: z.string().min(1),
      metric: z.string().optional(),
      threshold: z.number().optional(),
      currentValue: z.number().optional(),
      context: z.record(z.any()).optional(),
      channels: z.array(z.enum(['console', 'database', 'webhook', 'in_app', 'email'])).optional(),
    });
    
    // Validate request body
    let validatedData;
    try {
      validatedData = createAlertSchema.parse(body);
    } catch (error) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error },
        { status: 400 }
      );
    }
    
    // Create alert
    const alertId = await AlertService.createAlert({
      companyId,
      ...validatedData,
    });
    
    if (!alertId) {
      return NextResponse.json(
        { error: 'Falha ao criar alerta' },
        { status: 500 }
      );
    }
    
    // Get created alert
    const [newAlert] = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, alertId))
      .limit(1);
    
    return NextResponse.json({
      alert: newAlert,
      message: 'Alerta criado com sucesso',
    });
  } catch (error) {
    console.error('[API] Error creating alert:', error);
    return NextResponse.json(
      { error: 'Erro ao criar alerta' },
      { status: 500 }
    );
  }
}