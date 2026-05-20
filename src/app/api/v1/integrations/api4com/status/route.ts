import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { crmIntegrations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    const results = await db
      .select()
      .from(crmIntegrations)
      .where(and(eq(crmIntegrations.companyId, companyId), eq(crmIntegrations.provider, 'api4com')));

    const integration = results[0];

    if (!integration) {
      return NextResponse.json({
        connected: false,
        config: null
      });
    }

    return NextResponse.json({
      connected: integration.status === 'connected',
      config: integration.config
    });
  } catch (error) {
    console.error('Error fetching API4COM status:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar status da integração' }, { status: 500 });
  }
}
