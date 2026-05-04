import { NextResponse } from 'next/server';
import { conn } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface AlertConfig {
  failureThreshold: number;
  timeWindowMinutes: number;
}

const DEFAULT_CONFIG: AlertConfig = {
  failureThreshold: 5,
  timeWindowMinutes: 15,
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const threshold = parseFloat(searchParams.get('threshold') || String(DEFAULT_CONFIG.failureThreshold));
    const windowMinutes = parseInt(searchParams.get('window') || String(DEFAULT_CONFIG.timeWindowMinutes));

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const intervalStr = `${windowMinutes} minutes`;
    const stats = await conn`
      SELECT
        COUNT(*) as total_events,
        COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed_events,
        COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as failed_events
      FROM incoming_webhook_events
      WHERE company_id = ${companyId}
        AND created_at > NOW() - ${intervalStr}::interval
    `;

    const result = (stats as any)?.[0];
    const totalEvents = parseInt(result?.total_events || '0');
    const failedEvents = parseInt(result?.failed_events || '0');
    const failureRate = totalEvents > 0 ? (failedEvents / totalEvents) * 100 : 0;

    const alertTriggered = failureRate > threshold;
    const alertLevel = failureRate > 20 ? 'critical' : failureRate > 10 ? 'warning' : 'info';

    const alerts = [];
    
    if (alertTriggered) {
      alerts.push({
        type: 'failure_rate',
        level: alertLevel,
        message: `Failure rate ${failureRate.toFixed(1)}% exceeds threshold ${threshold}%`,
        metrics: {
          totalEvents,
          failedEvents,
          failureRate: parseFloat(failureRate.toFixed(2)),
          threshold,
          timeWindow: `${windowMinutes} minutes`,
        },
        timestamp: new Date().toISOString(),
      });

      console.log(`🚨 [WEBHOOK-ALERT] Failure rate alert triggered: ${failureRate.toFixed(1)}% > ${threshold}%`);
    }

    return NextResponse.json({
      status: alertTriggered ? 'alert' : 'healthy',
      alerts,
      metrics: {
        totalEvents,
        processedEvents: parseInt(result?.processed_events || '0'),
        failedEvents,
        failureRate: parseFloat(failureRate.toFixed(2)),
        threshold,
        timeWindow: `${windowMinutes} minutes`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WEBHOOK-ALERTS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { companyId, threshold = 5, windowMinutes = 15, action = 'check' } = await request.json();

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    if (action === 'check') {
      const url = new URL(request.url);
      url.searchParams.set('companyId', companyId);
      url.searchParams.set('threshold', String(threshold));
      url.searchParams.set('window', String(windowMinutes));
      
      const response = await fetch(url.toString());
      return response;
    }

    return NextResponse.json({
      success: true,
      message: 'Alert configuration updated',
      config: { threshold, windowMinutes },
    });
  } catch (error) {
    console.error('[WEBHOOK-ALERTS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process alert request' },
      { status: 500 }
    );
  }
}
