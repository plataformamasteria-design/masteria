import { db } from '@/lib/db';
import { voiceRetryQueue, voiceAgents, contacts, voiceDeliveryReports, voiceCalls, campaigns } from '@/lib/db/schema';
import { eq, lte, and } from 'drizzle-orm';
import { retellService } from '@/lib/retell-service';

const VOICE_MAX_CONCURRENT = 20;

// CADÊNCIA 81-210s: Delay recomendado entre chamadas de voz (Obrigações Imutáveis)
const VOICE_CALL_MIN_DELAY_SECONDS = 81;
const VOICE_CALL_MAX_DELAY_SECONDS = 210;

// Helper para gerar delay aleatório
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

interface RetryResult {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
}

export async function processVoiceRetryQueue(): Promise<RetryResult> {
  const now = new Date();
  let successful = 0;
  let failed = 0;
  let skipped = 0;

  console.log(`[Voice Retry Worker] Iniciando processamento de fila em ${now.toISOString()}`);

  const availableSlots = await retellService.getAvailableSlots(VOICE_MAX_CONCURRENT);
  
  if (availableSlots === 0) {
    console.log('[Voice Retry Worker] Nenhum slot disponível no Retell. Aguardando próximo ciclo.');
    return { processed: 0, successful: 0, failed: 0, skipped: 0 };
  }

  const pendingRetries = await db
    .select()
    .from(voiceRetryQueue)
    .where(
      and(
        eq(voiceRetryQueue.status, 'pending'),
        lte(voiceRetryQueue.scheduledAt, now)
      )
    )
    .limit(availableSlots)
    .orderBy(voiceRetryQueue.scheduledAt);

  if (pendingRetries.length === 0) {
    console.log('[Voice Retry Worker] Nenhuma rediscagem pendente encontrada.');
    return { processed: 0, successful: 0, failed: 0, skipped: 0 };
  }

  console.log(`[Voice Retry Worker] Encontradas ${pendingRetries.length} rediscagens pendentes (${availableSlots} slots disponíveis)`);

  const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!twilioFromNumber) {
    console.error('[Voice Retry Worker] TWILIO_PHONE_NUMBER não configurado');
    return { processed: 0, successful: 0, failed: 0, skipped: pendingRetries.length };
  }

  for (const retry of pendingRetries) {
    try {
      await db
        .update(voiceRetryQueue)
        .set({ status: 'processing' })
        .where(eq(voiceRetryQueue.id, retry.id));

      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, retry.campaignId))
        .limit(1);

      if (!campaign || campaign.status === 'PAUSED' || campaign.status === 'CANCELLED') {
        console.log(`[Voice Retry Worker] Campanha ${retry.campaignId} não ativa. Pulando retry.`);
        await db
          .update(voiceRetryQueue)
          .set({ status: 'cancelled', processedAt: new Date() })
          .where(eq(voiceRetryQueue.id, retry.id));
        skipped++;
        continue;
      }

      const [agent] = await db
        .select()
        .from(voiceAgents)
        .where(eq(voiceAgents.id, retry.voiceAgentId))
        .limit(1);

      if (!agent || !agent.retellAgentId) {
        console.error(`[Voice Retry Worker] Agente ${retry.voiceAgentId} não encontrado ou sem retellAgentId`);
        await db
          .update(voiceRetryQueue)
          .set({ status: 'failed', processedAt: new Date() })
          .where(eq(voiceRetryQueue.id, retry.id));
        failed++;
        continue;
      }

      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, retry.contactId))
        .limit(1);

      if (!contact) {
        console.error(`[Voice Retry Worker] Contato ${retry.contactId} não encontrado`);
        await db
          .update(voiceRetryQueue)
          .set({ status: 'failed', processedAt: new Date() })
          .where(eq(voiceRetryQueue.id, retry.id));
        failed++;
        continue;
      }

      let toNumber = contact.phone.replace(/\D/g, '');
      if (!toNumber.startsWith('+')) {
        if (!toNumber.startsWith('55')) {
          toNumber = `+55${toNumber}`;
        } else {
          toNumber = `+${toNumber}`;
        }
      }

      console.log(`[Voice Retry Worker] Iniciando chamada para ${contact.phone} | Tentativa ${retry.attemptNumber}`);

      // APLICAR CADÊNCIA: 81-210s entre chamadas de voz
      const callDelaySeconds = randomBetween(VOICE_CALL_MIN_DELAY_SECONDS, VOICE_CALL_MAX_DELAY_SECONDS);
      console.log(`[Voice Retry Worker] ⏱️ Aplicando cadência: aguardando ${callDelaySeconds}s antes de discar...`);
      await sleep(callDelaySeconds * 1000);

      const retellCall = await retellService.createPhoneCallWithVoicemailDetection({
        from_number: twilioFromNumber,
        to_number: toNumber,
        override_agent_id: agent.retellAgentId,
        metadata: {
          contact_id: contact.id,
          company_id: retry.companyId,
          attempt_number: String(retry.attemptNumber),
          retry_queue_id: retry.id,
        },
      });

      await db.insert(voiceCalls).values({
        companyId: retry.companyId,
        agentId: agent.id,
        contactId: contact.id,
        retellCallId: retellCall.call_id,
        direction: 'outbound',
        fromNumber: twilioFromNumber,
        toNumber,
        customerName: contact.name || undefined,
        status: retellCall.call_status || 'initiated',
        provider: 'retell',
        metadata: { attemptNumber: retry.attemptNumber, isRetry: true },
      });

      await db.insert(voiceDeliveryReports).values({
        campaignId: retry.campaignId,
        contactId: retry.contactId,
        voiceAgentId: retry.voiceAgentId,
        providerCallId: retellCall.call_id,
        status: 'INITIATED',
        callOutcome: 'pending',
        attemptNumber: retry.attemptNumber,
      });

      await db
        .update(voiceRetryQueue)
        .set({ status: 'completed', processedAt: new Date() })
        .where(eq(voiceRetryQueue.id, retry.id));

      console.log(`[Voice Retry Worker] ✅ Chamada ${retellCall.call_id} iniciada para ${contact.phone} (tentativa ${retry.attemptNumber})`);
      successful++;

    } catch (error) {
      console.error(`[Voice Retry Worker] ❌ Erro ao processar retry ${retry.id}:`, error);
      await db
        .update(voiceRetryQueue)
        .set({ status: 'failed', processedAt: new Date() })
        .where(eq(voiceRetryQueue.id, retry.id));
      failed++;
    }
  }

  console.log(`[Voice Retry Worker] ✅ Processamento concluído: ${successful} sucesso, ${failed} falhas, ${skipped} pulados`);

  return {
    processed: pendingRetries.length,
    successful,
    failed,
    skipped,
  };
}

