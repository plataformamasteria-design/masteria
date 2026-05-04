import { NextRequest, NextResponse } from 'next/server';
import { conn } from '@/lib/db';
import { getUserSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Security: filter by authenticated user's company
    const { user, error } = await getUserSession();
    if (!user?.companyId) {
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status: 401 }
      );
    }
    const companyId = user.companyId;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const webhookConfigId = searchParams.get('webhookConfigId') || null;

    // Build query with company_id filter + optional webhookConfigId filter
    let events: any;
    let countResult: any;

    if (webhookConfigId) {
      // Get the source from the webhook config to filter events
      const configResult = await conn`
        SELECT source FROM incoming_webhook_configs 
        WHERE id = ${webhookConfigId} AND company_id = ${companyId}
        LIMIT 1
      `;
      const configSource = (configResult as any)?.[0]?.source;

      if (configSource) {
        events = await conn`
          SELECT id, event_type, source, signature_valid, processed_at, created_at, payload
          FROM incoming_webhook_events
          WHERE company_id = ${companyId} AND source = ${configSource}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        countResult = await conn`
          SELECT COUNT(*)::int as count FROM incoming_webhook_events
          WHERE company_id = ${companyId} AND source = ${configSource}
        `;
      } else {
        // Config not found — return empty
        events = [];
        countResult = [{ count: 0 }];
      }
    } else {
      events = await conn`
        SELECT id, event_type, source, signature_valid, processed_at, created_at, payload
        FROM incoming_webhook_events
        WHERE company_id = ${companyId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await conn`
        SELECT COUNT(*)::int as count FROM incoming_webhook_events
        WHERE company_id = ${companyId}
      `;
    }

    return NextResponse.json({
      data: events,
      pagination: {
        total: (countResult as any)?.[0]?.count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('[WEBHOOK-EVENTS-API]', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook events', details: String(error) },
      { status: 500 }
    );
  }
}
