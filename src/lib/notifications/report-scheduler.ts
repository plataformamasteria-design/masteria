import { db } from '@/lib/db';
import { notificationAgents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  generateCompanyReport,
  getDailyPeriod,
  getWeeklyPeriod,
  formatReportMessage,
} from './report-generator';
import { sendWhatsappTextMessage } from '@/lib/facebookApiService';

interface SchedulerState {
  dailyInterval: NodeJS.Timeout | null;
  dailyTimeout: NodeJS.Timeout | null;
  weeklyInterval: NodeJS.Timeout | null;
  weeklyTimeout: NodeJS.Timeout | null;
  isRunning: boolean;
}

const schedulerState: SchedulerState = {
  dailyInterval: null,
  dailyTimeout: null,
  weeklyInterval: null,
  weeklyTimeout: null,
  isRunning: false,
};

async function sendDailyReports() {
  console.log('[ReportScheduler] Starting daily reports...');

  try {
    const agents = await db.query.notificationAgents.findMany({
      where: eq(notificationAgents.isActive, true),
      with: {
        groups: true,
        company: true,
      },
    });

    const dailyAgents = agents.filter((agent) => {
      const notif = agent.enabledNotifications as Record<string, boolean>;
      return notif.dailyReport === true;
    });

    const companiesProcessed = new Set<string>();

    for (const agent of dailyAgents) {
      const companyId = agent.companyId;

      if (companiesProcessed.has(companyId)) {
        continue;
      }

      try {
        const period = getDailyPeriod();
        const report = await generateCompanyReport(companyId, period);
        const message = formatReportMessage(report);

        const companyAgents = dailyAgents.filter((a) => a.companyId === companyId);

        for (const companyAgent of companyAgents) {
          for (const group of companyAgent.groups) {
            try {
              await sendWhatsappTextMessage({
                connectionId: companyAgent.connectionId,
                to: group.groupJid,
                text: message,
              });

              console.log(
                `[ReportScheduler] Daily report sent to ${group.groupJid} for company ${companyId}`
              );
            } catch (error) {
              console.error(
                `[ReportScheduler] Error sending daily report to ${group.groupJid}:`,
                error
              );
            }
          }
        }

        companiesProcessed.add(companyId);
      } catch (error) {
        console.error(
          `[ReportScheduler] Error generating daily report for company ${companyId}:`,
          error
        );
      }
    }

    console.log(
      `[ReportScheduler] Daily reports completed for ${companiesProcessed.size} companies`
    );
  } catch (error) {
    console.error('[ReportScheduler] Error in daily report scheduler:', error);
  }
}

async function sendWeeklyReports() {
  console.log('[ReportScheduler] Starting weekly reports...');

  try {
    const agents = await db.query.notificationAgents.findMany({
      where: eq(notificationAgents.isActive, true),
      with: {
        groups: true,
        company: true,
      },
    });

    const weeklyAgents = agents.filter((agent) => {
      const notif = agent.enabledNotifications as Record<string, boolean>;
      return notif.weeklyReport === true;
    });

    const companiesProcessed = new Set<string>();

    for (const agent of weeklyAgents) {
      const companyId = agent.companyId;

      if (companiesProcessed.has(companyId)) {
        continue;
      }

      try {
        const period = getWeeklyPeriod();
        const report = await generateCompanyReport(companyId, period);
        const message = formatReportMessage(report);

        const companyAgents = weeklyAgents.filter((a) => a.companyId === companyId);

        for (const companyAgent of companyAgents) {
          for (const group of companyAgent.groups) {
            try {
              await sendWhatsappTextMessage({
                connectionId: companyAgent.connectionId,
                to: group.groupJid,
                text: message,
              });

              console.log(
                `[ReportScheduler] Weekly report sent to ${group.groupJid} for company ${companyId}`
              );
            } catch (error) {
              console.error(
                `[ReportScheduler] Error sending weekly report to ${group.groupJid}:`,
                error
              );
            }
          }
        }

        companiesProcessed.add(companyId);
      } catch (error) {
        console.error(
          `[ReportScheduler] Error generating weekly report for company ${companyId}:`,
          error
        );
      }
    }

    console.log(
      `[ReportScheduler] Weekly reports completed for ${companiesProcessed.size} companies`
    );
  } catch (error) {
    console.error('[ReportScheduler] Error in weekly report scheduler:', error);
  }
}

