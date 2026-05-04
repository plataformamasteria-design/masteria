import { NextRequest, NextResponse } from 'next/server';
import { webhookSyncScheduler } from '@/services/webhook-sync-scheduler.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/webhooks/scheduler/start
 * Inicia scheduler automático de sincronização
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, companyId, daysBack } = body;

    if (action === 'start') {
      await webhookSyncScheduler.initialize();
      return NextResponse.json({
        status: 'started',
        message: 'Scheduler iniciado - sincronização automática cada 6 horas',
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'trigger' && companyId) {
      const jobId = await webhookSyncScheduler.triggerManualSync(
        companyId,
        daysBack || 1
      );
      return NextResponse.json({
        status: 'triggered',
        jobId,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'status' && companyId) {
      const status = await webhookSyncScheduler.getJobStatus(companyId);
      return NextResponse.json(status);
    }

    return NextResponse.json(
      { error: 'Action inválida: start | trigger | status' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[SCHEDULER-API]', error);
    return NextResponse.json(
      { error: 'Erro no scheduler' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        {
          message: 'Endpoints disponíveis:',
          endpoints: {
            'POST /api/v1/webhooks/scheduler': {
              start: 'Iniciar scheduler automático',
              trigger: 'Trigger manual (requer companyId)',
              status: 'Ver status (requer companyId)',
            },
            'GET /api/v1/webhooks/export?companyId=xxx&format=csv|json':
              'Exportar eventos',
          },
        },
        { status: 200 }
      );
    }

    const status = await webhookSyncScheduler.getJobStatus(jobId);
    return NextResponse.json(status);
  } catch (error) {
    console.error('[SCHEDULER-GET]', error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
