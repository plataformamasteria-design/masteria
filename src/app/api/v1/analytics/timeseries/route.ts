import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { analyticsService } from '@/services/analytics.service';
import { getCachedOrFetch, CacheTTL } from '@/lib/api-cache';
import { differenceInDays } from 'date-fns';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getUserSession();

    if (!user?.companyId) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const granularity = (searchParams.get('granularity') as 'day' | 'week' | 'month') || 'day';

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const companyId = user.companyId!;
    const cacheKey = `analytics-timeseries:${companyId}:${startDate}:${endDate}:${granularity}`;
    
    // Determinar se é histórico (> 1 dia atrás) ou atual
    const daysDiff = differenceInDays(new Date(), new Date(endDate));
    const isHistorical = daysDiff > 1;
    const ttl = isHistorical ? CacheTTL.ANALYTICS_TIMESERIES_HISTORICAL : CacheTTL.ANALYTICS_TIMESERIES_CURRENT;

    const timeseries = await getCachedOrFetch(cacheKey, async () => {
      return await analyticsService.getTimeSeriesData(
        companyId,
        {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
        granularity
      );
    }, ttl);

    return NextResponse.json(timeseries);
  } catch (error) {
    console.error('[Analytics Timeseries] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time series data', details: (error as Error).message },
      { status: 500 }
    );
  }
}
