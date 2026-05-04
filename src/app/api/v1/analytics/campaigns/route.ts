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

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const companyId = user.companyId!;
    const cacheKey = `analytics-campaigns:${companyId}:${startDate}:${endDate}`;
    
    // Determinar se é histórico (> 1 dia atrás) ou atual
    const daysDiff = differenceInDays(new Date(), new Date(endDate));
    const isHistorical = daysDiff > 1;
    const ttl = isHistorical ? CacheTTL.ANALYTICS_TIMESERIES_HISTORICAL : CacheTTL.ANALYTICS_TIMESERIES_CURRENT;

    const data = await getCachedOrFetch(cacheKey, async () => {
      const campaigns = await analyticsService.getCampaignMetrics(companyId, {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      const notifications = await analyticsService.getNotificationMetrics(companyId, {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      return { campaigns, notifications };
    }, ttl);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Analytics Campaigns] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign metrics', details: (error as Error).message },
      { status: 500 }
    );
  }
}
