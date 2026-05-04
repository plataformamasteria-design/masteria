import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { campaigns, voiceDeliveryReports, contacts } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

// GET /api/v1/campaigns/{id}/voice-report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { campaignId } = await params;

    // Verify campaign exists and belongs to company
    const campaignsResult = await db
      .select({ id: campaigns.id, channel: campaigns.channel })
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.companyId, companyId)));

    if (!campaignsResult || campaignsResult.length === 0 || campaignsResult[0]?.channel !== 'VOICE') {
      return NextResponse.json(
        { error: 'Campaign not found or is not a voice campaign' },
        { status: 404 }
      );
    }

    // Get all voice delivery reports for this campaign
    const reportsData = await db
      .select({
        id: voiceDeliveryReports.id,
        contactId: voiceDeliveryReports.contactId,
        status: voiceDeliveryReports.status,
        callOutcome: voiceDeliveryReports.callOutcome,
        duration: voiceDeliveryReports.duration,
        failureReason: voiceDeliveryReports.failureReason,
        disconnectionReason: voiceDeliveryReports.disconnectionReason,
        sentAt: voiceDeliveryReports.sentAt,
        providerCallId: voiceDeliveryReports.providerCallId,
        phoneNumber: contacts.phone,
      })
      .from(voiceDeliveryReports)
      .leftJoin(contacts, eq(voiceDeliveryReports.contactId, contacts.id))
      .where(eq(voiceDeliveryReports.campaignId, campaignId))
      .orderBy(sql`${voiceDeliveryReports.sentAt} DESC`);

    const reports = reportsData.map((r) => ({
      id: r.id,
      contactId: r.contactId,
      phoneNumber: r.phoneNumber || 'Desconhecido',
      status: r.status,
      callOutcome: r.callOutcome,
      duration: r.duration,
      failureReason: r.failureReason,
      disconnectionReason: r.disconnectionReason,
      sentAt: r.sentAt,
      providerCallId: r.providerCallId,
    }));

    // Calculate metrics
    const metrics = {
      total: reports.length,
      answered: reports.filter(
        (r) =>
          r.callOutcome === 'human' ||
          r.callOutcome === 'voicemail' ||
          (r.status === 'completed' && r.callOutcome !== 'no_answer' && r.callOutcome !== 'busy' && r.callOutcome !== 'failed')
      ).length,
      notAnswered: reports.filter(
        (r) =>
          r.callOutcome === 'no_answer' ||
          r.callOutcome === 'busy' ||
          (r.status === 'failed' && r.callOutcome === 'pending')
      ).length,
      failed: reports.filter((r) => r.callOutcome === 'failed' || r.status === 'failed').length,
    };

    // Prepare call list with status mapping
    const calls = reports.map((report) => ({
      phoneNumber: report.phoneNumber || 'Desconhecido',
      status: mapCallStatus(report.callOutcome, report.status),
      outcome: report.callOutcome,
      duration: report.duration ? formatDuration(report.duration) : null,
      failureReason: report.failureReason || report.disconnectionReason,
      sentAt: report.sentAt,
      callId: report.providerCallId,
    }));

    return NextResponse.json({
      metrics,
      calls: calls.sort((a, b) => {
        const dateA = new Date(a.sentAt || 0).getTime();
        const dateB = new Date(b.sentAt || 0).getTime();
        return dateB - dateA; // Most recent first
      }),
      total: reports.length,
    });
  } catch (error) {
    console.error('Error fetching voice report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function mapCallStatus(
  outcome: string | null,
  status: string
): 'answered' | 'no_answer' | 'voicemail' | 'failed' | 'busy' | 'unknown' {
  if (outcome === 'human') return 'answered';
  if (outcome === 'voicemail') return 'voicemail';
  if (outcome === 'no_answer') return 'no_answer';
  if (outcome === 'busy') return 'busy';
  if (outcome === 'failed' || status === 'failed') return 'failed';
  return 'unknown';
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
