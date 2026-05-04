import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { analyticsService } from '@/services/analytics.service';
import { getCachedOrFetch, CacheTTL } from '@/lib/api-cache';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getUserSession();

    if (!user?.companyId) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const boardId = searchParams.get('boardId');

    const companyId = user.companyId!;
    const cacheKey = `analytics-funnel:${companyId}:${boardId || 'all'}`;

    const funnel = await getCachedOrFetch(cacheKey, async () => {
      return await analyticsService.getFunnelData(companyId, boardId || undefined);
    }, CacheTTL.ANALYTICS_TIMESERIES_CURRENT);

    return NextResponse.json(funnel);
  } catch (error) {
    console.error('[Analytics Funnel] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch funnel data', details: (error as Error).message },
      { status: 500 }
    );
  }
}
