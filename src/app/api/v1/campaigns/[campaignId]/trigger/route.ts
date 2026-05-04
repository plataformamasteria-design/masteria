// src/app/api/v1/campaigns/[campaignId]/trigger/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { sendWhatsappCampaign, sendSmsCampaign } from '@/lib/campaign-sender';

/**
 * Endpoint para forçar o envio de UMA campanha específica.
 * Dispara diretamente sem depender de Redis/BullMQ.
 */

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
    const { campaignId } = await params;
    
    try {
        const companyId = await getCompanyIdFromSession();
        const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.companyId, companyId)));

        if (!campaign) {
            return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });
        }

        if (!['SCHEDULED', 'PENDING', 'QUEUED'].includes(campaign.status)) {
            return NextResponse.json({ error: `A campanha não está num estado que permita o reenvio. Status atual: ${campaign.status}` }, { status: 400 });
        }

        console.log(`[Campaign Trigger] 🚀 Disparando campanha manualmente: ${campaign.name} (${campaignId})`);

        // Dispara diretamente sem usar Redis (bypass para quando Redis está com limite)
        const channelUpper = campaign.channel?.toUpperCase();
        
        if (channelUpper === 'WHATSAPP') {
            // Dispara em background para responder imediatamente
            sendWhatsappCampaign(campaign).catch(err => {
                console.error(`[Campaign Trigger] ❌ Erro ao enviar campanha WhatsApp ${campaignId}:`, err);
            });
            
            return NextResponse.json({ 
                success: true, 
                message: `Campanha "${campaign.name}" disparada com sucesso. Processando envios...`,
                campaignId: campaign.id,
                channel: 'WHATSAPP'
            });
        } else if (channelUpper === 'SMS') {
            sendSmsCampaign(campaign).catch(err => {
                console.error(`[Campaign Trigger] ❌ Erro ao enviar campanha SMS ${campaignId}:`, err);
            });
            
            return NextResponse.json({ 
                success: true, 
                message: `Campanha SMS "${campaign.name}" disparada com sucesso.`,
                campaignId: campaign.id,
                channel: 'SMS'
            });
        }

        return NextResponse.json({ error: 'Canal não suportado.' }, { status: 400 });
        
    } catch (error) {
        console.error(`[Campaign Trigger] ❌ Erro ao disparar campanha ${campaignId}:`, error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
