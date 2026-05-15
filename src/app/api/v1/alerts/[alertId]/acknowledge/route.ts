// src/app/api/v1/alerts/[alertId]/acknowledge/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { getCompanyIdFromSession, getUserIdFromSession } from '@/app/actions';
import { AlertService } from '@/services/alert.service';
import { db } from '@/lib/db';
import { alerts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/v1/alerts/[alertId]/acknowledge - Acknowledge an alert

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    const userId = await getUserIdFromSession();
    
    if (!companyId || !userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    
    const { alertId } = await params;
    
    // Verify alert belongs to company
    const [alert] = await db
      .select()
      .from(alerts)
      .where(and(
        eq(alerts.id, alertId),
        eq(alerts.companyId, companyId)
      ))
      .limit(1);
    
    if (!alert) {
      return NextResponse.json(
        { error: 'Alerta não encontrado' },
        { status: 404 }
      );
    }
    
    if (alert.status !== 'active') {
      return NextResponse.json(
        { error: 'Alerta já foi processado' },
        { status: 400 }
      );
    }
    
    // Acknowledge alert
    const success = await AlertService.acknowledgeAlert(alertId, userId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Falha ao confirmar alerta' },
        { status: 500 }
      );
    }
    
    // Get updated alert
    const [updatedAlert] = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, alertId))
      .limit(1);
    
    return NextResponse.json({
      alert: updatedAlert,
      message: 'Alerta confirmado com sucesso',
    });
  } catch (error) {
    console.error('[API] Error acknowledging alert:', error);
    return NextResponse.json(
      { error: 'Erro ao confirmar alerta' },
      { status: 500 }
    );
  }
}