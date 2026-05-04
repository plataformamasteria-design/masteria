// src/app/api/v1/integrations/kommo/disconnect/route.ts
// Disconnect the Kommo integration for the current company

import { NextResponse, type NextRequest } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { crmIntegrations, crmAccounts } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();

        // Find integration
        const [integration] = await db
            .select()
            .from(crmIntegrations)
            .where(
                and(
                    eq(crmIntegrations.companyId, companyId),
                    eq(crmIntegrations.provider, 'kommo')
                )
            )
            .limit(1);

        if (!integration) {
            return NextResponse.json({ error: 'Integração Kommo não encontrada.' }, { status: 404 });
        }

        // Delete credentials
        await db.delete(crmAccounts).where(eq(crmAccounts.integrationId, integration.id));

        // Update status
        await db
            .update(crmIntegrations)
            .set({ status: 'disconnected', config: null, updatedAt: new Date() })
            .where(eq(crmIntegrations.id, integration.id));

        return NextResponse.json({
            success: true,
            message: 'Integração Kommo desconectada com sucesso.',
        });

    } catch (error) {
        console.error('[Kommo Disconnect] Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
