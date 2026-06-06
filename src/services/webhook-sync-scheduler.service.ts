import { Queue, Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis-connection';
import { conn } from '@/lib/db';
import { getBaseUrl } from '@/utils/get-base-url';

interface SyncJobData {
  companyId: string;
  webhookSettingId: string;
  daysBack: number;
  limit: number;
}

class WebhookSyncScheduler {
  private queue: Queue<SyncJobData> | null = null;
  private worker: Worker<SyncJobData> | null = null;
  private static instance: WebhookSyncScheduler;

  private constructor() { }

  static getInstance(): WebhookSyncScheduler {
    if (!WebhookSyncScheduler.instance) {
      WebhookSyncScheduler.instance = new WebhookSyncScheduler();
    }
    return WebhookSyncScheduler.instance;
  }

  async initialize(): Promise<void> {
    try {
      if (this.queue) return; // Already initialized

      console.log('🔄 [SYNC-SCHEDULER] Attempting to initialize with Redis...');
      const connection = createRedisConnection();

      if (!connection) {
        throw new Error('Could not create Redis connection');
      }

      // Create queue requires distinct connection
      this.queue = new Queue('webhook-sync', {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      });

      // Create worker REQUIRES SEPARATE connection
      console.log('🔄 [SYNC-SCHEDULER] Spawning distinct Redis connection for Worker...');
      const workerConnection = createRedisConnection();

      this.worker = new Worker('webhook-sync', this.syncJobHandler.bind(this), {
        connection: workerConnection,
        concurrency: 2,
      });

      // Event listeners
      this.worker.on('completed', (job) => {
        console.log(`✅ [SYNC-SCHEDULER] Job concluído: ${job.id}`);
      });

      this.worker.on('failed', (job, err) => {
        console.error(`❌ [SYNC-SCHEDULER] Job falhou: ${job?.id}`, err);
      });

      // Add error handler to connections
      connection.on('error', (err) => {
        console.error('❌ [SYNC-SCHEDULER] Queue Redis connection error:', err.message);
      });
      if (workerConnection) {
        workerConnection.on('error', (err) => {
          console.error('❌ [SYNC-SCHEDULER] Worker Redis connection error:', err.message);
        });
      }

      // Schedule recurring sync every 6 hours
      await this.scheduleRecurringSyncs();

      console.log('🔧 [SYNC-SCHEDULER] Inicializado com sucesso');
    } catch (error) {
      console.error('[SYNC-SCHEDULER] Erro na inicialização:', error);
    }
  }

  private async scheduleRecurringSyncs(): Promise<void> {
    try {
      // Get all companies with webhook configs
      const companies = await conn`
        SELECT DISTINCT c.id 
        FROM companies c
        JOIN incoming_webhook_configs iw ON c.id = iw.company_id
        WHERE iw.source = 'grapfy' AND iw.is_active = true
      `;

      for (const company of companies as any) {
        // Add recurring job (every 6 hours)
        await this.queue?.add(
          'sync',
          {
            companyId: company.id,
            webhookSettingId: '', // Será preenchido no handler
            daysBack: 1, // Sincronizar apenas último dia
            limit: 100,
          },
          {
            repeat: {
              pattern: '0 */6 * * *', // Every 6 hours
            },
            jobId: `sync-${company.id}`,
          }
        );

        console.log(`📅 [SYNC-SCHEDULER] Job recorrente agendado: ${company.id}`);
      }
    } catch (error) {
      console.error('[SYNC-SCHEDULER] Erro ao agendar syncs:', error);
    }
  }

  private async syncJobHandler(job: any): Promise<void> {
    const { companyId, daysBack, limit } = job.data as SyncJobData;

    console.log(`🔄 [SYNC-SCHEDULER] Iniciando sync para: ${companyId}`);

    try {
      // Call the sync endpoint
      const baseUrl = getBaseUrl();
      const response = await fetch(
        `${baseUrl}/api/v1/webhooks/sync`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            daysBack: daysBack || 1,
            limit: limit || 100,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        console.log(
          `✅ [SYNC-SCHEDULER] Sincronização concluída: ${result.summary?.synced || 0} eventos`
        );
      } else {
        throw new Error(result.message || 'Sync failed');
      }
    } catch (error) {
      console.error(`❌ [SYNC-SCHEDULER] Erro no sync:`, error);
      throw error;
    }
  }

  async triggerManualSync(companyId: string, daysBack: number = 30): Promise<string> {
    try {
      const job = await this.queue?.add('sync', {
        companyId,
        webhookSettingId: '',
        daysBack,
        limit: 100,
      });

      console.log(`📤 [SYNC-SCHEDULER] Job manual enviado: ${job?.id}`);
      return job?.id || '';
    } catch (error) {
      console.error('[SYNC-SCHEDULER] Erro ao enviar job manual:', error);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.queue?.getJob(jobId);
      const progress = job?.progress;
      return {
        id: jobId,
        state: await job?.getState(),
        progress: typeof progress === 'number' ? progress : 0,
        data: job?.data,
      };
    } catch (error) {
      console.error('[SYNC-SCHEDULER] Erro ao obter status:', error);
      return null;
    }
  }

  async shutdown(): Promise<void> {
    try {
      await this.worker?.close();
      await this.queue?.close();
      console.log('✅ [SYNC-SCHEDULER] Encerrado com sucesso');
    } catch (error) {
      console.error('[SYNC-SCHEDULER] Erro ao encerrar:', error);
    }
  }
}

export const webhookSyncScheduler = WebhookSyncScheduler.getInstance();
