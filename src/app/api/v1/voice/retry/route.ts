import { NextRequest, NextResponse } from 'next/server';
import { processVoiceRetryQueue, getRetryQueueStats, cancelPendingRetries } from '@/services/voice-retry.service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const internalKey = searchParams.get('key');
    const expectedKey = process.env.INTERNAL_WORKER_KEY || process.env.CRON_SECRET;
    
    if (!expectedKey || internalKey !== expectedKey) {
      logger.warn('Unauthorized voice retry attempt');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Voice retry triggered via internal key');
    const result = await processVoiceRetryQueue();
    
    const processingTime = Date.now() - startTime;
    
    logger.info('Voice retry queue processed', {
      ...result,
      processingTimeMs: processingTime,
    });

    return NextResponse.json({
      success: true,
      ...result,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Voice retry processing error', { error });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    const stats = await getRetryQueueStats(companyId || undefined);

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Voice retry stats error', { error });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { campaignId } = body;

    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId is required' }, { status: 400 });
    }

    const cancelledCount = await cancelPendingRetries(campaignId);

    return NextResponse.json({
      success: true,
      cancelledCount,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Voice retry cancellation error', { error });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
