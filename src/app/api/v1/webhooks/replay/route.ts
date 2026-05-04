import { NextRequest, NextResponse } from 'next/server';
import { conn } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const eventType = searchParams.get('eventType');
    const source = searchParams.get('source');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    let query = conn`
      SELECT
        id,
        source,
        event_type,
        payload,
        signature_valid,
        created_at,
        processed_at,
        headers
      FROM incoming_webhook_events
      WHERE company_id = ${companyId}
    `;

    if (eventType) {
      query = conn`
        SELECT id, source, event_type, payload, signature_valid, created_at, processed_at, headers
        FROM incoming_webhook_events
        WHERE company_id = ${companyId} AND event_type = ${eventType}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (source) {
      query = conn`
        SELECT id, source, event_type, payload, signature_valid, created_at, processed_at, headers
        FROM incoming_webhook_events
        WHERE company_id = ${companyId} AND source = ${source}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = conn`
        SELECT id, source, event_type, payload, signature_valid, created_at, processed_at, headers
        FROM incoming_webhook_events
        WHERE company_id = ${companyId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const events = await query;

    const totalResult = await conn`
      SELECT COUNT(*) as total FROM incoming_webhook_events WHERE company_id = ${companyId}
    `;
    const total = parseInt((totalResult as any)?.[0]?.total || '0');

    return NextResponse.json({
      events: events || [],
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WEBHOOK-REPLAY] Error listing events:', error);
    return NextResponse.json(
      { error: 'Failed to list events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { eventId, companyId, modifiedPayload } = await request.json();

    if (!eventId || !companyId) {
      return NextResponse.json(
        { error: 'eventId and companyId required' },
        { status: 400 }
      );
    }

    const eventResult = await conn`
      SELECT * FROM incoming_webhook_events
      WHERE id = ${eventId} AND company_id = ${companyId}
      LIMIT 1
    `;

    if (!eventResult || (eventResult as any).length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const originalEvent = (eventResult as any)[0];

    const replayId = uuidv4();
    const replayPayload = modifiedPayload || originalEvent.payload;

    const nowTimestamp = new Date().toISOString();
    await conn`
      INSERT INTO incoming_webhook_events 
      (id, company_id, source, event_type, payload, headers, ip_address, signature_valid, processed_at, created_at)
      VALUES (
        ${replayId},
        ${companyId},
        ${originalEvent.source},
        ${originalEvent.event_type},
        ${JSON.stringify({
          ...replayPayload,
          _replay: {
            originalEventId: eventId,
            replayedAt: nowTimestamp,
            isReplay: true,
          },
        })},
        ${JSON.stringify({ ...originalEvent.headers, 'x-replay-of': eventId })},
        ${originalEvent.ip_address},
        ${true},
        ${null},
        ${nowTimestamp}
      )
    `;

    console.log(`✅ [WEBHOOK-REPLAY] Event ${eventId} replayed as ${replayId}`);

    return NextResponse.json({
      success: true,
      message: 'Event replayed successfully',
      replay: {
        originalEventId: eventId,
        replayEventId: replayId,
        eventType: originalEvent.event_type,
        source: originalEvent.source,
        replayedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[WEBHOOK-REPLAY] Error:', error);
    return NextResponse.json(
      { error: 'Failed to replay event' },
      { status: 500 }
    );
  }
}
