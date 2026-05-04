'use server';

import { db } from '@/lib/db';
import { eq, and, gte, lt, sql } from 'drizzle-orm';
import {
  leadDiagnostics,
  conversations,
  marketingCampaigns
} from '@/lib/db/schema';
import { requireAuthOr401 } from '@/lib/api-auth-helper';

export async function getMonthlyDiagnostics(year: number) {
  const auth = await requireAuthOr401();
  if ('status' in auth) throw new Error("Unauthorized");
  const { companyId: organizationId } = auth;

  const startDate = `${year}-01`;
  const endDate = `${year}-12`;

  const data = await db
    .select()
    .from(leadDiagnostics)
    .where(
      and(
        eq(leadDiagnostics.companyId, organizationId),
        gte(leadDiagnostics.referenceMonth, startDate),
        lt(leadDiagnostics.referenceMonth, `${year + 1}-01`)
      )
    )
    .orderBy(leadDiagnostics.referenceMonth);

  return data;
}

export async function saveDiagnostics(payload: any[]) {
  const auth = await requireAuthOr401();
  if ('status' in auth) throw new Error("Unauthorized");
  const { companyId: organizationId } = auth;

  for (const item of payload) {
    if (!item.referenceMonth) continue;

    // Check if it exists
    const [existing] = await db
      .select({ id: leadDiagnostics.id })
      .from(leadDiagnostics)
      .where(
        and(
          eq(leadDiagnostics.companyId, organizationId),
          eq(leadDiagnostics.referenceMonth, item.referenceMonth)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(leadDiagnostics)
        .set({
          totalLeads: item.totalLeads,
          meetingsScheduled: item.meetingsScheduled,
          meetingsDone: item.meetingsDone,
          noShow: item.noShow,
          contractsWon: item.contractsWon,
          ltvTotal: item.ltvTotal?.toString() || '0',
          adSpend: item.adSpend?.toString() || '0',
          commissionRate: item.commissionRate?.toString() || '10',
          cpl: item.cpl?.toString(),
          meetingRate: item.meetingRate?.toString(),
          cprf: item.cprf?.toString(),
          conversionRate: item.conversionRate?.toString(),
          cacMarketing: item.cacMarketing?.toString(),
          cacApproximate: item.cacApproximate?.toString(),
          ticketMedio: item.ticketMedio?.toString(),
          mrr: item.mrr?.toString(),
          roas: item.roas?.toString(),
          commissionTotal: item.commissionTotal?.toString(),
          closersResult: item.closersResult?.toString(),
          updatedAt: new Date()
        })
        .where(eq(leadDiagnostics.id, existing.id));
    } else {
      await db.insert(leadDiagnostics).values({
        companyId: organizationId,
        referenceMonth: item.referenceMonth,
        totalLeads: item.totalLeads || 0,
        meetingsScheduled: item.meetingsScheduled || 0,
        meetingsDone: item.meetingsDone || 0,
        noShow: item.noShow || 0,
        contractsWon: item.contractsWon || 0,
        ltvTotal: item.ltvTotal?.toString() || '0',
        adSpend: item.adSpend?.toString() || '0',
        commissionRate: item.commissionRate?.toString() || '10',
        cpl: item.cpl?.toString() || '0',
        meetingRate: item.meetingRate?.toString() || '0',
        cprf: item.cprf?.toString() || '0',
        conversionRate: item.conversionRate?.toString() || '0',
        cacMarketing: item.cacMarketing?.toString() || '0',
        cacApproximate: item.cacApproximate?.toString() || '0',
        ticketMedio: item.ticketMedio?.toString() || '0',
        mrr: item.mrr?.toString() || '0',
        roas: item.roas?.toString() || '0',
        commissionTotal: item.commissionTotal?.toString() || '0',
        closersResult: item.closersResult?.toString() || '0',
      });
    }
  }

  return { success: true };
}

export async function syncDiagnosticsMonth(monthString: string) {
  // monthString is like '2024-03'
  const auth = await requireAuthOr401();
  if ('status' in auth) throw new Error("Unauthorized");
  const { companyId: organizationId } = auth;

  const startDate = new Date(`${monthString}-01T00:00:00Z`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);

  // Parallel fetches for speed over edge
  const [
    leadsResult,
  ] = await Promise.all([
    db.select({ totalLeads: sql<number>`cast(count(*) as integer)` })
      .from(conversations)
      .where(and(eq(conversations.companyId, organizationId), gte(conversations.createdAt, startDate), lt(conversations.createdAt, endDate))),
  ]);

  const totalLeads = leadsResult[0]?.totalLeads || 0;

  // For future phases: Event scheduling, billing & wins. Modmocked for Phase 10 compiling cleanly.
  let contractsWon = 0;
  let eventsScheduled = 0;
  let eventsDone = 0;
  let eventsNoShow = 0;
  let totalIncome = 0;

  // Marketing Sync
  const mktResult = await db
    .select({
      campSpend: sql<number>`cast(sum(cast(spend as numeric)) as float)`,
      campImpressions: sql<number>`cast(sum(impressions) as integer)`,
      campClicks: sql<number>`cast(sum(clicks) as integer)`,
      campConversions: sql<number>`cast(sum(conversions) as integer)`,
    })
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.companyId, organizationId));

  const { campSpend = 0, campImpressions = 0, campClicks = 0, campConversions = 0 } = mktResult[0] || {};

  return {
    referenceMonth: monthString,
    totalLeads: totalLeads || 0,
    meetingsScheduled: eventsScheduled || 0,
    meetingsDone: eventsDone || 0,
    noShow: eventsNoShow || 0,
    contractsWon,
    ltvTotal: totalIncome || 0,
    campaignSpend: campSpend || 0,
    campaignImpressions: campImpressions || 0,
    campaignClicks: campClicks || 0,
    campaignConversions: campConversions || 0,
  };
}
