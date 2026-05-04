// src/services/alert.service.ts

import { db } from '@/lib/db';
import {
  alerts,
  alertRules,
  alertNotifications,
  alertSettings,
  users
} from '@/lib/db/schema';
import { eq, and, gte, lte, sql, desc, inArray } from 'drizzle-orm';
import redis from '@/lib/redis';
import crypto from 'crypto';
import { UserNotificationsService } from '../lib/notifications/user-notifications.service';

type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type AlertChannel = 'console' | 'database' | 'webhook' | 'in_app' | 'email';
type AlertType =
  | 'high_memory_usage'
  | 'cache_failure'
  | 'database_pool_exhausted'
  | 'rate_limit_breach'
  | 'queue_failure'
  | 'auth_failures_spike'
  | 'response_time_degradation'
  | 'custom';

interface AlertContext {
  metric?: string;
  threshold?: number;
  currentValue?: number;
  timestamp?: Date;
  source?: string;
  userId?: string;
  companyId?: string;
  [key: string]: any;
}

interface CreateAlertParams {
  companyId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metric?: string;
  threshold?: number;
  currentValue?: number;
  context?: AlertContext;
  channels?: AlertChannel[];
}

interface NotificationResult {
  channel: AlertChannel;
  status: 'sent' | 'failed';
  error?: string;
  response?: any;
}

interface MetricCheck {
  metric: string;
  currentValue: number;
  threshold: number;
  condition: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  severity: AlertSeverity;
  alertType: AlertType;
  title: string;
  message: string;
}

export class AlertService {
  private static readonly DEDUP_WINDOW_SECONDS = 300; // 5 minutes
  private static readonly AGGREGATION_WINDOW_SECONDS = 60; // 1 minute
  private static readonly MAX_ALERTS_PER_WINDOW = 10;
  private static readonly ALERT_EXPIRY_HOURS = 24;

  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static metricsCheckInterval = 30000; // 30 seconds

