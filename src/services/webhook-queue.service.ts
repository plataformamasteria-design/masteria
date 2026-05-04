import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import crypto from 'crypto';
import { WebhookPayload } from './webhook-dispatcher.service';
import { createRedisConnection } from '../lib/redis-connection';

interface WebhookJobData {
  webhookId: string;
  url: string;
  secret: string;
  payload: WebhookPayload;
  subscriptionName: string;
  retryCount?: number;
  attempts?: number;
  createdAt?: number;
  processAt?: number;
}

interface JobResult {
  status: number;
  body: string;
  timestamp: string;
}

interface InMemoryJob {
  id: string;
  data: WebhookJobData;
  attempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  processAt: number;
  lastError?: string;
}

// ✅ FIX: Use globalThis for better HMR compatibility in Next.js
const globalForWebhookQueue = globalThis as unknown as {
  __webhookQueueShutdownHandlerRegistered: boolean | undefined;
  __webhookQueueInstance: WebhookQueueService | undefined;
};

/**
 * Hybrid webhook queue implementation with BullMQ (when Redis available) or in-memory fallback
 */
export class WebhookQueueService {
  private queue: Queue<WebhookJobData> | null = null;
  private worker: Worker<WebhookJobData, JobResult> | null = null;
  private queueEvents: QueueEvents | null = null;
  private readonly queueName = 'webhook-queue';
  private readonly CONCURRENCY = 2;
  private readonly MAX_RETRIES = 3;
  private isShuttingDown = false;
  private metricsInterval: NodeJS.Timeout | null = null;
  private useBullMQ = false;
  private hasLoggedFallbackWarning = false;

  // In-memory fallback when Redis not available
  private inMemoryJobs: Map<string, InMemoryJob> = new Map();
  private inMemoryProcessing = new Set<string>();
  private inMemoryInterval: NodeJS.Timeout | null = null;
  private inMemoryMetrics = {
    processed: 0,
    failed: 0,
    retried: 0,
    completed: 0,
    active: 0,
    waiting: 0,
  };

  private isInitialized = false;

  constructor() {
    // Prevent re-initialization if singleton already exists
    if (globalForWebhookQueue.__webhookQueueInstance) {
      // ✅ FIX: Return existing instance instead of creating new one
      return globalForWebhookQueue.__webhookQueueInstance as any;
    }

    // Increase max listeners to prevent warning with multiple event handlers
    process.setMaxListeners(20);

    // Check if BullMQ should be enabled and Redis is available
    const enableBullMQ = process.env.ENABLE_BULLMQ_QUEUE === 'true' &&
      process.env.NEXT_PHASE !== 'phase-production-build' &&
      process.env.BUILD_PHASE !== 'true';

    if (enableBullMQ) {
      try {
        console.log('🔄 [WebhookQueue] Attempting to initialize BullMQ with Redis connection...');
        // Try to initialize BullMQ with Redis
        const connection = createRedisConnection();

        if (!connection) {
          throw new Error('Could not create Redis connection - connection object is null');
        }

        // Test the connection with a simple ping
        connection.ping().then(() => {
          this.initializeBullMQ(connection);
          this.useBullMQ = true;
          console.log('✅ [WebhookQueue] BullMQ service initialized with Redis-backed queue');
        }).catch((error: any) => {
          // Redis connection failed
          const errorMessage = error instanceof Error ? error.message : String(error);

          if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
            console.error('❌ [WebhookQueue] FATAL: Redis connection failed in production:', errorMessage);
            console.error('❌ [WebhookQueue] Falling back to in-memory queue strictly for uptime, but this will lose jobs!');
          }

          if (!this.hasLoggedFallbackWarning) {
            console.warn('⚠️ [WebhookQueue] Redis unavailable, falling back to in-memory queue');
            this.hasLoggedFallbackWarning = true;
          }
          this.initializeInMemoryQueue();
        });
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ [WebhookQueue] Error during Redis initialization:', errorMessage);
        this.initializeInMemoryQueue();
      }
    }
    else {
      // BullMQ disabled, use in-memory queue
      if (!this.hasLoggedFallbackWarning) {
        console.log('📋 [WebhookQueue] BullMQ disabled, using in-memory queue');
        console.log('📋 [WebhookQueue] To enable BullMQ, set ENABLE_BULLMQ_QUEUE=true and configure Redis');
        this.hasLoggedFallbackWarning = true;
      }
      this.initializeInMemoryQueue();
    }

