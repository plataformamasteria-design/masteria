import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { campaigns, whatsappDeliveryReports } from '@/lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();

    const { campaignId } = await params;

    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, campaignId),
        eq(campaigns.companyId, companyId)
      ),
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const metrics = await db
      .select({
        total: sql<number>`count(*)::int`,
        sent: sql<number>`count(*) FILTER (WHERE ${whatsappDeliveryReports.status} IN ('sent', 'SENT'))::int`,
        delivered: sql<number>`count(*) FILTER (WHERE ${whatsappDeliveryReports.status} IN ('delivered', 'DELIVERED'))::int`,
        read: sql<number>`count(*) FILTER (WHERE ${whatsappDeliveryReports.status} IN ('read', 'READ', 'played', 'PLAYED'))::int`,
        failed: sql<number>`count(*) FILTER (WHERE ${whatsappDeliveryReports.status} IN ('failed', 'FAILED'))::int`,
      })
      .from(whatsappDeliveryReports)
      .where(eq(whatsappDeliveryReports.campaignId, campaignId));

    const stats = metrics[0] || { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 };

    const total = stats.total || 0;
    const deliveryRate = total > 0 ? ((stats.delivered + stats.read) / total) * 100 : 0;
    const readRate = total > 0 ? (stats.read / total) * 100 : 0;
    const failureRate = total > 0 ? (stats.failed / total) * 100 : 0;

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        message: campaign.message,
        createdAt: campaign.createdAt,
        sentAt: campaign.sentAt,
        completedAt: campaign.completedAt,
      },
      metrics: {
        total,
        sent: stats.sent,
        delivered: stats.delivered,
        read: stats.read,
        failed: stats.failed,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        readRate: Math.round(readRate * 100) / 100,
        failureRate: Math.round(failureRate * 100) / 100,
      },
      statusBreakdown: [
        { name: 'Enviadas', value: stats.sent, color: '#3b82f6' },
        { name: 'Entregues', value: stats.delivered, color: '#22c55e' },
        { name: 'Lidas', value: stats.read, color: '#8b5cf6' },
        { name: 'Falhas', value: stats.failed, color: '#ef4444' },
      ],
    });
  } catch (error) {
    console.error('[BaileysReport] Error fetching report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
