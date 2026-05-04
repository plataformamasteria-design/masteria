import { NextResponse, type NextRequest } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import {
  generateCompanyReport,
  getDailyPeriod,
  getWeeklyPeriod,
  formatReportMessage,
  type ReportPeriod,
} from '@/lib/notifications/report-generator';
import { db } from '@/lib/db';
import { notificationAgents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendWhatsappTextMessage } from '@/lib/facebookApiService';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }
    const body = await request.json();
    const { periodType = 'daily' } = body;

    let period: ReportPeriod;
    if (periodType === 'weekly') {
      period = getWeeklyPeriod();
    } else {
      period = getDailyPeriod();
    }

    const report = await generateCompanyReport(companyId, period);
    const message = formatReportMessage(report);

    const agents = await db.query.notificationAgents.findMany({
      where: and(
        eq(notificationAgents.companyId, companyId),
        eq(notificationAgents.isActive, true)
      ),
      with: {
        groups: true,
      },
    });

    const reportAgents = agents.filter((agent) => {
      const notif = agent.enabledNotifications as Record<string, boolean>;
      return (
        (periodType === 'daily' && notif.dailyReport) ||
        (periodType === 'weekly' && notif.weeklyReport)
      );
    });

    if (reportAgents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Relatório gerado mas nenhum agente configurado para recebê-lo.',
        report,
      });
    }

    const sendPromises = reportAgents.flatMap((agent) =>
      agent.groups.map(async (group) => {
        try {
          await sendWhatsappTextMessage({
            connectionId: agent.connectionId,
            to: group.groupJid,
            text: message,
          });

          return { agentId: agent.id, groupJid: group.groupJid, status: 'sent' as const };
        } catch (error) {
          console.error(`[ReportSender] Error sending to group ${group.groupJid}:`, error);
          throw {
            agentId: agent.id,
            groupJid: group.groupJid,
            status: 'failed' as const,
            error: (error as Error).message,
          };
        }
      })
    );

    const results = await Promise.allSettled(sendPromises);

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      message: `Relatório enviado para ${sent} agente(s). ${failed} falha(s).`,
      report,
      results: results.map((r) =>
        r.status === 'fulfilled' ? r.value : { status: 'error', reason: r.reason }
      ),
    });
  } catch (error) {
    console.error('[ReportSender] Error:', error);
    return NextResponse.json(
      {
        error: 'Erro ao enviar relatório.',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
