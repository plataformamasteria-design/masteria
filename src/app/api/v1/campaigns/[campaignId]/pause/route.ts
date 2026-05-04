import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/v1/campaigns/[campaignId]/pause
 * Pausa uma campanha em andamento
 */
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
): Promise<NextResponse> {
  try {
    const companyId = await getCompanyIdFromSession();
    const { campaignId } = await params;

    // Busca a campanha e verifica ownership
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(
        eq(campaigns.id, campaignId),
        eq(campaigns.companyId, companyId)
      ));

    if (!campaign) {
      return NextResponse.json({ 
        error: 'Campanha não encontrada',
        description: 'A campanha não existe ou não pertence à sua empresa.'
      }, { status: 404 });
    }

    // Verifica se a campanha está em um status que permite pausa
    const pausableStatuses = ['QUEUED', 'SENDING', 'SCHEDULED'];
    if (!pausableStatuses.includes(campaign.status)) {
      return NextResponse.json({ 
        error: 'Operação inválida',
        description: `Não é possível pausar uma campanha com status "${campaign.status}". Apenas campanhas agendadas, na fila ou em envio podem ser pausadas.`
      }, { status: 400 });
    }

    // Atualiza status para PAUSED
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({ status: 'PAUSED' })
      .where(eq(campaigns.id, campaignId))
      .returning();

    return NextResponse.json({ 
      success: true,
      message: `Campanha "${campaign.name}" pausada com sucesso.`,
      campaign: updatedCampaign
    });

  } catch (error) {
    console.error('Erro ao pausar campanha:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
