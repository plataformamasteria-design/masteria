import { db } from '@/lib/db';
import { campaigns, whatsappDeliveryReports, smsDeliveryReports } from '@/lib/db/schema';
import { eq, and, lte, or, inArray, desc, isNull } from 'drizzle-orm';
import { sendSmsCampaign, sendWhatsappCampaign, sendVoiceCampaign } from '@/lib/campaign-sender';

const ORPHAN_THRESHOLD_MS = 5 * 60 * 1000;

// Rastreia campanhas em execução por conexão (para evitar duplicatas)
// Cada conexão pode ter apenas UMA campanha ativa por vez
declare global {
  // eslint-disable-next-line no-var
  var __activeCampaignsByConnection: Map<string, string> | undefined;
}

function getActiveCampaigns(): Map<string, string> {
  if (!global.__activeCampaignsByConnection) {
    global.__activeCampaignsByConnection = new Map();
  }
  return global.__activeCampaignsByConnection;
}

function markCampaignActive(connectionId: string, campaignId: string): boolean {
  const active = getActiveCampaigns();
  if (active.has(connectionId)) {
    console.log(`[CampaignProcessor] Conexão ${connectionId} já tem campanha ${active.get(connectionId)} ativa. Pulando ${campaignId}.`);
    return false;
  }
  active.set(connectionId, campaignId);
  console.log(`[CampaignProcessor] ✅ Campanha ${campaignId} marcada como ativa na conexão ${connectionId}`);
  return true;
}

function markCampaignComplete(connectionId: string, campaignId: string): void {
  const active = getActiveCampaigns();
  if (active.get(connectionId) === campaignId) {
    active.delete(connectionId);
    console.log(`[CampaignProcessor] ✅ Campanha ${campaignId} removida da conexão ${connectionId}`);
  }
}

export interface CampaignProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  timestamp: string;
}

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

async function isOrphanedSendingCampaign(campaign: typeof campaigns.$inferSelect): Promise<boolean> {
  const now = Date.now();
  const channel = campaign.channel || 'WHATSAPP';
  const campaignId = campaign.id;
  
  if (channel === 'WHATSAPP') {
    const lastReport = await db
      .select({ sentAt: whatsappDeliveryReports.sentAt })
      .from(whatsappDeliveryReports)
      .where(eq(whatsappDeliveryReports.campaignId, campaignId))
      .orderBy(desc(whatsappDeliveryReports.sentAt))
      .limit(1);
    
    if (lastReport.length === 0) {
      const startedSendingAt = campaign.sentAt?.getTime() || campaign.createdAt.getTime();
      return now - startedSendingAt > ORPHAN_THRESHOLD_MS;
    }
    
    const lastSentAt = lastReport[0]?.sentAt;
    if (!lastSentAt) return true;
    
    return now - new Date(lastSentAt).getTime() > ORPHAN_THRESHOLD_MS;
  } else if (channel === 'SMS') {
    const lastReport = await db
      .select({ sentAt: smsDeliveryReports.sentAt })
      .from(smsDeliveryReports)
      .where(eq(smsDeliveryReports.campaignId, campaignId))
      .orderBy(desc(smsDeliveryReports.sentAt))
      .limit(1);
    
    if (lastReport.length === 0) {
      const startedSendingAt = campaign.sentAt?.getTime() || campaign.createdAt.getTime();
      return now - startedSendingAt > ORPHAN_THRESHOLD_MS;
    }
    
    const lastSentAt = lastReport[0]?.sentAt;
    if (!lastSentAt) return true;
    
    return now - new Date(lastSentAt).getTime() > ORPHAN_THRESHOLD_MS;
  }
  
  return true;
}

// Executa uma campanha de forma assíncrona (fire-and-forget)
// Cada conexão pode ter apenas uma campanha ativa por vez
async function executeCampaignAsync(campaign: typeof campaigns.$inferSelect): Promise<void> {
  const connectionId = campaign.connectionId || campaign.companyId;
  
  try {
    const channelUpper = campaign.channel?.toUpperCase();
    console.log(`[CampaignProcessor] 🚀 Iniciando campanha ${campaign.id} (${campaign.name}) na conexão ${connectionId}`);
    
    if (channelUpper === 'WHATSAPP') {
      await sendWhatsappCampaign(campaign);
    } else if (channelUpper === 'SMS') {
      await sendSmsCampaign(campaign);
    } else if (channelUpper === 'VOICE') {
      await sendVoiceCampaign(campaign);
    }
    
    console.log(`[CampaignProcessor] ✅ Campanha ${campaign.id} (${campaign.name}) concluída com sucesso`);
  } catch (error) {
    console.error(`[CampaignProcessor] ❌ Erro na campanha ${campaign.id}:`, error);
  } finally {
    // Sempre liberar a conexão ao final
    markCampaignComplete(connectionId, campaign.id);
  }
}

