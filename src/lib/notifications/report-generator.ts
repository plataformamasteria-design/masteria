import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export interface ReportPeriod {
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface CampaignStats {
  total: number;
  completed: number;
  failed: number;
  totalRecipients: number;
}

export interface MeetingStats {
  total: number;
  confirmed: number;
  pending: number;
}

export interface SalesStats {
  total: number;
  totalValue: number;
}

export interface CompanyReport {
  companyId: string;
  period: ReportPeriod;
  campaigns: CampaignStats;
  meetings: MeetingStats;
  sales: SalesStats;
  notifications: {
    total: number;
    successful: number;
    failed: number;
  };
}

export function getDailyPeriod(): ReportPeriod {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  return {
    startDate,
    endDate,
    label: 'Diário',
  };
}

export function getWeeklyPeriod(): ReportPeriod {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 7);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  return {
    startDate,
    endDate,
    label: 'Semanal',
  };
}

export async function generateCompanyReport(
  companyId: string,
  period: ReportPeriod
): Promise<CompanyReport> {
  const { startDate, endDate } = period;

  const campaignStats = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where status = 'COMPLETED')::int`,
      failed: sql<number>`count(*) filter (where status = 'FAILED')::int`,
      totalRecipients: sql<number>`coalesce(sum((select count(*) from jsonb_array_elements(recipients))), 0)::int`,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.companyId, companyId),
        gte(campaigns.createdAt, startDate),
        lte(campaigns.createdAt, endDate)
      )
    );

  const meetingStatsRaw = await db.execute(
    sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE "currentStage"->>'type' = 'CONTACTED')::int as confirmed,
        COUNT(*) FILTER (WHERE "currentStage"->>'type' = 'PROSPECT')::int as pending
      FROM kanban_leads kl
      INNER JOIN kanban_boards kb ON kl.board_id = kb.id
      WHERE kb.company_id = ${companyId}
        AND kl."lastStageChangeAt" >= ${startDate}
        AND kl."lastStageChangeAt" <= ${endDate}
        AND kl."currentStage" IS NOT NULL
    `
  );

  const salesStatsRaw = await db.execute(
    sql`
      SELECT 
        COUNT(*)::int as total,
        COALESCE(SUM(CAST(value AS NUMERIC)), 0) as "totalValue"
      FROM kanban_leads kl
      INNER JOIN kanban_boards kb ON kl.board_id = kb.id
      WHERE kb.company_id = ${companyId}
        AND kl."currentStage"->>'type' = 'WIN'
        AND kl."lastStageChangeAt" >= ${startDate}
        AND kl."lastStageChangeAt" <= ${endDate}
    `
  );

  const notificationStatsRaw = await db.execute(
    sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'SENT')::int as successful,
        COUNT(*) FILTER (WHERE status = 'FAILED')::int as failed
      FROM notification_logs nl
      INNER JOIN notification_agents na ON nl.agent_id = na.id
      WHERE na.company_id = ${companyId}
        AND nl.sent_at >= ${startDate}
        AND nl.sent_at <= ${endDate}
    `
  );

  const meetingStats = ((meetingStatsRaw as any).rows?.[0] as MeetingStats) || { total: 0, confirmed: 0, pending: 0 };
  const salesStats = ((salesStatsRaw as any).rows?.[0] as SalesStats) || { total: 0, totalValue: 0 };
  const notifStats = ((notificationStatsRaw as any).rows?.[0] as { total: number; successful: number; failed: number }) || { total: 0, successful: 0, failed: 0 };

  return {
    companyId,
    period,
    campaigns: {
      total: campaignStats[0]?.total || 0,
      completed: campaignStats[0]?.completed || 0,
      failed: campaignStats[0]?.failed || 0,
      totalRecipients: campaignStats[0]?.totalRecipients || 0,
    },
    meetings: {
      total: meetingStats?.total || 0,
      confirmed: meetingStats?.confirmed || 0,
      pending: meetingStats?.pending || 0,
    },
    sales: {
      total: salesStats?.total || 0,
      totalValue: Number(salesStats?.totalValue || 0),
    },
    notifications: {
      total: notifStats?.total || 0,
      successful: notifStats?.successful || 0,
      failed: notifStats?.failed || 0,
    },
  };
}

export function formatReportMessage(report: CompanyReport): string {
  const { period, campaigns, meetings, sales, notifications } = report;

  const lines = [
    `📊 *Relatório ${period.label}*`,
    `📅 ${period.startDate.toLocaleDateString('pt-BR')} - ${period.endDate.toLocaleDateString('pt-BR')}`,
    '',
    '*📢 Campanhas*',
    `• Total: ${campaigns.total}`,
    `• Concluídas: ${campaigns.completed}`,
    `• Falhas: ${campaigns.failed}`,
    `• Destinatários: ${campaigns.totalRecipients}`,
    '',
    '*📅 Agendamentos*',
    `• Novos: ${meetings.total}`,
    `• Confirmados: ${meetings.confirmed}`,
    `• Pendentes: ${meetings.pending}`,
    '',
    '*💰 Vendas*',
    `• Total: ${sales.total}`,
    `• Valor: R$ ${sales.totalValue.toFixed(2)}`,
    '',
    '*🔔 Notificações*',
    `• Enviadas: ${notifications.total}`,
    `• Sucesso: ${notifications.successful}`,
    `• Falhas: ${notifications.failed}`,
  ];

  return lines.join('\n');
}
