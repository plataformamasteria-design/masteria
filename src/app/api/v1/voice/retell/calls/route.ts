import { NextRequest, NextResponse } from 'next/server';
import { retellService } from '@/lib/retell-service';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    if (!retellService.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Retell API não configurada' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const calls = await retellService.listCalls(safeLimit);

    return NextResponse.json({
      success: true,
      data: calls,
      meta: {
        limit: safeLimit,
        total: calls.length,
      },
    });
  } catch (error) {
    logger.error('Erro ao listar chamadas Retell', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { success: false, error: 'Falha ao listar chamadas', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
