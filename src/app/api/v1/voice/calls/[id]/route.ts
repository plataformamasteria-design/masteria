import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { voiceCalls } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { getCompanyIdFromSession } from '@/app/actions';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { id } = await params;

    const call = await db.query.voiceCalls.findFirst({
      where: and(
        eq(voiceCalls.id, id),
        eq(voiceCalls.companyId, companyId)
      ),
      with: {
        agent: true,
        contact: true,
        conversation: true,
      },
    });

    if (!call) {
      return NextResponse.json(
        { error: 'Chamada não encontrada' },
        { status: 404 }
      );
    }

    logger.info('Voice call fetched', { callId: id });

    return NextResponse.json({
      success: true,
      data: call,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching voice call', { error });
    return NextResponse.json(
      { error: 'Falha ao buscar chamada de voz', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
