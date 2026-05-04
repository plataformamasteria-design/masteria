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

    const [accountInfo, balance] = await Promise.all([
      twilioService.getAccountInfo(),
      twilioService.getBalance(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        account: accountInfo,
        balance: {
          amount: balance.balance,
          currency: balance.currency,
        },
      },
    });
  } catch (error) {
    logger.error('Erro ao buscar informações da conta Twilio', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { success: false, error: 'Falha ao buscar informações da conta', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
