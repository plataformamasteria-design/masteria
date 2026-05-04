import { db } from '@/lib/db';
import { webhookSubscriptions, webhookEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { webhookQueue } from './webhook-queue.service';

export type WebhookEventType =
  | 'conversation_created'
  | 'conversation_updated'
  | 'message_received'
  | 'message_sent'
  | 'lead_created'
  | 'lead_stage_changed'
  | 'sale_closed'
  | 'meeting_scheduled'
  | 'campaign_sent'
  | 'campaign_completed';

export interface WebhookPayload {
  eventType: WebhookEventType;
  timestamp: string;
  data: Record<string, any>;
  companyId: string;
}

export class WebhookDispatcherService {
  constructor() {
    console.log('✅ [WebhookDispatcher] Service initialized with BullMQ queue');
  }

  /**
   * Dispatch webhook events to all active subscriptions using BullMQ queue
   */
  async dispatch(companyId: string, eventType: WebhookEventType, data: Record<string, any>) {
    const startTime = Date.now();
    
    // Fetch active webhook subscriptions
    const subscriptions = await db.query.webhookSubscriptions.findMany({
      where: and(
        eq(webhookSubscriptions.companyId, companyId), 
        eq(webhookSubscriptions.active, true)
      ),
    });

    const relevantSubscriptions = subscriptions.filter((sub) => sub.events.includes(eventType));

    if (relevantSubscriptions.length === 0) {
      console.log(`[WebhookDispatcher] No active subscriptions for event ${eventType} in company ${companyId}`);
      return;
    }

    const payload: WebhookPayload = {
      eventType,
      timestamp: new Date().toISOString(),
      data,
      companyId,
    };

    let queuedCount = 0;
    let failedCount = 0;

    // Queue webhooks for each subscription using BullMQ
    for (const subscription of relevantSubscriptions) {
      try {
        // Create webhook event record for tracking
        const [webhookEvent] = await db.insert(webhookEvents).values({
          subscriptionId: subscription.id,
          eventType,
          payload: payload as any,
          status: 'pending',
          attempts: 0,
          nextRetryAt: new Date(),
        }).returning();

        // Verify webhook event was created
        if (!webhookEvent) {
          throw new Error('Failed to create webhook event record');
        }

        // Add to BullMQ queue for asynchronous processing
        await webhookQueue.addWebhook({
          webhookId: webhookEvent.id,
          url: subscription.url,
          secret: subscription.secret,
          payload,
          subscriptionName: subscription.name,
        });

        queuedCount++;
        console.log(
          `✅ [WebhookDispatcher] Queued webhook event ${eventType} for subscription ${subscription.name} (ID: ${webhookEvent.id})`
        );
      } catch (error) {
        failedCount++;
        console.error(`❌ [WebhookDispatcher] Error queuing webhook event for ${subscription.name}:`, error);
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(
      `📊 [WebhookDispatcher] Dispatch completed: ${queuedCount} queued, ${failedCount} failed (${processingTime}ms)`
    );
  }

  /**
   * Get current queue statistics
   */
  async getQueueStats() {
    try {
      const metrics = await webhookQueue.getQueueMetrics();
      return {
        ...metrics,
        healthy: true,
      };
    } catch (error) {
      console.error('[WebhookDispatcher] Error getting queue stats:', error);
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Pause webhook processing
   */
  async pauseProcessing() {
    try {
      await webhookQueue.pauseQueue();
      console.log('⏸️ [WebhookDispatcher] Webhook processing paused');
      return true;
    } catch (error) {
      console.error('[WebhookDispatcher] Error pausing queue:', error);
      return false;
    }
  }

  /**
   * Resume webhook processing
   */
  async resumeProcessing() {
    try {
      await webhookQueue.resumeQueue();
      console.log('▶️ [WebhookDispatcher] Webhook processing resumed');
      return true;
    } catch (error) {
      console.error('[WebhookDispatcher] Error resuming queue:', error);
      return false;
    }
  }

  /**
   * Retry failed webhooks from dead letter queue
   */
  async retryFailedWebhooks(limit: number = 10) {
    try {
      const retriedCount = await webhookQueue.retryDeadLetterJobs(limit);
      console.log(`🔄 [WebhookDispatcher] Retried ${retriedCount} failed webhooks`);
      return retriedCount;
    } catch (error) {
      console.error('[WebhookDispatcher] Error retrying failed webhooks:', error);
      return 0;
    }
  }

  /**
   * Update webhook event status in database
   * This is called by the queue worker after processing
   */
  async updateWebhookStatus(
    webhookId: string,
    status: 'delivered' | 'failed' | 'retrying',
    response?: any,
    nextRetryAt?: Date | null
  ) {
    try {
      const event = await db.query.webhookEvents.findFirst({
        where: eq(webhookEvents.id, webhookId),
      });

      if (!event) {
        console.warn(`[WebhookDispatcher] Webhook event ${webhookId} not found`);
        return;
      }

      await db
        .update(webhookEvents)
        .set({
          status,
          attempts: event.attempts + 1,
          lastAttemptAt: new Date(),
          response,
          nextRetryAt,
        })
        .where(eq(webhookEvents.id, webhookId));

      console.log(
        `📝 [WebhookDispatcher] Updated webhook ${webhookId} status to ${status}`
      );
    } catch (error) {
      console.error(`[WebhookDispatcher] Error updating webhook status:`, error);
    }
  }

  /**
   * Clean up old webhook events
   */
  async cleanupOldEvents(daysToKeep: number = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await db
        .delete(webhookEvents)
        .where(
          and(
            eq(webhookEvents.status, 'delivered'),
            sql`${webhookEvents.createdAt} < ${cutoffDate}`
          )
        )
        .returning();

      console.log(
        `🧹 [WebhookDispatcher] Cleaned up ${result.length} old webhook events`
      );
      
      return result.length;
    } catch (error) {
      console.error('[WebhookDispatcher] Error cleaning up old events:', error);
      return 0;
    }
  }

  /**
   * Helper method for safe webhook dispatch (backwards compatibility)
   */
  static safeDispatch(
    fn: (companyId: string, eventType: WebhookEventType, data: Record<string, any>) => Promise<void>,
    source: string,
    companyId: string,
    eventType: WebhookEventType,
    data: Record<string, any>
  ) {
    fn(companyId, eventType, data).catch((error) => {
      console.error(`[WebhookDispatcher][${source}] Error dispatching webhook:`, error);
    });
  }
}

// Import sql for the cleanup method
import { sql } from 'drizzle-orm';

export const webhookDispatcher = new WebhookDispatcherService();