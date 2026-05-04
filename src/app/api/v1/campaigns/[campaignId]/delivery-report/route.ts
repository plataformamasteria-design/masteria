// src/app/api/v1/campaigns/[campaignId]/delivery-report/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { campaigns, whatsappDeliveryReports, smsDeliveryReports, contacts } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { campaignId } = await params;
        
        const [campaign] = await db.select({ channel: campaigns.channel })
            .from(campaigns)
            .where(and(eq(campaigns.id, campaignId), eq(campaigns.companyId, companyId)));

        if (!campaign) {
            return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });
        }
        
        let deliveryData;
        
        if (campaign.channel === 'WHATSAPP') {
             deliveryData = await db
                .select({
                    id: whatsappDeliveryReports.id,
                    status: whatsappDeliveryReports.status,
                    sentAt: whatsappDeliveryReports.sentAt,
                    updatedAt: whatsappDeliveryReports.updatedAt,
                    failureReason: whatsappDeliveryReports.failureReason,
                    contactId: contacts.id,
                    contactName: contacts.name,
                    contactPhone: contacts.phone,
                })
                .from(whatsappDeliveryReports)
                .innerJoin(contacts, eq(whatsappDeliveryReports.contactId, contacts.id))
                .where(eq(whatsappDeliveryReports.campaignId, campaignId))
                .orderBy(desc(whatsappDeliveryReports.sentAt));
        } else if (campaign.channel === 'SMS') {
            deliveryData = await db
                .select({
                    id: smsDeliveryReports.id,
                    status: smsDeliveryReports.status,
                    sentAt: smsDeliveryReports.sentAt,
                    updatedAt: smsDeliveryReports.updatedAt,
                    failureReason: smsDeliveryReports.failureReason,
                    contactId: contacts.id,
                    contactName: contacts.name,
                    contactPhone: contacts.phone,
                })
                .from(smsDeliveryReports)
                .innerJoin(contacts, eq(smsDeliveryReports.contactId, contacts.id))
                .where(eq(smsDeliveryReports.campaignId, campaignId))
                .orderBy(desc(smsDeliveryReports.sentAt));
        } else {
             return NextResponse.json({ error: 'Canal da campanha desconhecido.' }, { status: 400 });
        }

        return NextResponse.json(deliveryData);

    } catch (error) {
        console.error(`Erro ao buscar relatório de entrega para a campanha ${campaignId}:`, error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
