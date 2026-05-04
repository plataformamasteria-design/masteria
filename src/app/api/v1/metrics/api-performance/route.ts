import { NextRequest, NextResponse } from 'next/server';
import { ApiMetrics } from '@/lib/metrics/api-metrics';
import { getUserSession } from '@/app/actions';

/**
 * GET /api/v1/metrics/api-performance
 * 
 * Returns latency and throughput metrics for external API providers
 * Includes P50, P95, P99, avg latency, throughput, and error rates
 */

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await getUserSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all metrics
    const metrics = await ApiMetrics.getAllMetrics();
    
    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API Metrics] Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/metrics/api-performance
 * 
 * Clear all metrics (for testing/debugging)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getUserSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (provider) {
      await ApiMetrics.clearMetrics(provider as any);
    } else {
      await ApiMetrics.clearMetrics();
    }
    
    return NextResponse.json({
      success: true,
      message: provider 
        ? `Metrics cleared for ${provider}` 
        : 'All metrics cleared'
    });
  } catch (error) {
    console.error('[API Metrics] Error clearing metrics:', error);
    return NextResponse.json(
      { error: 'Failed to clear metrics' },
      { status: 500 }
    );
  }
}
