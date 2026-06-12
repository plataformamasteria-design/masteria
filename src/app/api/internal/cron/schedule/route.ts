import { NextResponse } from 'next/server';
import { evaluateScheduleTriggers } from '@/lib/flow-engine';
import { db } from '@/lib/db';

// This endpoint should be called every minute by a cron job
// e.g. * * * * * curl -X POST https://yourdomain.com/api/internal/cron/schedule
export async function POST(req: Request) {
    try {
        // Optional security check - ensure caller is authorized
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[CRON] Starting evaluateScheduleTriggers...');
        await evaluateScheduleTriggers();
        console.log('[CRON] evaluateScheduleTriggers completed.');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[CRON] Error evaluating schedule triggers:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    return POST(req);
}
