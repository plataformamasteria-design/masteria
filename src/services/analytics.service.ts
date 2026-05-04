import { db } from '@/lib/db';
import {
  conversations,
  campaigns,
  kanbanLeads,
  kanbanBoards,
  whatsappDeliveryReports,
  messages,
  notificationLogs,
  notificationAgents,
} from '@/lib/db/schema';
import { eq, and, gte, lte, sql, count } from 'drizzle-orm';
import type { KanbanStage } from '@/lib/types';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface KPIMetrics {
  totalConversations: number;
  totalMessages: number;
  totalLeads: number;
  totalSales: number;
  totalRevenue: number;
  conversionRate: number;
  avgResponseTime: number;
  totalCampaigns: number;
  campaignsSent: number;
  campaignsActive: number;
}

export interface TimeSeriesData {
  date: string;
  conversations: number;
  messages: number;
  leads: number;
  sales: number;
}

export interface FunnelData {
  stageId: string;
  stageName: string;
  count: number;
  value: number;
  conversionRate: number;
}

export interface CampaignMetrics {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  avgDeliveryTime: number;
}

export class AnalyticsService {
  async getKPIMetrics(companyId: string, dateRange: DateRange): Promise<KPIMetrics> {
    const { startDate, endDate } = dateRange;

    const conversationsData = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, companyId),
          gte(conversations.createdAt, startDate),
          lte(conversations.createdAt, endDate)
        )
      );

    const messagesData = await db
      .select({ count: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.companyId, companyId),
          gte(messages.sentAt, startDate),
          lte(messages.sentAt, endDate)
        )
      );

    const leadsData = await db
      .select({ count: count() })
      .from(kanbanLeads)
      .innerJoin(kanbanBoards, eq(kanbanLeads.boardId, kanbanBoards.id))
      .where(
        and(
          eq(kanbanBoards.companyId, companyId),
          gte(kanbanLeads.createdAt, startDate),
          lte(kanbanLeads.createdAt, endDate)
        )
      );

    const salesData = await db
      .select({
        count: count(),
        totalValue: sql<number>`COALESCE(SUM(CAST(${kanbanLeads.value} AS DECIMAL)), 0)`,
      })
      .from(kanbanLeads)
      .innerJoin(kanbanBoards, eq(kanbanLeads.boardId, kanbanBoards.id))
      .where(
        and(
          eq(kanbanBoards.companyId, companyId),
          sql`(${kanbanLeads.currentStage}->>'type')::text = 'WIN'`,
          gte(kanbanLeads.lastStageChangeAt, startDate),
          lte(kanbanLeads.lastStageChangeAt, endDate)
        )
      );

    const campaignsData = await db
      .select({
        total: count(),
        sent: sql<number>`SUM(CASE WHEN ${campaigns.status} IN ('sent', 'completed') THEN 1 ELSE 0 END)`,
        active: sql<number>`SUM(CASE WHEN ${campaigns.status} = 'active' THEN 1 ELSE 0 END)`,
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.companyId, companyId),
          gte(campaigns.createdAt, startDate),
          lte(campaigns.createdAt, endDate)
        )
      );

    const totalConversations = conversationsData[0]?.count || 0;
    const totalMessages = messagesData[0]?.count || 0;
    const totalLeads = leadsData[0]?.count || 0;
    const totalSales = salesData[0]?.count || 0;
    const totalRevenue = Number(salesData[0]?.totalValue || 0);
    const conversionRate = totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0;
    const totalCampaigns = campaignsData[0]?.total || 0;
    const campaignsSent = Number(campaignsData[0]?.sent || 0);
    const campaignsActive = Number(campaignsData[0]?.active || 0);

    const avgResponseTimeData = await db.execute(sql`
      WITH message_pairs AS (
        SELECT 
          m1.sent_at as user_msg_time,
          MIN(m2.sent_at) as bot_response_time
        FROM ${messages} m1
        INNER JOIN ${conversations} c ON m1.conversation_id = c.id
        LEFT JOIN ${messages} m2 ON m2.conversation_id = m1.conversation_id 
          AND m2.sender_type = 'system' 
          AND m2.sent_at > m1.sent_at
        WHERE c.company_id = ${companyId}
          AND m1.sender_type = 'user'
          AND m1.sent_at >= ${startDate}
          AND m1.sent_at <= ${endDate}
        GROUP BY m1.id, m1.sent_at
      )
      SELECT 
        COALESCE(AVG(EXTRACT(EPOCH FROM (bot_response_time - user_msg_time))), 0)::numeric as avg_seconds
      FROM message_pairs
      WHERE bot_response_time IS NOT NULL
    `);

    const avgResponseTimeSeconds = Number((avgResponseTimeData as any[])[0]?.avg_seconds || 0);
    const avgResponseTime = Math.round(avgResponseTimeSeconds);

    return {
      totalConversations,
      totalMessages,
      totalLeads,
      totalSales,
      totalRevenue,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgResponseTime,
      totalCampaigns,
      campaignsSent,
      campaignsActive,
    };
  }

  async getTimeSeriesData(
    companyId: string,
    dateRange: DateRange,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<TimeSeriesData[]> {
    const { startDate, endDate } = dateRange;
    const dateFormat = granularity === 'day' ? 'YYYY-MM-DD' : granularity === 'week' ? 'YYYY-"W"WW' : 'YYYY-MM';

    const conversationsTimeSeries = await db.execute(sql`
      SELECT 
        TO_CHAR(created_at, ${dateFormat}) as date,
        COUNT(*)::int as count
      FROM ${conversations}
      WHERE company_id = ${companyId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY TO_CHAR(created_at, ${dateFormat})
      ORDER BY date
    `);

    const messagesTimeSeries = await db.execute(sql`
      SELECT 
        TO_CHAR(m.sent_at, ${dateFormat}) as date,
        COUNT(*)::int as count
      FROM ${messages} m
      INNER JOIN ${conversations} c ON m.conversation_id = c.id
      WHERE c.company_id = ${companyId}
        AND m.sent_at >= ${startDate}
        AND m.sent_at <= ${endDate}
      GROUP BY TO_CHAR(m.sent_at, ${dateFormat})
      ORDER BY date
    `);

    const leadsTimeSeries = await db.execute(sql`
      SELECT 
        TO_CHAR(kl.created_at, ${dateFormat}) as date,
        COUNT(*)::int as count
      FROM ${kanbanLeads} kl
      INNER JOIN ${kanbanBoards} kb ON kl.board_id = kb.id
      WHERE kb.company_id = ${companyId}
        AND kl.created_at >= ${startDate}
        AND kl.created_at <= ${endDate}
      GROUP BY TO_CHAR(kl.created_at, ${dateFormat})
      ORDER BY date
    `);

    const salesTimeSeries = await db.execute(sql`
      SELECT 
        TO_CHAR(kl.last_stage_change_at, ${dateFormat}) as date,
        COUNT(*)::int as count
      FROM ${kanbanLeads} kl
      INNER JOIN ${kanbanBoards} kb ON kl.board_id = kb.id
      WHERE kb.company_id = ${companyId}
        AND (kl.current_stage->>'type')::text = 'WIN'
        AND kl.last_stage_change_at >= ${startDate}
        AND kl.last_stage_change_at <= ${endDate}
      GROUP BY TO_CHAR(kl.last_stage_change_at, ${dateFormat})
      ORDER BY date
    `);

    const conversationsMap = new Map(
      (conversationsTimeSeries as any[]).map((r: any) => [r.date as string, r.count])
    );
    const messagesMap = new Map((messagesTimeSeries as any[]).map((r: any) => [r.date as string, r.count]));
    const leadsMap = new Map((leadsTimeSeries as any[]).map((r: any) => [r.date as string, r.count]));
    const salesMap = new Map((salesTimeSeries as any[]).map((r: any) => [r.date as string, r.count]));

    const allDates = new Set([
      ...conversationsMap.keys(),
      ...messagesMap.keys(),
      ...leadsMap.keys(),
      ...salesMap.keys(),
    ]);

    const result: TimeSeriesData[] = Array.from(allDates)
      .sort()
      .map((date) => ({
        date,
        conversations: conversationsMap.get(date) || 0,
        messages: messagesMap.get(date) || 0,
        leads: leadsMap.get(date) || 0,
        sales: salesMap.get(date) || 0,
      }));

    return result;
  }

  async getFunnelData(companyId: string, boardId?: string): Promise<FunnelData[]> {
    const boards = await db.query.kanbanBoards.findMany({
      where: boardId
        ? and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.companyId, companyId))
        : eq(kanbanBoards.companyId, companyId),
      with: {
        leads: true,
      },
    });

    if (boards.length === 0) {
      return [];
    }

    const board = boards[0];
    const stages = (board?.stages as KanbanStage[]) || [];

    const funnelData: FunnelData[] = stages.map((stage) => {
      const stageLeads = board?.leads?.filter((lead) => lead.stageId === stage.id) || [];
      const stageValue = stageLeads.reduce((sum, lead) => sum + Number(lead.value || 0), 0);

      return {
        stageId: stage.id,
        stageName: stage.title,
        count: stageLeads.length,
        value: stageValue,
        conversionRate: 0,
      };
    });

    for (let i = 0; i < funnelData.length; i++) {
      const currentItem = funnelData[i];
      if (!currentItem) continue;
      
      if (i === 0) {
        currentItem.conversionRate = 100;
      } else {
        const previousItem = funnelData[i - 1];
        const previousCount = previousItem?.count || 0;
        currentItem.conversionRate =
          previousCount > 0 ? (currentItem.count / previousCount) * 100 : 0;
      }
      currentItem.conversionRate = Math.round(currentItem.conversionRate * 10) / 10;
    }

    return funnelData;
  }

  async getCampaignMetrics(companyId: string, dateRange: DateRange): Promise<CampaignMetrics> {
    const { startDate, endDate } = dateRange;

    const campaignsData = await db
      .select({ count: count() })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.companyId, companyId),
          gte(campaigns.createdAt, startDate),
          lte(campaigns.createdAt, endDate)
        )
      );

    const sentCampaigns = await db
      .select({ count: count() })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.companyId, companyId),
          sql`${campaigns.status} IN ('sent', 'completed')`,
          gte(campaigns.createdAt, startDate),
          lte(campaigns.createdAt, endDate)
        )
      );

    const deliveryData = await db
      .select({
        delivered: sql<number>`SUM(CASE WHEN ${whatsappDeliveryReports.status} = 'sent' THEN 1 ELSE 0 END)`,
        failed: sql<number>`SUM(CASE WHEN ${whatsappDeliveryReports.status} = 'failed' THEN 1 ELSE 0 END)`,
        total: count(),
      })
      .from(whatsappDeliveryReports)
      .innerJoin(campaigns, eq(whatsappDeliveryReports.campaignId, campaigns.id))
      .where(
        and(
          eq(campaigns.companyId, companyId),
          gte(whatsappDeliveryReports.sentAt, startDate),
          lte(whatsappDeliveryReports.sentAt, endDate)
        )
      );

    const total = campaignsData[0]?.count || 0;
    const sent = sentCampaigns[0]?.count || 0;
    const delivered = Number(deliveryData[0]?.delivered || 0);
    const failed = Number(deliveryData[0]?.failed || 0);
    const totalDeliveries = Number(deliveryData[0]?.total || 0);
    const deliveryRate = totalDeliveries > 0 ? (delivered / totalDeliveries) * 100 : 0;

    return {
      total,
      sent,
      delivered,
      failed,
      deliveryRate: Math.round(deliveryRate * 10) / 10,
      avgDeliveryTime: 0,
    };
  }

  async getNotificationMetrics(companyId: string, dateRange: DateRange) {
    const { startDate, endDate } = dateRange;

    const notificationsData = await db
      .select({
        total: count(),
        sent: sql<number>`SUM(CASE WHEN ${notificationLogs.status} = 'sent' THEN 1 ELSE 0 END)`,
        failed: sql<number>`SUM(CASE WHEN ${notificationLogs.status} = 'failed' THEN 1 ELSE 0 END)`,
      })
      .from(notificationLogs)
      .innerJoin(notificationAgents, eq(notificationLogs.agentId, notificationAgents.id))
      .where(
        and(
          eq(notificationAgents.companyId, companyId),
          gte(notificationLogs.sentAt, startDate),
          lte(notificationLogs.sentAt, endDate)
        )
      );

    const total = notificationsData[0]?.total || 0;
    const sent = Number(notificationsData[0]?.sent || 0);
    const failed = Number(notificationsData[0]?.failed || 0);
    const successRate = total > 0 ? (sent / total) * 100 : 0;

    return {
      total,
      sent,
      failed,
      successRate: Math.round(successRate * 10) / 10,
    };
  }
}

export const analyticsService = new AnalyticsService();
