import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

/**
 * GET /api/v1/automation-flows/webhook-trigger/listen?flowId=xxx
 * 
 * Long-polling endpoint for webhook test mode.
 * Waits up to 5 minutes for a webhook event to arrive in Redis.
 * Used by the frontend "Listen for Event" button.
 */

const WEBHOOK_EVENT_PREFIX = 'webhook_event:';

export async function GET(req: NextRequest) {
    const flowId = req.nextUrl.searchParams.get('flowId');

    if (!flowId) {
        return NextResponse.json(
            { success: false, error: 'flowId is required' },
            { status: 400 }
        );
    }

    const maxWait = 300000; // 5 minutes
    const pollInterval = 1000; // check every 1s (less aggressive than 500ms)
    const startTime = Date.now();
    const redisKey = `${WEBHOOK_EVENT_PREFIX}${flowId}`;

    console.log(`[webhook-listen] Starting listen for flowId=${flowId}, key=${redisKey}`);

    // Long-poll: check Redis for webhook events
    while (Date.now() - startTime < maxWait) {
        try {
            const stored = await redis.get(redisKey);
            if (stored) {
                // Consume the event (delete from Redis)
                await redis.del(redisKey);
                const parsed = JSON.parse(stored as string);
                console.log(`[webhook-listen] Event found for flowId=${flowId} after ${Date.now() - startTime}ms`);

                return NextResponse.json({
                    success: true,
                    received: true,
                    data: parsed.data,
                    receivedAt: new Date(parsed.timestamp).toISOString(),
                    waitTime: Date.now() - startTime,
                });
            }
        } catch (redisErr) {
            console.error('[webhook-listen] Redis read error:', redisErr);
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.log(`[webhook-listen] Timeout for flowId=${flowId} after ${maxWait}ms`);

    // Timeout — no event received
    return NextResponse.json({
        success: true,
        received: false,
        timeout: true,
        waitTime: maxWait,
        message: 'No webhook event received within 5 minutes.',
    });
}
