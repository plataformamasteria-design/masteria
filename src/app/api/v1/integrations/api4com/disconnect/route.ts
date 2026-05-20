import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { crmIntegrations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();

    await db
      .delete(crmIntegrations)
      .where(and(eq(crmIntegrations.companyId, companyId), eq(crmIntegrations.provider, 'api4com')));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting API4COM:', error);
    return NextResponse.json({ error: 'Erro interno ao desconectar' }, { status: 500 });
  }
}
