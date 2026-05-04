import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { voiceDeliveryReports, contacts, campaigns } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const baseConditions = [eq(voiceDeliveryReports.companyId, companyId)];
    
    if (contactId) {
      baseConditions.push(eq(voiceDeliveryReports.contactId, contactId));
    }

    const callsData = await db
      .select({
        id: voiceDeliveryReports.id,
        providerCallId: voiceDeliveryReports.providerCallId,
        status: voiceDeliveryReports.status,
        callOutcome: voiceDeliveryReports.callOutcome,
        duration: voiceDeliveryReports.duration,
        sentAt: voiceDeliveryReports.sentAt,
        disconnectionReason: voiceDeliveryReports.disconnectionReason,
        contactName: contacts.name,
        contactPhone: contacts.phone,
        campaignName: campaigns.name,
      })
      .from(voiceDeliveryReports)
      .leftJoin(contacts, eq(voiceDeliveryReports.contactId, contacts.id))
      .leftJoin(campaigns, eq(voiceDeliveryReports.campaignId, campaigns.id))
      .where(and(...baseConditions))
      .orderBy(desc(voiceDeliveryReports.sentAt))
      .limit(limit);

    const calls = callsData.map((call: any) => ({
      id: call.id,
      callId: call.providerCallId,
      customerName: call.contactName || 'Desconhecido',
      customerNumber: call.contactPhone || '',
      status: mapStatus(call.status, call.callOutcome),
      duration: call.duration || 0,
      startedAt: call.sentAt?.toISOString() || new Date().toISOString(),
      summary: call.disconnectionReason || '',
      campaignName: call.campaignName,
    }));

    return NextResponse.json({ calls, total: calls.length });
  } catch (error) {
    console.error('Error fetching voice history:', error);
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 });
  }
}

function mapStatus(status: string, outcome: string | null): string {
  if (outcome === 'human') return 'completed';
  if (outcome === 'voicemail') return 'voicemail';
  if (outcome === 'no_answer') return 'no_answer';
  if (outcome === 'busy') return 'busy';
  if (status === 'FAILED') return 'failed';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'INITIATED') return 'initiated';
  return 'unknown';
}
