import { Queue } from 'bullmq';
import { createRedisConnection } from '../redis-connection';

export const WEBHOOK_QUEUE_NAME = 'webhook-processing-queue';

// Singleton instance of the queue
let webhookQueue: Queue | null = null;

export function getWebhookQueue(): Queue {
  if (!webhookQueue) {
    const connection = createRedisConnection();
    if (!connection) {
      console.warn('⚠️ [BullMQ] Redis connection failed, Webhook Queue will use mock/offline mode');
    }
    
    webhookQueue = new Queue(WEBHOOK_QUEUE_NAME, {
      connection: connection as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false, // Keep failed jobs for inspection
      },
    });
  }
  return webhookQueue;
}

/**
 * Enqueue an incoming message trigger to be processed by the worker.
 */
export async function enqueueMessageTrigger(conversationId: string, messageId: string) {
  const queue = getWebhookQueue();
  
  // Use messageId as jobId to provide native BullMQ idempotency.
  // If the same messageId is pushed while it's already waiting, it's ignored or deduplicated.
  await queue.add(
    'process-incoming-message',
    { conversationId, messageId },
    { jobId: `msg-${messageId}` }
  );
}
