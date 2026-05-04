import { NextResponse } from 'next/server';
import { retellService } from '@/lib/retell-service';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    if (!retellService.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Retell API não configurada' },
        { status: 503 }
      );
    }

    const voices = await retellService.listVoicesPtBR();

    return NextResponse.json({
      success: true,
      data: voices,
      meta: {
        total: voices.length,
        filtered: true,
        description: 'Vozes compatíveis com pt-BR e multilíngues',
      },
    });
  } catch (error) {
    logger.error('Erro ao listar vozes Retell', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { success: false, error: 'Falha ao listar vozes', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