export async function getRetryQueueStats(companyId?: string): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const baseQuery = companyId 
    ? and(eq(voiceRetryQueue.companyId, companyId))
    : undefined;

  const [pending] = await db
    .select({ count: db.$count(voiceRetryQueue) })
    .from(voiceRetryQueue)
    .where(baseQuery ? and(baseQuery, eq(voiceRetryQueue.status, 'pending')) : eq(voiceRetryQueue.status, 'pending'));

  const [processing] = await db
    .select({ count: db.$count(voiceRetryQueue) })
    .from(voiceRetryQueue)
    .where(baseQuery ? and(baseQuery, eq(voiceRetryQueue.status, 'processing')) : eq(voiceRetryQueue.status, 'processing'));

  const [completed] = await db
    .select({ count: db.$count(voiceRetryQueue) })
    .from(voiceRetryQueue)
    .where(baseQuery ? and(baseQuery, eq(voiceRetryQueue.status, 'completed')) : eq(voiceRetryQueue.status, 'completed'));

  const [failedResult] = await db
    .select({ count: db.$count(voiceRetryQueue) })
    .from(voiceRetryQueue)
    .where(baseQuery ? and(baseQuery, eq(voiceRetryQueue.status, 'failed')) : eq(voiceRetryQueue.status, 'failed'));

  return {
    pending: pending?.count || 0,
    processing: processing?.count || 0,
    completed: completed?.count || 0,
    failed: failedResult?.count || 0,
  };
}

export async function cancelPendingRetries(campaignId: string): Promise<number> {
  const result = await db
    .update(voiceRetryQueue)
    .set({ status: 'cancelled', processedAt: new Date() })
    .where(
      and(
        eq(voiceRetryQueue.campaignId, campaignId),
        eq(voiceRetryQueue.status, 'pending')
      )
    )
    .returning({ id: voiceRetryQueue.id });

  console.log(`[Voice Retry] Canceladas ${result.length} rediscagens pendentes para campanha ${campaignId}`);
  return result.length;
}
