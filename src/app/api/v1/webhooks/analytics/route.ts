import { NextResponse } from 'next/server';
import { conn } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const hours = parseInt(searchParams.get('hours') || '24');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId required' },
        { status: 400 }
      );
    }

    // Hourly success/failure metrics
    const hourlyData = await conn`
      SELECT
        DATE_TRUNC('hour', created_at)::text as hour,
        COUNT(*) as total_events,
        COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as success_events,
        COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as failed_events,
        TRUNC(
          COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END)::float / 
          COUNT(*)::float * 100 * 100
        ) / 100 as success_rate
      FROM incoming_webhook_events
      WHERE company_id = ${companyId}
        AND created_at > NOW() - (${hours}::text || ' hours')::interval
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour DESC
    `;

    // Event type breakdown
    const eventTypeStats = await conn`
      SELECT
        event_type,
        COUNT(*) as total,
        COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as success,
        COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as failed,
        TRUNC(
          COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END)::float / 
          COUNT(*)::float * 100 * 100
        ) / 100 as success_rate
      FROM incoming_webhook_events
      WHERE company_id = ${companyId}
        AND created_at > NOW() - (${hours}::text || ' hours')::interval
      GROUP BY event_type
      ORDER BY total DESC
    `;

    // Overall statistics
    const overallStats = await conn`
      SELECT
        COUNT(*) as total_events,
        COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as success_events,
        COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as failed_events,
        COUNT(CASE WHEN signature_valid = true THEN 1 END) as signed_events,
        TRUNC(
          COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END)::float / 
          COUNT(*)::float * 100 * 100
        ) / 100 as overall_success_rate,
        TRUNC(
          AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) * 100
        ) / 100 as avg_processing_time_seconds
      FROM incoming_webhook_events
      WHERE company_id = ${companyId}
        AND created_at > NOW() - (${hours}::text || ' hours')::interval
        AND processed_at IS NOT NULL
    `;

    const overall = (overallStats as any)?.[0];

    return NextResponse.json({
      timeRange: {
        hours,
        startTime: new Date(Date.now() - hours * 3600000).toISOString(),
        endTime: new Date().toISOString(),
      },
      hourlyData: hourlyData || [],
      eventTypeStats: eventTypeStats || [],
      overallStats: {
        totalEvents: parseInt(overall?.total_events || '0'),
        successEvents: parseInt(overall?.success_events || '0'),
        failedEvents: parseInt(overall?.failed_events || '0'),
        signedEvents: parseInt(overall?.signed_events || '0'),
        overallSuccessRate: parseFloat(overall?.overall_success_rate || '0'),
        avgProcessingTimeSeconds: parseFloat(overall?.avg_processing_time_seconds || '0'),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WEBHOOK-ANALYTICS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
