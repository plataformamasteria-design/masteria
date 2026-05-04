import { Queue } from 'bullmq';
import { createRedisConnection } from '../lib/redis-connection';

export interface DeadletterJob {
  id: string;
  eventId: string;
  reason: string;
  attempts: number;
  lastError?: string;
  createdAt: number;
  failedAt: number;
}

export class WebhookDeadletterService {
  private deadletterQueue: Queue<DeadletterJob> | null = null;
  private static instance: WebhookDeadletterService;

  private constructor() {
    this.initialize();
  }

  static getInstance(): WebhookDeadletterService {
    if (!WebhookDeadletterService.instance) {
      WebhookDeadletterService.instance = new WebhookDeadletterService();
    }
    return WebhookDeadletterService.instance;
  }

  private async initialize() {
    try {
      const connection = createRedisConnection();
      this.deadletterQueue = new Queue<DeadletterJob>('webhook-deadletter', { connection });
      console.log('✅ [WebhookDeadletter] Queue initialized');
    } catch (error) {
      console.error('❌ [WebhookDeadletter] Failed to initialize:', error);
    }
  }

  async addToDeadletter(
    eventId: string,
    reason: string,
    attempts: number,
    lastError?: string
  ): Promise<void> {
    if (!this.deadletterQueue) {
      console.warn('⚠️ [WebhookDeadletter] Queue not initialized');
      return;
    }

    const job: DeadletterJob = {
      id: `${eventId}-${Date.now()}`,
      eventId,
      reason,
      attempts,
      lastError,
      createdAt: Date.now(),
      failedAt: Date.now(),
    };

    try {
      await this.deadletterQueue.add('webhook-deadletter', job, {
        removeOnComplete: { age: 86400 },
        removeOnFail: false,
        priority: 10,
      });
      console.log(`✅ [WebhookDeadletter] Job added for event: ${eventId}`);
    } catch (error) {
      console.error('❌ [WebhookDeadletter] Failed to add job:', error);
    }
  }

  async getDeadletterCount(): Promise<number> {
    if (!this.deadletterQueue) return 0;
    return await this.deadletterQueue.count();
  }

  async getDeadletterJobs(limit = 100): Promise<DeadletterJob[]> {
    if (!this.deadletterQueue) return [];
    const jobs = await this.deadletterQueue.getJobs(['failed'], 0, limit);
    return jobs.map(j => j.data);
  }
}

export const deadletterService = WebhookDeadletterService.getInstance();