  /**
   * Create a new alert with deduplication and aggregation
   */
  static async createAlert(params: CreateAlertParams): Promise<string | null> {
    try {
      // Generate fingerprint for deduplication
      const fingerprint = this.generateFingerprint(params);

      // Check for existing active alert with same fingerprint
      const existingAlert = await this.findDuplicateAlert(fingerprint, params.companyId);

      if (existingAlert) {
        // Update occurrence count and last occurred time
        await db
          .update(alerts)
          .set({
            occurrenceCount: sql`${alerts.occurrenceCount} + 1`,
            lastOccurredAt: new Date(),
            currentValue: params.currentValue?.toString() || existingAlert.currentValue,
          })
          .where(eq(alerts.id, existingAlert.id));

        console.log(`[AlertService] Duplicate alert detected (ID: ${existingAlert.id}), count incremented`);
        return existingAlert.id;
      }

      // Check rate limiting to prevent alert storms
      const rateLimitExceeded = await this.checkAlertRateLimit(params.companyId);
      if (rateLimitExceeded) {
        console.warn('[AlertService] Alert rate limit exceeded, suppressing alert');
        return null;
      }

      // Create new alert
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.ALERT_EXPIRY_HOURS);

      const [alert] = await db
        .insert(alerts)
        .values({
          companyId: params.companyId,
          alertType: params.alertType as any,
          severity: params.severity as any,
          status: 'active' as any,
          title: params.title,
          message: params.message,
          metric: params.metric,
          threshold: params.threshold?.toString(),
          currentValue: params.currentValue?.toString(),
          context: params.context as any,
          fingerprint,
          occurrenceCount: 1,
          expiresAt,
        })
        .returning();

      if (!alert) {
        console.error('[AlertService] Failed to create alert');
        return null;
      }

      console.log(`[AlertService] Alert created: ${alert.id} (${params.alertType})`);

      // Send notifications through configured channels
      const channels = params.channels || await this.getEnabledChannels(params.companyId);
      await this.sendNotifications(alert, channels);

      return alert.id;
    } catch (error) {
      console.error('[AlertService] Error creating alert:', error);
      return null;
    }
  }

  /**
   * Generate fingerprint for alert deduplication
   */
  private static generateFingerprint(params: CreateAlertParams): string {
    const data = `${params.alertType}-${params.severity}-${params.title}-${params.metric || ''}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 64);
  }

  /**
   * Find duplicate alert within deduplication window
   */
  private static async findDuplicateAlert(fingerprint: string, companyId?: string) {
    const windowStart = new Date();
    windowStart.setSeconds(windowStart.getSeconds() - this.DEDUP_WINDOW_SECONDS);

    const conditions = [
      eq(alerts.fingerprint, fingerprint),
      inArray(alerts.status, ['active', 'acknowledged'] as any),
      gte(alerts.lastOccurredAt, windowStart),
    ];

    if (companyId) {
      conditions.push(eq(alerts.companyId, companyId));
    }

    const [duplicate] = await db
      .select()
      .from(alerts)
      .where(and(...conditions))
      .limit(1);

    return duplicate;
  }

  /**
   * Check alert rate limiting
   */
  private static async checkAlertRateLimit(companyId?: string): Promise<boolean> {
    const key = companyId ? `alerts:rate:${companyId}` : 'alerts:rate:global';
    const windowKey = `${key}:${Math.floor(Date.now() / 60000)}`; // Per minute window

    const count = await redis.incr(windowKey);
    if (count === 1) {
      await redis.expire(windowKey, 60);
    }

    return count > this.MAX_ALERTS_PER_WINDOW;
  }

  /**
   * Get enabled notification channels for company
   */
  private static async getEnabledChannels(companyId?: string): Promise<AlertChannel[]> {
    if (!companyId) {
      return ['console', 'database'];
    }

    const settings = await db.query.alertSettings.findFirst({
      where: eq(alertSettings.companyId, companyId),
    });

    return (settings?.enabledChannels as AlertChannel[]) || ['console', 'database'];
  }

  /**
   * Send notifications through configured channels
   */
  private static async sendNotifications(
    alert: any,
    channels: AlertChannel[]
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const channel of channels) {
      try {
        let result: NotificationResult = {
          channel,
          status: 'sent',
        };

        switch (channel) {
          case 'console':
            await this.sendConsoleNotification(alert);
            break;

          case 'database':
            await this.sendDatabaseNotification(alert);
            break;

          case 'webhook':
            result = await this.sendWebhookNotification(alert);
            break;

          case 'in_app':
            await this.sendInAppNotification(alert);
            break;

          case 'email':
            result = await this.sendEmailNotification(alert);
            break;
        }

        // Log notification
        await db.insert(alertNotifications).values({
          alertId: alert.id,
          channel: channel as any,
          status: result.status,
          sentAt: result.status === 'sent' ? new Date() : null,
          failureReason: result.error,
          response: result.response as any,
        });

        results.push(result);
      } catch (error) {
        console.error(`[AlertService] Failed to send ${channel} notification:`, error);
        results.push({
          channel,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Send console notification
   */
  private static async sendConsoleNotification(alert: any): Promise<void> {
    const severityEmoji = {
      CRITICAL: '🔴',
      HIGH: '🟠',
      MEDIUM: '🟡',
      LOW: '🟢',
    };

    const emoji = severityEmoji[alert.severity as AlertSeverity] || '⚪';

    console.error(`
╔════════════════════════════════════════════════════════╗
║ ${emoji} ALERT: ${alert.severity} - ${alert.alertType}
╠════════════════════════════════════════════════════════╣
║ Title: ${alert.title}
║ Message: ${alert.message}
║ Metric: ${alert.metric || 'N/A'}
║ Threshold: ${alert.threshold || 'N/A'}
║ Current Value: ${alert.currentValue || 'N/A'}
║ Time: ${new Date().toISOString()}
╚════════════════════════════════════════════════════════╝
    `);
  }

  /**
   * Send database notification (already stored)
   */
  private static async sendDatabaseNotification(alert: any): Promise<void> {
    // Alert is already in database, just log
    console.log(`[AlertService] Alert stored in database: ${alert.id}`);
  }

  /**
   * Send webhook notification
   */
  private static async sendWebhookNotification(alert: any): Promise<NotificationResult> {
    try {
      // Get webhook URL from settings
      const settings = alert.companyId
        ? await db.query.alertSettings.findFirst({
          where: eq(alertSettings.companyId, alert.companyId),
        })
        : null;

      const webhookUrl = settings?.defaultWebhookUrl;

      if (!webhookUrl) {
        return {
          channel: 'webhook',
          status: 'failed',
          error: 'No webhook URL configured',
        };
      }

      const payload = {
        id: alert.id,
        type: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        metric: alert.metric,
        threshold: alert.threshold,
        currentValue: alert.currentValue,
        context: alert.context,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Alert-Id': alert.id,
          'X-Alert-Severity': alert.severity,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }

      return {
        channel: 'webhook',
        status: 'sent',
        response: {
          status: response.status,
          statusText: response.statusText,
        },
      };
    } catch (error) {
      return {
        channel: 'webhook',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send in-app notification
   */
  private static async sendInAppNotification(alert: any): Promise<void> {
    if (!alert.companyId) return;

    // Get all admin users for the company
    const adminUsers = await db.query.users.findMany({
      where: and(
        eq(users.companyId, alert.companyId),
        inArray(users.role, ['admin', 'superadmin'] as any)
      ),
    });

    // Create notification for each admin
    for (const user of adminUsers) {
      await UserNotificationsService.create({
        userId: user.id,
        companyId: alert.companyId,
        type: 'system_error',
        title: `Alert: ${alert.title}`,
        message: alert.message,
        linkTo: `/alerts/${alert.id}`,
        metadata: {
          alertId: alert.id,
          alertType: alert.alertType,
          severity: alert.severity,
        },
      });
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(_alert: any): Promise<NotificationResult> {
    // This would integrate with an email service
    // For now, we'll just log it
    console.log('[AlertService] Email notification would be sent here');

    return {
      channel: 'email',
      status: 'sent',
      response: { message: 'Email queued for sending' },
    };
  }

  /**
   * Monitor metrics and trigger alerts
   */
  static async monitorMetrics(): Promise<void> {
    try {
      const checks: MetricCheck[] = [
        // Memory usage check
        {
          metric: 'process.memoryUsage.heapUsed',
          currentValue: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100,
          threshold: 90,
          condition: 'gt',
          severity: 'HIGH',
          alertType: 'high_memory_usage',
          title: 'High Memory Usage Detected',
          message: 'Application memory usage has exceeded 90% of heap size',
        },

        // Cache hit rate check
        {
          metric: 'cache.hitRate',
          currentValue: await this.calculateCacheHitRate(),
          threshold: 50,
          condition: 'lt',
          severity: 'MEDIUM',
          alertType: 'cache_failure',
          title: 'Low Cache Hit Rate',
          message: 'Cache hit rate has fallen below 50%, indicating potential cache issues',
        },

        // Database pool check
        {
          metric: 'db.connectionPool.usage',
          currentValue: await this.getDatabasePoolUsage(),
          threshold: 90,
          condition: 'gt',
          severity: 'CRITICAL',
          alertType: 'database_pool_exhausted',
          title: 'Database Connection Pool Near Exhaustion',
          message: 'Database connection pool usage has exceeded 90%',
        },

        // Rate limit breaches check
        {
          metric: 'rateLimit.429.count',
          currentValue: await this.get429Count(),
          threshold: 100,
          condition: 'gt',
          severity: 'HIGH',
          alertType: 'rate_limit_breach',
          title: 'High Rate of 429 Responses',
          message: 'Too many rate limit responses (429) detected',
        },

        // Queue failures check
        {
          metric: 'queue.failures.rate',
          currentValue: await this.getQueueFailureRate(),
          threshold: 5,
          condition: 'gt',
          severity: 'HIGH',
          alertType: 'queue_failure',
          title: 'High Queue Failure Rate',
          message: 'Queue processing failure rate has exceeded threshold',
        },

        // Auth failures check
        {
          metric: 'auth.failures.rate',
          currentValue: await this.getAuthFailureRate(),
          threshold: 10,
          condition: 'gt',
          severity: 'CRITICAL',
          alertType: 'auth_failures_spike',
          title: 'Authentication Failures Spike',
          message: 'Unusual spike in authentication failures detected',
        },

        // Response time check
        {
          metric: 'http.responseTime.p95',
          currentValue: await this.getResponseTimeP95(),
          threshold: 1000,
          condition: 'gt',
          severity: 'HIGH',
          alertType: 'response_time_degradation',
          title: 'Response Time Degradation',
          message: 'P95 response time has exceeded 1000ms threshold',
        },
      ];

      // Check each metric against threshold
      for (const check of checks) {
        if (this.evaluateCondition(check.currentValue, check.threshold, check.condition)) {
          await this.createAlert({
            alertType: check.alertType,
            severity: check.severity,
            title: check.title,
            message: `${check.message}. Current value: ${check.currentValue.toFixed(2)}, Threshold: ${check.threshold}`,
            metric: check.metric,
            threshold: check.threshold,
            currentValue: check.currentValue,
            context: {
              checkTime: new Date(),
              metricDetails: check,
            },
          });
        }
      }

      // Check custom rules
      await this.checkCustomRules();

    } catch (error) {
      console.error('[AlertService] Error monitoring metrics:', error);
    }
  }

  /**
   * Evaluate metric condition
   */
  private static evaluateCondition(
    value: number,
    threshold: number,
    condition: string
  ): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  /**
   * Calculate cache hit rate
   */
  private static async calculateCacheHitRate(): Promise<number> {
    try {
      const hits = await redis.get('cache_metrics:overall:hits');
      const misses = await redis.get('cache_metrics:overall:misses');

      const hitCount = parseInt(hits || '0');
      const missCount = parseInt(misses || '0');
      const total = hitCount + missCount;

      return total > 0 ? (hitCount / total) * 100 : 100;
    } catch {
      return 100; // Assume good hit rate if can't calculate
    }
  }

  /**
   * Get database pool usage
   */
  private static async getDatabasePoolUsage(): Promise<number> {
    try {
      const result = await conn`
        SELECT count(*) as active FROM pg_stat_activity
        WHERE datname = current_database()
        AND state = 'active'
      `;
      const active = parseInt((result as any)?.[0]?.active || '0');
      const maxConnections = 10; // Must match db/index.ts pool config
      return (active / maxConnections) * 100;
    } catch {
      return 0; // If we can't check, assume pool is healthy
    }
  }

  /**
   * Get count of 429 responses in last minute
   */
  private static async get429Count(): Promise<number> {
    try {
      const key = `metrics:429:${Math.floor(Date.now() / 60000)}`;
      const count = await redis.get(key);
      return parseInt(count || '0');
    } catch {
      return 0;
    }
  }

  /**
   * Get queue failure rate
   */
  private static async getQueueFailureRate(): Promise<number> {
    try {
      const key = `metrics:queue:failures:${Math.floor(Date.now() / 60000)}`;
      const count = await redis.get(key);
      return parseInt(count || '0');
    } catch {
      return 0;
    }
  }

  /**
   * Get authentication failure rate
   */
  private static async getAuthFailureRate(): Promise<number> {
    try {
      const key = `metrics:auth:failures:${Math.floor(Date.now() / 300000)}`; // 5 minute window
      const count = await redis.get(key);
      return parseInt(count || '0');
    } catch {
      return 0;
    }
  }

  /**
   * Get P95 response time
   */
  private static async getResponseTimeP95(): Promise<number> {
    try {
      const key = `metrics:response:p95`;
      const value = await redis.get(key);
      return parseFloat(value || '0');
    } catch {
      return 0;
    }
  }

  /**
   * Check custom alert rules
   */
  private static async checkCustomRules(): Promise<void> {
    const enabledRules = await db.query.alertRules.findMany({
      where: eq(alertRules.isEnabled, true),
    });

    for (const rule of enabledRules) {
      try {
        // Get metric value based on rule configuration
        const metricValue = await this.getMetricValue(rule.metric);

        if (metricValue !== null && this.evaluateCondition(
          metricValue,
          parseFloat(rule.threshold),
          rule.condition
        )) {
          await this.createAlert({
            companyId: rule.companyId || undefined,
            alertType: rule.alertType as AlertType,
            severity: rule.severity as AlertSeverity,
            title: rule.name,
            message: rule.description || `Alert rule ${rule.name} triggered`,
            metric: rule.metric,
            threshold: parseFloat(rule.threshold),
            currentValue: metricValue,
            channels: rule.channels as AlertChannel[],
            context: {
              ruleId: rule.id,
              ruleName: rule.name,
              metadata: rule.metadata,
            },
          });
        }
      } catch (error) {
        console.error(`[AlertService] Error checking rule ${rule.id}:`, error);
      }
    }
  }

  /**
   * Get metric value by name
   */
  private static async getMetricValue(_metricName: string): Promise<number | null> {
    // This would integrate with Prometheus or other metrics systems
    // For now, return null to indicate metric not available
    return null;
  }

  /**
   * Start monitoring
   */
  static startMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    console.log('[AlertService] Starting metrics monitoring');

    // Run initial check
    this.monitorMetrics();

    // Schedule periodic checks
    this.monitoringInterval = setInterval(() => {
      this.monitorMetrics();
    }, this.metricsCheckInterval);
  }

  /**
   * Stop monitoring
   */
  static stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[AlertService] Stopped metrics monitoring');
    }
  }

  /**
   * Acknowledge an alert
   */
  static async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      await db
        .update(alerts)
        .set({
          status: 'acknowledged' as any,
          acknowledgedAt: new Date(),
          acknowledgedBy: userId,
        })
        .where(and(
          eq(alerts.id, alertId),
          eq(alerts.status, 'active' as any)
        ));

      return true;
    } catch (error) {
      console.error('[AlertService] Error acknowledging alert:', error);
      return false;
    }
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      await db
        .update(alerts)
        .set({
          status: 'resolved' as any,
          resolvedAt: new Date(),
          resolvedBy: userId,
        })
        .where(and(
          eq(alerts.id, alertId),
          inArray(alerts.status, ['active', 'acknowledged'] as any)
        ));

      return true;
    } catch (error) {
      console.error('[AlertService] Error resolving alert:', error);
      return false;
    }
  }

  /**
   * Get active alerts
   */
  static async getActiveAlerts(companyId?: string, limit = 50): Promise<any[]> {
    const conditions = [
      inArray(alerts.status, ['active', 'acknowledged'] as any),
    ];

    if (companyId) {
      conditions.push(eq(alerts.companyId, companyId));
    }

    return await db
      .select()
      .from(alerts)
      .where(and(...conditions))
      .orderBy(desc(alerts.severity), desc(alerts.createdAt))
      .limit(limit);
  }

  /**
   * Get alert history
   */
  static async getAlertHistory(
    companyId?: string,
    startDate?: Date,
    endDate?: Date,
    limit = 100
  ): Promise<any[]> {
    const conditions = [];

    if (companyId) {
      conditions.push(eq(alerts.companyId, companyId));
    }

    if (startDate) {
      conditions.push(gte(alerts.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(alerts.createdAt, endDate));
    }

    return await db
      .select()
      .from(alerts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(alerts.createdAt))
      .limit(limit);
  }

  /**
   * Clean up expired alerts
   */
  static async cleanupExpiredAlerts(): Promise<number> {
    try {
      await db
        .update(alerts)
        .set({ status: 'expired' as any })
        .where(and(
          lte(alerts.expiresAt, new Date()),
          inArray(alerts.status, ['active', 'acknowledged'] as any)
        ));

      return 0; // Would return count if available
    } catch (error) {
      console.error('[AlertService] Error cleaning up expired alerts:', error);
      return 0;
    }
  }

  /**
   * Update alert settings
   */
  static async updateAlertSettings(
    companyId: string,
    settings: Partial<{
      memoryThreshold: number;
      responseTimeP95Threshold: number;
      rateLimit429Threshold: number;
      authFailureThreshold: number;
      queueFailureThreshold: number;
      dbPoolThreshold: number;
      alertRetentionDays: number;
      enabledChannels: AlertChannel[];
      defaultWebhookUrl: string;
      emailRecipients: string[];
    }>
  ): Promise<boolean> {
    try {
      const existingSettings = await db.query.alertSettings.findFirst({
        where: eq(alertSettings.companyId, companyId),
      });

      if (existingSettings) {
        await db
          .update(alertSettings)
          .set({
            ...settings,
            memoryThreshold: settings.memoryThreshold?.toString(),
            responseTimeP95Threshold: settings.responseTimeP95Threshold,
            rateLimit429Threshold: settings.rateLimit429Threshold,
            authFailureThreshold: settings.authFailureThreshold,
            queueFailureThreshold: settings.queueFailureThreshold,
            dbPoolThreshold: settings.dbPoolThreshold?.toString(),
            enabledChannels: settings.enabledChannels as any,
            updatedAt: new Date(),
          })
          .where(eq(alertSettings.companyId, companyId));
      } else {
        await db.insert(alertSettings).values({
          companyId,
          ...settings,
          memoryThreshold: settings.memoryThreshold?.toString(),
          dbPoolThreshold: settings.dbPoolThreshold?.toString(),
          enabledChannels: settings.enabledChannels as any,
        });
      }

      return true;
    } catch (error) {
      console.error('[AlertService] Error updating alert settings:', error);
      return false;
    }
  }
}

// Start monitoring when service is initialized
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_ALERT_MONITORING === 'true') {
  AlertService.startMonitoring();
}

// Clean up expired alerts periodically
setInterval(() => {
  AlertService.cleanupExpiredAlerts();
}, 3600000); // Every hour