export function startReportScheduler() {
  if (schedulerState.isRunning) {
    console.log('[ReportScheduler] Scheduler already running');
    return;
  }

  console.log('[ReportScheduler] Starting report scheduler...');

  const dailyAt9AM = () => {
    const now = new Date();
    const next9AM = new Date(now);
    next9AM.setHours(9, 0, 0, 0);

    if (now >= next9AM) {
      next9AM.setDate(next9AM.getDate() + 1);
    }

    const msUntil9AM = next9AM.getTime() - now.getTime();

    schedulerState.dailyTimeout = setTimeout(() => {
      if (!schedulerState.isRunning) return;
      sendDailyReports();
      schedulerState.dailyInterval = setInterval(sendDailyReports, 24 * 60 * 60 * 1000);
    }, msUntil9AM);

    console.log(
      `[ReportScheduler] Daily reports scheduled for ${next9AM.toLocaleString('pt-BR')}`
    );
  };

  const weeklyOnMonday9AM = () => {
    const now = new Date();
    const nextMonday = new Date(now);
    nextMonday.setHours(9, 0, 0, 0);

    const dayOfWeek = now.getDay();
    const daysUntilMonday = (1 + 7 - dayOfWeek) % 7;

    if (dayOfWeek === 1 && now.getHours() >= 9) {
      nextMonday.setDate(nextMonday.getDate() + 7);
    } else if (daysUntilMonday > 0) {
      nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    }

    const msUntilMonday = nextMonday.getTime() - now.getTime();

    schedulerState.weeklyTimeout = setTimeout(() => {
      if (!schedulerState.isRunning) return;
      sendWeeklyReports();
      schedulerState.weeklyInterval = setInterval(
        sendWeeklyReports,
        7 * 24 * 60 * 60 * 1000
      );
    }, msUntilMonday);

    console.log(
      `[ReportScheduler] Weekly reports scheduled for ${nextMonday.toLocaleString('pt-BR')}`
    );
  };

  dailyAt9AM();
  weeklyOnMonday9AM();

  schedulerState.isRunning = true;
  console.log('[ReportScheduler] Scheduler started successfully');
}

export function stopReportScheduler() {
  if (!schedulerState.isRunning) {
    console.log('[ReportScheduler] Scheduler not running');
    return;
  }

  if (schedulerState.dailyTimeout) {
    clearTimeout(schedulerState.dailyTimeout);
    schedulerState.dailyTimeout = null;
  }

  if (schedulerState.dailyInterval) {
    clearInterval(schedulerState.dailyInterval);
    schedulerState.dailyInterval = null;
  }

  if (schedulerState.weeklyTimeout) {
    clearTimeout(schedulerState.weeklyTimeout);
    schedulerState.weeklyTimeout = null;
  }

  if (schedulerState.weeklyInterval) {
    clearInterval(schedulerState.weeklyInterval);
    schedulerState.weeklyInterval = null;
  }

  schedulerState.isRunning = false;
  console.log('[ReportScheduler] Scheduler stopped');
}

export function getSchedulerStatus() {
  return {
    isRunning: schedulerState.isRunning,
    hasDailyInterval: schedulerState.dailyInterval !== null,
    hasDailyTimeout: schedulerState.dailyTimeout !== null,
    hasWeeklyInterval: schedulerState.weeklyInterval !== null,
    hasWeeklyTimeout: schedulerState.weeklyTimeout !== null,
  };
}