export async function processPendingCampaigns(): Promise<CampaignProcessingResult> {
  const now = new Date();
  let dispatched = 0;
  let skipped = 0;

  const pendingCampaigns = await db
    .select()
    .from(campaigns)
    .where(
      or(
        inArray(campaigns.status, ['QUEUED', 'PENDING', 'SENDING']),
        and(eq(campaigns.status, 'SCHEDULED'), lte(campaigns.scheduledAt, now)),
        and(eq(campaigns.status, 'SCHEDULED'), isNull(campaigns.scheduledAt))
      )
    );

  if (pendingCampaigns.length === 0) {
    return {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      timestamp: getBrasiliaTime(),
    };
  }

  const activeCampaigns = getActiveCampaigns();
  console.log(
    `[CampaignProcessor] Encontradas ${pendingCampaigns.length} campanhas pendentes. Conexões ativas: ${activeCampaigns.size}`
  );

  for (const campaign of pendingCampaigns) {
    const connectionId = campaign.connectionId || campaign.companyId;
    
    // Verificar se já existe campanha ativa para esta conexão
    if (activeCampaigns.has(connectionId)) {
      console.log(
        `[CampaignProcessor] Conexão ${connectionId} ocupada com campanha ${activeCampaigns.get(connectionId)}. Campanha ${campaign.id} (${campaign.name}) aguardando.`
      );
      skipped++;
      continue;
    }

    // Para campanhas em SENDING, verificar se estão órfãs
    if (campaign.status === 'SENDING') {
      const isOrphaned = await isOrphanedSendingCampaign(campaign);
      if (!isOrphaned) {
        console.log(
          `[CampaignProcessor] Campanha ${campaign.id} processando ativamente. Pulando.`
        );
        skipped++;
        continue;
      }
      console.log(
        `[CampaignProcessor] 🔄 Retomando campanha órfã ${campaign.id} (${campaign.name}) - sem atividade por 5+ minutos.`
      );
    } else {
      // Adquirir lock via CAS (Compare-And-Swap)
      const updateResult = await db
        .update(campaigns)
        .set({ status: 'SENDING', sentAt: now })
        .where(
          and(
            eq(campaigns.id, campaign.id),
            or(
              inArray(campaigns.status, ['QUEUED', 'PENDING']),
              and(eq(campaigns.status, 'SCHEDULED'), lte(campaigns.scheduledAt, now)),
              and(eq(campaigns.status, 'SCHEDULED'), isNull(campaigns.scheduledAt))
            )
          )
        )
        .returning({ id: campaigns.id });

      if (!updateResult || updateResult.length === 0) {
        console.log(
          `[CampaignProcessor] Campanha ${campaign.id} já sendo processada (CAS falhou). Pulando.`
        );
        skipped++;
        continue;
      }

      console.log(
        `[CampaignProcessor] 🔒 Lock adquirido para campanha ${campaign.id} (${campaign.name}).`
      );
    }

    // Marcar conexão como ocupada
    if (!markCampaignActive(connectionId, campaign.id)) {
      skipped++;
      continue;
    }

    // DISPARA CAMPANHA DE FORMA ASSÍNCRONA (fire-and-forget)
    // Cada campanha roda em seu próprio "thread" sem bloquear as outras
    executeCampaignAsync(campaign).catch(err => {
      console.error(`[CampaignProcessor] Erro não capturado na campanha ${campaign.id}:`, err);
      markCampaignComplete(connectionId, campaign.id);
    });
    
    dispatched++;
    console.log(
      `[CampaignProcessor] 🚀 Campanha ${campaign.id} (${campaign.name}) disparada em paralelo. Empresa: ${campaign.companyId}`
    );
  }

  console.log(
    `[CampaignProcessor] Ciclo concluído: ${dispatched} disparadas, ${skipped} aguardando`
  );

  return {
    processed: pendingCampaigns.length,
    successful: dispatched,
    failed: 0,
    skipped,
    timestamp: getBrasiliaTime(),
  };
}
