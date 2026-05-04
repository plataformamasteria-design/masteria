import { conn } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export interface ReplayOptions {
  eventId: string;
  companyId: string;
  modifiedPayload?: Record<string, any>;
  triggerAutomations?: boolean;
}

export interface ReplayResult {
  success: boolean;
  replayEventId?: string;
  originalEventId: string;
  error?: string;
}

export interface ReplayAuditEntry {
  id: string;
  originalEventId: string;
  replayEventId: string;
  replayedBy: string;
  replayedAt: Date;
  reason?: string;
}

export class WebhookReplayService {
  private static instance: WebhookReplayService;
  private replayHistory: Map<string, ReplayAuditEntry[]> = new Map();

  private constructor() {}

  static getInstance(): WebhookReplayService {
    if (!WebhookReplayService.instance) {
      WebhookReplayService.instance = new WebhookReplayService();
    }
    return WebhookReplayService.instance;
  }

  async replayEvent(options: ReplayOptions): Promise<ReplayResult> {
    const { eventId, companyId, modifiedPayload, triggerAutomations = true } = options;

    try {
      const eventResult = await conn`
        SELECT * FROM incoming_webhook_events
        WHERE id = ${eventId} AND company_id = ${companyId}
        LIMIT 1
      `;

      if (!eventResult || (eventResult as any).length === 0) {
        return {
          success: false,
          originalEventId: eventId,
          error: 'Event not found',
        };
      }

      const originalEvent = (eventResult as any)[0];

      const isAlreadyReplayed = await this.checkDuplicateReplay(eventId, companyId);
      if (isAlreadyReplayed) {
        console.warn(`⚠️ [REPLAY] Event ${eventId} was already replayed recently`);
      }

      const replayId = uuidv4();
      const replayPayload = modifiedPayload || originalEvent.payload;

      await conn`
        INSERT INTO incoming_webhook_events 
        (id, company_id, source, event_type, payload, headers, ip_address, signature_valid, processed_at, created_at)
        VALUES (
          ${replayId},
          ${companyId},
          ${originalEvent.source},
          ${originalEvent.event_type},
          ${JSON.stringify({
            ...replayPayload,
            _replay: {
              originalEventId: eventId,
              replayedAt: new Date().toISOString(),
              isReplay: true,
              triggerAutomations,
            },
          })},
          ${JSON.stringify({ ...originalEvent.headers, 'x-replay-of': eventId })},
          ${originalEvent.ip_address},
          ${true},
          ${triggerAutomations ? null : new Date()},
          ${new Date()}
        )
      `;

      this.addToAuditTrail(eventId, replayId, 'system');

      console.log(`✅ [REPLAY] Event ${eventId} successfully replayed as ${replayId}`);

      return {
        success: true,
        replayEventId: replayId,
        originalEventId: eventId,
      };
    } catch (error) {
      console.error('❌ [REPLAY] Failed to replay event:', error);
      return {
        success: false,
        originalEventId: eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkDuplicateReplay(eventId: string, companyId: string): Promise<boolean> {
    const result = await conn`
      SELECT COUNT(*) as count FROM incoming_webhook_events
      WHERE company_id = ${companyId}
        AND payload::text LIKE ${'%"originalEventId":"' + eventId + '"%'}
        AND created_at > NOW() - INTERVAL '1 hour'
    `;

    const count = parseInt((result as any)?.[0]?.count || '0');
    return count > 0;
  }

  private addToAuditTrail(originalEventId: string, replayEventId: string, replayedBy: string, reason?: string) {
    const entry: ReplayAuditEntry = {
      id: uuidv4(),
      originalEventId,
      replayEventId,
      replayedBy,
      replayedAt: new Date(),
      reason,
    };

    const history = this.replayHistory.get(originalEventId) || [];
    history.push(entry);
    this.replayHistory.set(originalEventId, history);

    if (this.replayHistory.size > 1000) {
      const oldestKey = this.replayHistory.keys().next().value;
      if (oldestKey) this.replayHistory.delete(oldestKey);
    }
  }

  getReplayHistory(eventId: string): ReplayAuditEntry[] {
    return this.replayHistory.get(eventId) || [];
  }

  async batchReplay(eventIds: string[], companyId: string): Promise<ReplayResult[]> {
    const results: ReplayResult[] = [];

    for (const eventId of eventIds) {
      const result = await this.replayEvent({ eventId, companyId });
      results.push(result);

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }
}

export const replayService = WebhookReplayService.getInstance();
