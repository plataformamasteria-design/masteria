import { NextResponse } from 'next/server';
import { twilioService } from '@/lib/twilio-service';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    if (!twilioService.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Twilio API não configurada' },
        { status: 503 }
      );
    }

    const numbers = await twilioService.listPhoneNumbers();

    return NextResponse.json({
      success: true,
      data: numbers,
      meta: {
        total: numbers.length,
      },
    });
  } catch (error) {
    logger.error('Erro ao listar números Twilio', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { success: false, error: 'Falha ao listar números de telefone', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