    // Setup graceful shutdown
    this.setupGracefulShutdown();

    this.isInitialized = true;
  }

  /**
   * Initialize BullMQ with Redis
   */
  private initializeBullMQ(connection: any) {
    // ✅ FIX: Add error handler to Redis connection to prevent uncaught exceptions
    connection.on('error', (err: Error) => {
      console.error('❌ [WebhookQueue] Redis connection error:', err.message);
      // Don't re-throw - just log and let BullMQ handle reconnection
    });

    this.queue = new Queue<WebhookJobData>(this.queueName, {
      connection,
      defaultJobOptions: {
        attempts: this.MAX_RETRIES,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: {
          age: 86400,
          count: 500,
        },
      },
    });

    // Initialize QueueEvents for monitoring - REQUIRES SEPARATE connection
    // BullMQ prohibits sharing connections that use blocking commands
    console.log('🔄 [WebhookQueue] Spawning distinct Redis connection for QueueEvents...');
    const eventsConnection = createRedisConnection();

    this.queueEvents = new QueueEvents(this.queueName, {
      connection: eventsConnection,
    });

    // Start the worker - REQUIRES SEPARATE connection
    console.log('🔄 [WebhookQueue] Spawning distinct Redis connection for Worker...');
    const workerConnection = createRedisConnection();
    this.startBullMQWorker(workerConnection);

    // Start metrics reporting
    this.startMetricsReporter();
  }

  /**
   * Initialize in-memory queue fallback
   */
  private initializeInMemoryQueue() {
    this.useBullMQ = false;

    // Start processing interval for in-memory queue
    this.inMemoryInterval = setInterval(() => {
      this.processInMemoryQueue();
    }, 1000); // Process queue every second

    // Allow Node to exit if this is the only timer
    if (this.inMemoryInterval?.unref) {
      this.inMemoryInterval.unref();
    }

    // Start metrics reporting for in-memory queue
    this.startMetricsReporter();
  }

  /**
   * Start the BullMQ Worker to process jobs
   */
  private startBullMQWorker(connection: any) {
    if (!this.queue) return;

    this.worker = new Worker<WebhookJobData, JobResult>(
      this.queueName,
      async (job: Job<WebhookJobData>) => {
        return await this.processBullMQJob(job);
      },
      {
        connection, // Distinct connection passed from initializeBullMQ
        concurrency: this.CONCURRENCY,
        autorun: true,
        lockDuration: 30000,
        stalledInterval: 30000,
        maxStalledCount: 2,
      }
    );

    // Worker event handlers
    this.worker.on('completed', (job) => {
      console.log(
        `✅ [WebhookQueue] Job ${job.id} completed successfully for ${job.data.subscriptionName}`
      );
    });

    this.worker.on('failed', (job, err) => {
      console.error(
        `❌ [WebhookQueue] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
        err.message
      );
    });

    this.worker.on('active', (job) => {
      console.log(
        `🔄 [WebhookQueue] Processing job ${job.id} (attempt ${job.attemptsMade}/${this.MAX_RETRIES})`
      );
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`⚠️ [WebhookQueue] Job ${jobId} has stalled and will be retried`);
    });

    this.worker.on('error', (err) => {
      console.error('❌ [WebhookQueue] Worker error:', err);
    });

    console.log(`✅ [WebhookQueue] BullMQ Worker started with concurrency: ${this.CONCURRENCY}`);
  }

  /**
   * Process a BullMQ webhook job
   */
  private async processBullMQJob(job: Job<WebhookJobData>): Promise<JobResult> {
    const startTime = Date.now();
    const { data } = job;

    try {
      await job.updateProgress(10);

      console.log(
        `🔄 [WebhookQueue] Processing webhook ${job.id} for ${data.subscriptionName} (${data.payload.eventType})`
      );

      const result = await this.sendWebhook(data);

      await job.updateProgress(100);

      // Update database status to delivered
      if (data.webhookId) {
        const { webhookDispatcher } = await import('./webhook-dispatcher.service');
        await webhookDispatcher.updateWebhookStatus(
          data.webhookId,
          'delivered',
          result,
          null
        );
      }

      const processingTime = Date.now() - startTime;
      console.log(
        `✅ [WebhookQueue] Successfully sent webhook ${job.id} to ${data.url} (${processingTime}ms)`
      );

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await job.log(`Failed to send webhook: ${errorMessage}`);

      // If this is the last attempt, update database status to failed
      if (job.attemptsMade >= this.MAX_RETRIES - 1) {
        if (data.webhookId) {
          const { webhookDispatcher } = await import('./webhook-dispatcher.service');
          await webhookDispatcher.updateWebhookStatus(
            data.webhookId,
            'failed',
            {
              error: errorMessage,
              attempt: job.attemptsMade + 1,
            },
            null
          );
        }

        console.error(
          `❌ [WebhookQueue] Job ${job.id} failed permanently after ${job.attemptsMade + 1} attempts (${processingTime}ms)`
        );
      } else {
        // Update status to retrying
        if (data.webhookId) {
          const { webhookDispatcher } = await import('./webhook-dispatcher.service');
          const nextRetryTime = new Date(Date.now() + this.getRetryDelay(job.attemptsMade + 1));
          await webhookDispatcher.updateWebhookStatus(
            data.webhookId,
            'retrying',
            {
              error: errorMessage,
              attempt: job.attemptsMade + 1,
            },
            nextRetryTime
          );
        }

        console.log(
          `⚠️ [WebhookQueue] Job ${job.id} failed (attempt ${job.attemptsMade + 1}), will retry (${processingTime}ms)`
        );
      }

      throw error;
    }
  }

  /**
   * Process in-memory queue
   */
  private async processInMemoryQueue() {
    const now = Date.now();
    const pendingJobs = Array.from(this.inMemoryJobs.values())
      .filter(job =>
        job.status === 'pending' &&
        job.processAt <= now &&
        !this.inMemoryProcessing.has(job.id)
      )
      .slice(0, this.CONCURRENCY - this.inMemoryProcessing.size);

    for (const job of pendingJobs) {
      if (this.inMemoryProcessing.size >= this.CONCURRENCY) break;

      this.inMemoryProcessing.add(job.id);
      this.inMemoryMetrics.active++;
      this.inMemoryMetrics.waiting--;

      // Process job asynchronously
      this.processInMemoryJob(job).catch(error => {
        console.error(`Error processing in-memory job ${job.id}:`, error);
      });
    }
  }

  /**
   * Process a single in-memory job
   */
  private async processInMemoryJob(job: InMemoryJob): Promise<void> {
    const startTime = Date.now();

    try {
      job.status = 'processing';
      job.attempts++;

      console.log(
        `🔄 [InMemoryQueue] Processing webhook ${job.id} for ${job.data.subscriptionName} (attempt ${job.attempts}/${this.MAX_RETRIES})`
      );

      const result = await this.sendWebhook(job.data);

      // Update database status to delivered
      if (job.data.webhookId) {
        const { webhookDispatcher } = await import('./webhook-dispatcher.service');
        await webhookDispatcher.updateWebhookStatus(
          job.data.webhookId,
          'delivered',
          result,
          null
        );
      }

      // Mark as completed
      job.status = 'completed';
      this.inMemoryMetrics.completed++;
      this.inMemoryMetrics.processed++;
      this.inMemoryMetrics.active--;

      const processingTime = Date.now() - startTime;
      console.log(
        `✅ [InMemoryQueue] Successfully sent webhook ${job.id} to ${job.data.url} (${processingTime}ms)`
      );

      // Remove from jobs map after success
      this.inMemoryJobs.delete(job.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      job.lastError = errorMessage;
      this.inMemoryMetrics.active--;

      if (job.attempts >= this.MAX_RETRIES) {
        // Failed permanently
        job.status = 'failed';
        this.inMemoryMetrics.failed++;

        if (job.data.webhookId) {
          const { webhookDispatcher } = await import('./webhook-dispatcher.service');
          await webhookDispatcher.updateWebhookStatus(
            job.data.webhookId,
            'failed',
            {
              error: errorMessage,
              attempt: job.attempts,
            },
            null
          );
        }

        console.error(
          `❌ [InMemoryQueue] Job ${job.id} failed permanently after ${job.attempts} attempts`
        );

        // Remove from jobs map after permanent failure
        this.inMemoryJobs.delete(job.id);
      } else {
        // Retry with backoff
        job.status = 'pending';
        job.processAt = Date.now() + this.getRetryDelay(job.attempts);
        this.inMemoryMetrics.retried++;
        this.inMemoryMetrics.waiting++;

        if (job.data.webhookId) {
          const { webhookDispatcher } = await import('./webhook-dispatcher.service');
          await webhookDispatcher.updateWebhookStatus(
            job.data.webhookId,
            'retrying',
            {
              error: errorMessage,
              attempt: job.attempts,
            },
            new Date(job.processAt)
          );
        }

        console.log(
          `⚠️ [InMemoryQueue] Job ${job.id} failed (attempt ${job.attempts}), will retry in ${(job.processAt - Date.now()) / 1000}s`
        );
      }
    } finally {
      this.inMemoryProcessing.delete(job.id);
    }
  }

  /**
   * Add a webhook to the queue (works for both BullMQ and in-memory)
   */
  async addWebhook(data: WebhookJobData): Promise<{ id: string }> {
    if (this.useBullMQ && this.queue) {
      // Use BullMQ
      try {
        const job = await this.queue.add(
          `webhook-${data.subscriptionName}-${data.payload.eventType}`,
          data,
          {
            priority: data.payload.eventType === 'message_received' ? 1 : 0,
            delay: data.processAt ? data.processAt - Date.now() : 0,
          }
        );

        console.log(
          `📋 [WebhookQueue] Queued webhook job ${job.id} for ${data.subscriptionName} (${data.payload.eventType})`
        );

        return { id: job.id || `webhook-${Date.now()}` };
      } catch (error) {
        console.error('[WebhookQueue] Error adding webhook to BullMQ:', error);
        throw error;
      }
    } else {
      // Use in-memory queue
      const jobId = `inmem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const job: InMemoryJob = {
        id: jobId,
        data,
        attempts: 0,
        status: 'pending',
        createdAt: Date.now(),
        processAt: data.processAt || Date.now(),
      };

      this.inMemoryJobs.set(jobId, job);
      this.inMemoryMetrics.waiting++;

      console.log(
        `📋 [InMemoryQueue] Queued webhook job ${jobId} for ${data.subscriptionName} (${data.payload.eventType})`
      );

      return { id: jobId };
    }
  }

  /**
   * Send webhook HTTP request
   */
  private async sendWebhook(data: WebhookJobData): Promise<JobResult> {
    const { url, secret, payload } = data;
    const payloadString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': payload.eventType,
          'X-Webhook-Timestamp': payload.timestamp,
          'X-Webhook-Retry-Count': String(data.retryCount || 0),
        },
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${responseText.slice(0, 500)}`
        );
      }

      return {
        status: response.status,
        body: responseText.slice(0, 1000),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Webhook request timeout after 10 seconds');
        }
        throw error;
      }

      throw new Error('Unknown error sending webhook');
    }
  }

  /**
   * Get retry delay with exponential backoff
   */
  private getRetryDelay(attemptNumber: number): number {
    const baseDelay = 2000; // 2 seconds
    const maxDelay = 64000; // 64 seconds max
    const delay = Math.min(baseDelay * Math.pow(2, attemptNumber), maxDelay);
    return delay;
  }

  /**
   * Get queue metrics (works for both BullMQ and in-memory)
   */
  async getQueueMetrics() {
    if (this.useBullMQ && this.queue) {
      // BullMQ metrics
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          this.queue.getWaitingCount(),
          this.queue.getActiveCount(),
          this.queue.getCompletedCount(),
          this.queue.getFailedCount(),
          this.queue.getDelayedCount(),
        ]);

        const metrics = {
          waiting,
          active,
          completed,
          failed,
          delayed,
          paused: 0,
          total: waiting + active + delayed,
        };

        return metrics;
      } catch (error) {
        console.error('[WebhookQueue] Error getting BullMQ metrics:', error);
        return {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: 0,
          total: 0,
        };
      }
    } else {
      // In-memory metrics
      return {
        waiting: this.inMemoryMetrics.waiting,
        active: this.inMemoryMetrics.active,
        completed: this.inMemoryMetrics.completed,
        failed: this.inMemoryMetrics.failed,
        delayed: 0,
        paused: 0,
        total: this.inMemoryMetrics.waiting + this.inMemoryMetrics.active,
      };
    }
  }

  /**
   * Start metrics reporting
   */
  private startMetricsReporter() {
    // Report metrics every minute
    this.metricsInterval = setInterval(async () => {
      await this.reportMetrics();
    }, 60000);

    // Also report immediately after 5 seconds
    setTimeout(() => this.reportMetrics(), 5000);

    // Allow Node to exit if this is the only timer
    if (this.metricsInterval?.unref) {
      this.metricsInterval.unref();
    }
  }

  /**
   * Report queue metrics
   */
  private async reportMetrics() {
    try {
      const metrics = await this.getQueueMetrics();
      const queueType = this.useBullMQ ? 'BullMQ' : 'InMemory';

      console.log(`📊 [WebhookQueue] ${queueType} Metrics Report:`);
      console.log(`  - Waiting: ${metrics.waiting}`);
      console.log(`  - Active: ${metrics.active}`);
      console.log(`  - Delayed: ${metrics.delayed}`);
      console.log(`  - Completed: ${metrics.completed}`);
      console.log(`  - Failed: ${metrics.failed}`);
      console.log(`  - Total in Queue: ${metrics.total}`);

      if (this.useBullMQ && this.queue) {
        // Additional job counts from BullMQ
        try {
          const jobCounts = await this.queue.getJobCounts();
          if (jobCounts) {
            console.log('📊 [WebhookQueue] Job Counts:');
            Object.entries(jobCounts).forEach(([status, count]) => {
              console.log(`  - ${status}: ${count}`);
            });
          }
        } catch (error) {
          // Ignore errors getting job counts
        }
      }
    } catch (error) {
      console.error('[WebhookQueue] Error reporting metrics:', error);
    }
  }

  /**
   * Pause the queue (BullMQ only)
   */
  async pauseQueue(): Promise<void> {
    if (this.queue) {
      await this.queue.pause();
      console.log('⏸️ [WebhookQueue] Queue paused');
    } else {
      console.log('⏸️ [WebhookQueue] In-memory queue does not support pausing');
    }
  }

  /**
   * Resume the queue (BullMQ only)
   */
  async resumeQueue(): Promise<void> {
    if (this.queue) {
      await this.queue.resume();
      console.log('▶️ [WebhookQueue] Queue resumed');
    } else {
      console.log('▶️ [WebhookQueue] In-memory queue does not support resuming');
    }
  }

  /**
   * Retry failed jobs from dead letter queue (BullMQ only)
   */
  async retryDeadLetterJobs(limit: number = 10): Promise<number> {
    if (!this.queue) {
      console.log('[WebhookQueue] Dead letter retry not supported in in-memory mode');
      return 0;
    }

    try {
      const failedJobs = await this.queue.getFailed(0, limit);
      let retriedCount = 0;

      for (const job of failedJobs) {
        await job.retry();
        retriedCount++;
      }

      console.log(`🔄 [WebhookQueue] Retried ${retriedCount} failed jobs`);
      return retriedCount;
    } catch (error) {
      console.error('[WebhookQueue] Error retrying failed jobs:', error);
      return 0;
    }
  }

  /**
   * Clean completed and failed jobs (BullMQ only)
   */
  async cleanOldJobs(grace: number = 3600000): Promise<void> {
    if (!this.queue) {
      // For in-memory, just clear old completed/failed jobs
      const cutoff = Date.now() - grace;
      let removed = 0;

      for (const [id, job] of this.inMemoryJobs.entries()) {
        if ((job.status === 'completed' || job.status === 'failed') && job.createdAt < cutoff) {
          this.inMemoryJobs.delete(id);
          removed++;
        }
      }

      if (removed > 0) {
        console.log(`🧹 [InMemoryQueue] Removed ${removed} old jobs`);
      }
      return;
    }

    try {
      const completedRemoved = await this.queue.clean(grace, 1000, 'completed');
      console.log(`🧹 [WebhookQueue] Removed ${completedRemoved.length} old completed jobs`);

      const failedRemoved = await this.queue.clean(7 * 24 * 3600000, 1000, 'failed');
      console.log(`🧹 [WebhookQueue] Removed ${failedRemoved.length} old failed jobs`);
    } catch (error) {
      console.error('[WebhookQueue] Error cleaning old jobs:', error);
    }
  }

  /**
   * Setup graceful shutdown - prevent duplicate listeners on hot-reload
   */
  private setupGracefulShutdown() {
    // Check if handlers are already registered to prevent MaxListenersExceededWarning
    if (globalForWebhookQueue.__webhookQueueShutdownHandlerRegistered) {
      // ✅ FIX: Don't log on reuse to reduce noise
      return;
    }

    const shutdownHandler = async (signal?: string) => {
      if (this.isShuttingDown) {
        console.log(`🔧 [WebhookQueue] Shutdown already in progress, ignoring ${signal || 'signal'}`);
        return;
      }
      this.isShuttingDown = true;

      console.log(`🛑 [WebhookQueue] Initiating graceful shutdown... (signal: ${signal || 'unknown'})`);

      try {
        // Clear intervals
        if (this.metricsInterval) {
          clearInterval(this.metricsInterval);
        }

        if (this.inMemoryInterval) {
          clearInterval(this.inMemoryInterval);
        }

        if (this.useBullMQ) {
          // Stop accepting new jobs
          if (this.queue) {
            await this.queue.pause();
          }

          // Close worker
          if (this.worker) {
            await this.worker.close();
          }

          // Close queue events
          if (this.queueEvents) {
            await this.queueEvents.close();
          }

          // Close queue
          if (this.queue) {
            await this.queue.close();
          }
        } else {
          // Wait for in-memory processing to complete
          const maxWait = 5000; // 5 seconds max
          const startTime = Date.now();

          while (this.inMemoryProcessing.size > 0 && Date.now() - startTime < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          if (this.inMemoryProcessing.size > 0) {
            console.warn(`⚠️ [WebhookQueue] ${this.inMemoryProcessing.size} jobs still processing after shutdown timeout`);
          }
        }

        console.log('✅ [WebhookQueue] Graceful shutdown complete');
      } catch (error) {
        console.error('❌ [WebhookQueue] Error during shutdown:', error);
      }
    };

    // Handle different shutdown signals - use once() to prevent duplicate handlers
    process.once('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.once('SIGINT', () => shutdownHandler('SIGINT'));
    globalForWebhookQueue.__webhookQueueShutdownHandlerRegistered = true;
    console.log('🔧 [WebhookQueue] Registered shutdown handlers (SIGINT, SIGTERM)');
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<{ isPaused: boolean; isReady: boolean }> {
    if (this.useBullMQ && this.queue && this.worker) {
      try {
        const isPaused = await this.queue.isPaused();
        const isReady = await this.worker.isRunning();

        return {
          isPaused,
          isReady,
        };
      } catch (error) {
        console.error('[WebhookQueue] Error getting queue status:', error);
        return {
          isPaused: false,
          isReady: false,
        };
      }
    } else {
      // In-memory queue is always ready and never paused
      return {
        isPaused: false,
        isReady: !this.isShuttingDown,
      };
    }
  }
}

// Create or reuse singleton instance to prevent multiple instances on hot-reload
let webhookQueue: WebhookQueueService;

if (!globalForWebhookQueue.__webhookQueueInstance) {
  console.log('🔧 [WebhookQueue] Creating new WebhookQueueService singleton instance');
  webhookQueue = new WebhookQueueService();
  globalForWebhookQueue.__webhookQueueInstance = webhookQueue;
} else {
  // ✅ FIX: Don't log on reuse to reduce noise
  webhookQueue = globalForWebhookQueue.__webhookQueueInstance;
}

export { webhookQueue };