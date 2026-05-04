// src/app/api/v1/integrations/kommo/status/route.ts
// Returns the current Kommo integration status for the authenticated company

import { NextResponse, type NextRequest } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { crmIntegrations, crmAccounts, crmSyncLogs } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();

    // 1. Find Kommo integration
    const [integration] = await db
      .select()
      .from(crmIntegrations)
      .where(
        and(
          eq(crmIntegrations.companyId, companyId),
          eq(crmIntegrations.provider, 'kommo')
        )
      )
      .limit(1);

    if (!integration || integration.status !== 'connected') {
      return NextResponse.json({
        connected: false,
        domain: null,
        config: null,
        syncStats: null,
      });
    }

    // 2. Get domain from account
    const [account] = await db
      .select({ domain: crmAccounts.domain })
      .from(crmAccounts)
      .where(eq(crmAccounts.integrationId, integration.id))
      .limit(1);

    // 3. Get sync stats
    const [syncStats] = await db
      .select({
        total: sql<number>`count(*)`,
        success: sql<number>`count(*) filter (where status = 'SUCCESS' and type = 'push')`,
        failed: sql<number>`count(*) filter (where status = 'FAILED' and type = 'push')`,
      })
      .from(crmSyncLogs)
      .where(eq(crmSyncLogs.integrationId, integration.id));

    return NextResponse.json({
      connected: true,
      domain: account?.domain || null,
      config: integration.config || null,
      syncStats: syncStats || { total: 0, success: 0, failed: 0 },
    });

  } catch (error) {
    console.error('[Kommo Status] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
