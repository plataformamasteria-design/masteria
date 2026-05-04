// Test endpoint for rate limiting
import { NextResponse, type NextRequest } from 'next/server';
import { withRateLimit } from '@/middleware/rate-limit.middleware';
import { getCompanyIdFromSession, getUserIdFromSession } from '@/app/actions';
import { getClientIp } from '@/lib/rate-limiter';

async function handler(request: NextRequest) {
  try {
    // Try to get session info for authenticated testing
    let userId: string | null = null;
    let companyId: string | null = null;
    
    try {
      userId = await getUserIdFromSession();
      companyId = await getCompanyIdFromSession();
    } catch {
      // Not authenticated - will use IP-based limits
    }
    
    const ipAddress = getClientIp(request.headers);
    
    return NextResponse.json({
      success: true,
      message: 'Rate limit test successful',
      context: {
        authenticated: !!(userId && companyId),
        userId: userId || 'anonymous',
        companyId: companyId || 'none',
        ipAddress,
        timestamp: new Date().toISOString(),
      },
      headers: {
        'X-RateLimit-Info': 'Check response headers for rate limit information',
      }
    });
  } catch (error) {
    console.error('Test rate limit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Apply rate limiting

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export const GET = withRateLimit(handler);
export const POST = withRateLimit(handler);