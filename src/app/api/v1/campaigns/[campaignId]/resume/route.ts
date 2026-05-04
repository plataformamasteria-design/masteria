import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/v1/campaigns/[campaignId]/resume
 * Retoma uma campanha pausada
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

    // Verifica se a campanha está pausada
    if (campaign.status !== 'PAUSED') {
      return NextResponse.json({ 
        error: 'Operação inválida',
        description: `Apenas campanhas pausadas podem ser retomadas. Status atual: "${campaign.status}".`
      }, { status: 400 });
    }

    // Determina o novo status baseado em scheduledAt
    const now = new Date();
    const isScheduled = campaign.scheduledAt && new Date(campaign.scheduledAt) > now;
    const newStatus = isScheduled ? 'SCHEDULED' : 'QUEUED';

    // Atualiza status para que o CRON trigger processe a campanha
    // Nota: O CRON busca campanhas por status (QUEUED, PENDING, SCHEDULED) diretamente do banco,
    // não consome a fila Redis. A fila Redis é apenas um registro adicional.
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({ status: newStatus })
      .where(eq(campaigns.id, campaignId))
      .returning();

    return NextResponse.json({ 
      success: true,
      message: `Campanha "${campaign.name}" retomada com sucesso.`,
      campaign: updatedCampaign
    });

  } catch (error) {
    console.error('Erro ao retomar campanha:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
