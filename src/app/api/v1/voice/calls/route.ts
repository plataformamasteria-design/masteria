import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { voiceCalls } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { getCompanyIdFromSession } from '@/app/actions';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const calls = await db.query.voiceCalls.findMany({
      where: eq(voiceCalls.companyId, companyId),
      orderBy: [desc(voiceCalls.createdAt)],
      limit,
      offset,
      with: {
        agent: true,
        contact: true,
      },
    });

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(voiceCalls)
      .where(eq(voiceCalls.companyId, companyId));

    const total = Number(countResult[0]?.count ?? 0);

    logger.info('Voice calls listed', { count: calls.length, total, limit, offset });

    return NextResponse.json({
      success: true,
      data: calls,
      total,
      pagination: { limit, offset },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error listing voice calls', { error });
    return NextResponse.json(
      { error: 'Falha ao listar chamadas de voz', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
