import { NextResponse, type NextRequest } from 'next/server';
import { processPendingCampaigns } from '@/services/campaign-processing.service';

export const dynamic = 'force-dynamic';

function getBrasiliaTime(): string {
  return new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export async function GET(_request: NextRequest) {
  try {
    const result = await processPendingCampaigns();

    if (result.processed === 0) {
      return NextResponse.json({
        now: getBrasiliaTime(),
        message: 'Nenhuma campanha pendente para executar.',
        processed: 0,
      });
    }

    return NextResponse.json({
      now: getBrasiliaTime(),
      message: `${result.processed} campanhas foram processadas.`,
      ...result,
    });
  } catch (error) {
    console.error('Erro geral no endpoint do cron de campanhas:', error);
    return NextResponse.json(
      {
        now: getBrasiliaTime(),
        error: 'Erro interno do servidor.',
      },
      { status: 500 }
    );
  }
}
