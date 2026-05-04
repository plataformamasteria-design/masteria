import { NextRequest, NextResponse } from 'next/server';
import { conn } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { eventId, companyId } = await request.json();

    if (!eventId || !companyId) {
      return NextResponse.json(
        { error: 'eventId and companyId required' },
        { status: 400 }
      );
    }

    // Get event details
    const eventResult = await conn`
      SELECT * FROM incoming_webhook_events
      WHERE id = ${eventId} AND company_id = ${companyId}
      LIMIT 1
    `;

    if (!eventResult || (eventResult as any).length === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const _event = (eventResult as any)[0];

    // Mark for reprocessing
    await conn`
      UPDATE incoming_webhook_events
      SET processed_at = NULL, updated_at = NOW()
      WHERE id = ${eventId}
    `;

    console.log(`✅ [WEBHOOK-RETRY] Event ${eventId} marked for reprocessing`);

    return NextResponse.json({
      success: true,
      message: 'Event marked for reprocessing',
      eventId,
    });
  } catch (error) {
    console.error('[WEBHOOK-RETRY] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retry event' },
      { status: 500 }
    );
  }
}
