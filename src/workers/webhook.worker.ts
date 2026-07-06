import { Worker, Job } from 'bullmq';
import { logger } from '@/lib/logger';
import { createRedisConnection } from '../lib/redis-connection';
import { WEBHOOK_QUEUE_NAME } from '../lib/queue/webhook-queue';
import { processIncomingMessageTrigger } from '../lib/automation-engine';

let webhookWorker: Worker | null = null;

export async function initializeWebhookWorker(): Promise<boolean> {
  // @ts-ignore
  if (global.__webhookWorkerInitialized) {
    logger.info('[WebhookWorker] Já inicializado (hot-reload).');
    return true;
  }

  try {
    const connection = createRedisConnection();
    if (!connection) {
      logger.warn('⚠️ [WebhookWorker] Redis ausente. Worker NÃO será iniciado.');
      return false;
    }

    webhookWorker = new Worker(
      WEBHOOK_QUEUE_NAME,
      async (job: Job) => {
        if (job.name === 'process-incoming-message') {
          const { conversationId, messageId } = job.data;
          logger.info(`[WebhookWorker] ⏳ Iniciando processamento da msg ${messageId}`);
          
          try {
            await processIncomingMessageTrigger(conversationId, messageId);
            logger.info(`[WebhookWorker] ✅ Sucesso msg ${messageId}`);
          } catch (err) {
            logger.error(`[WebhookWorker] ❌ Erro ao processar msg ${messageId}:`, err);
            throw err; // Lança para o BullMQ fazer o retry
          }
        }
      },
      {
        connection: connection as any,
        concurrency: 5, // Processa até 5 webhooks simultaneamente
      }
    );

    webhookWorker.on('failed', (job, err) => {
      logger.error(`[WebhookWorker] Job falhou ${job?.id}: ${err.message}`);
    });

    // @ts-ignore
    global.__webhookWorkerInitialized = true;
    logger.info('[WebhookWorker] ✅ Worker inicializado com sucesso.');
    return true;
  } catch (error) {
    logger.error('[WebhookWorker] ❌ Falha ao inicializar:', error);
    return false;
  }
}

export async function shutdownWebhookWorker(): Promise<void> {
  if (webhookWorker) {
    await webhookWorker.close();
    webhookWorker = null;
    // @ts-ignore
    global.__webhookWorkerInitialized = false;
    logger.info('[WebhookWorker] 🛑 Worker encerrado.');
  }
}
