import { NextRequest, NextResponse } from 'next/server';
import { getMetrics, getMetricsJson } from '@/lib/metrics';
import { headers } from 'next/headers';

/**
 * Prometheus metrics endpoint
 * Returns metrics in Prometheus text format for scraping
 * Protected by bearer token for security
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers();
    const authorization = headersList.get('authorization');
    
    // Basic security: Require a bearer token for access
    const metricsToken = process.env.METRICS_TOKEN || 'metrics-secret-token-change-in-production';
    
    // Check authorization
    if (authorization) {
      const token = authorization.replace(/^Bearer\s+/i, '');
      if (token !== metricsToken) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    } else {
      // Alternative: Check for special query parameter (less secure but easier for some scrapers)
      const { searchParams } = new URL(request.url);
      const token = searchParams.get('token');
      
      if (token !== metricsToken) {
        // Also allow local access without token (for development)
        const isLocalhost = request.headers.get('host')?.includes('localhost') || 
                          request.headers.get('host')?.includes('127.0.0.1');
        
        if (!isLocalhost) {
          return NextResponse.json(
            { error: 'Unauthorized. Metrics endpoint requires authentication.' },
            { status: 401 }
          );
        }
      }
    }
    
    // Check Accept header to determine response format
    const acceptHeader = request.headers.get('accept') || '';
    
    if (acceptHeader.includes('application/json')) {
      // Return JSON format for easier debugging
      const jsonMetrics = await getMetricsJson();
      return NextResponse.json(jsonMetrics, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
    }
    
    // Return Prometheus text format (default)
    const metrics = await getMetrics();
    
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[Metrics] Error generating metrics:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    );
  }
}

/**
 * Health check for metrics endpoint
 */
export async function HEAD(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

// Export config for better performance
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;