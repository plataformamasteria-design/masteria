import { NextResponse } from 'next/server';
import { conn } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId required' },
        { status: 400 }
      );
    }

    // Get webhook statistics
    const stats = await conn`
      SELECT
        COUNT(*) as total_events,
        COUNT(CASE WHEN signature_valid = true THEN 1 END) as signed_events,
        COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed_events,
        source,
        event_type
      FROM incoming_webhook_events
      WHERE company_id = ${companyId}
        AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY source, event_type
    `;

    // Get recent events
    const recentEvents = await conn`
      SELECT
        id,
        source,
        event_type,
        signature_valid,
        created_at,
        processed_at
      FROM incoming_webhook_events
      WHERE company_id = ${companyId}
        AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 20
    `;

    // Get failed events
    const failedEvents = await conn`
      SELECT
        id,
        source,
        event_type,
        created_at,
        payload
      FROM incoming_webhook_events
      WHERE company_id = ${companyId}
        AND processed_at IS NULL
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    return NextResponse.json({
      stats: stats || [],
      recentEvents: recentEvents || [],
      failedEvents: failedEvents || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WEBHOOK-METRICS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook metrics' },
      { status: 500 }
    );
  }
}
