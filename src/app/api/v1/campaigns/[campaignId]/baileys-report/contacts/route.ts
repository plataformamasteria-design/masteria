import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { campaigns, whatsappDeliveryReports, contacts } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

const CONTACTS_PER_PAGE = 15;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();

    const { campaignId } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, campaignId),
        eq(campaigns.companyId, companyId)
      ),
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const offset = (page - 1) * CONTACTS_PER_PAGE;

    const [deliveryReports, countResult] = await Promise.all([
      db
        .select({
          id: whatsappDeliveryReports.id,
          status: whatsappDeliveryReports.status,
          sentAt: whatsappDeliveryReports.sentAt,
          updatedAt: whatsappDeliveryReports.updatedAt,
          failureReason: whatsappDeliveryReports.failureReason,
          providerMessageId: whatsappDeliveryReports.providerMessageId,
          contactId: contacts.id,
          contactName: contacts.name,
          contactPhone: contacts.phone,
        })
        .from(whatsappDeliveryReports)
        .innerJoin(contacts, eq(whatsappDeliveryReports.contactId, contacts.id))
        .where(eq(whatsappDeliveryReports.campaignId, campaignId))
        .orderBy(desc(whatsappDeliveryReports.sentAt))
        .limit(CONTACTS_PER_PAGE)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(whatsappDeliveryReports)
        .where(eq(whatsappDeliveryReports.campaignId, campaignId)),
    ]);

    const total = countResult[0]?.count || 0;
    const totalPages = Math.ceil(total / CONTACTS_PER_PAGE);

    return NextResponse.json({
      contacts: deliveryReports.map((report) => ({
        id: report.id,
        contactId: report.contactId,
        name: report.contactName || 'Desconhecido',
        phone: report.contactPhone,
        status: report.status,
        sentAt: report.sentAt,
        updatedAt: report.updatedAt,
        failureReason: report.failureReason,
        messageId: report.providerMessageId,
      })),
      pagination: {
        page,
        perPage: CONTACTS_PER_PAGE,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('[BaileysReport] Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
