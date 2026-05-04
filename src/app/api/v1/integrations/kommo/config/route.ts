// src/app/api/v1/integrations/kommo/config/route.ts
// Save default pipeline and stage config for the Kommo integration

import { NextResponse, type NextRequest } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { crmIntegrations } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface KommoConfig {
    defaultPipelineId?: string;
    defaultStatusId?: string;
    fieldMapping?: Record<string, string>;
    stageMapping?: Record<string, string>;
}

const configSchema = z.object({
    defaultPipelineId: z.union([z.string(), z.number()]).transform(String),
    defaultStatusId: z.union([z.string(), z.number()]).transform(String),
    fieldMapping: z.record(z.string(), z.string()).optional(),
    stageMapping: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = configSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Dados inválidos.', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { defaultPipelineId, defaultStatusId, fieldMapping, stageMapping } = parsed.data;

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
            return NextResponse.json({ error: 'Integração não encontrada.' }, { status: 404 });
        }

        // Merge with existing config
        const currentConfig = (integration.config as KommoConfig) || {};
        const newConfig: KommoConfig = {
            ...currentConfig,
            defaultPipelineId,
            defaultStatusId,
            fieldMapping: fieldMapping || currentConfig.fieldMapping,
            stageMapping: stageMapping || currentConfig.stageMapping,
        };

        await db
            .update(crmIntegrations)
            .set({ config: newConfig, updatedAt: new Date() })
            .where(eq(crmIntegrations.id, integration.id));

        return NextResponse.json({
            success: true,
            message: 'Configuração de funil e etapa salva com sucesso!',
            config: newConfig,
        });

    } catch (error) {
        console.error('[Kommo Config] Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
