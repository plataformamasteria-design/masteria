// src/app/api/v1/settings/webhooks/[webhookId]/auto-approach/route.ts
// API for managing auto-approach settings per webhook config
import { NextRequest, NextResponse } from 'next/server';
import { conn } from '@/lib/db';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
    auto_approach_enabled: z.boolean().optional(),
    auto_approach_connection_id: z.string().uuid().nullable().optional(),
    auto_approach_message: z.string().max(2000).optional(),
    auto_approach_delay_seconds: z.number().int().min(3).max(120).optional(),
    auto_approach_ai_persona_id: z.string().uuid().nullable().optional(),
});

/**
 * GET /api/v1/settings/webhooks/[webhookId]/auto-approach
 * Returns auto-approach config for a specific webhook
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ webhookId: string }> }
) {
    try {
        const companyId = await getCompanyIdFromSession();
        if (!companyId) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        const { webhookId } = await params;

        const result = await conn`
      SELECT 
        id,
        name,
        COALESCE(auto_approach_enabled, false) as auto_approach_enabled,
        auto_approach_connection_id,
        COALESCE(auto_approach_message, '') as auto_approach_message,
        COALESCE(auto_approach_delay_seconds, 5) as auto_approach_delay_seconds,
        auto_approach_ai_persona_id
      FROM incoming_webhook_configs
      WHERE id = ${webhookId} AND company_id = ${companyId}
      LIMIT 1
    `;

        if (!result || (result as any).length === 0) {
            return NextResponse.json({ error: 'Webhook não encontrado' }, { status: 404 });
        }

        return NextResponse.json({ data: (result as any)[0] });
    } catch (error) {
        console.error('[AutoApproach API] GET error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}

/**
 * PUT /api/v1/settings/webhooks/[webhookId]/auto-approach
 * Updates auto-approach config for a specific webhook
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ webhookId: string }> }
) {
    try {
        const companyId = await getCompanyIdFromSession();
        if (!companyId) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        const { webhookId } = await params;
        const body = await request.json();
        const validation = updateSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({
                error: 'Dados inválidos',
                details: validation.error.flatten().fieldErrors,
            }, { status: 400 });
        }

        // Verify webhook belongs to this company
        const webhookCheck = await conn`
      SELECT id FROM incoming_webhook_configs
      WHERE id = ${webhookId} AND company_id = ${companyId}
      LIMIT 1
    `;

        if (!webhookCheck || (webhookCheck as any).length === 0) {
            return NextResponse.json({ error: 'Webhook não encontrado' }, { status: 404 });
        }

        const data = validation.data;

        // Validate connection belongs to company (if provided)
        if (data.auto_approach_connection_id) {
            const connCheck = await conn`
        SELECT id FROM connections 
        WHERE id = ${data.auto_approach_connection_id} AND company_id = ${companyId}
        LIMIT 1
      `;
            if (!connCheck || (connCheck as any).length === 0) {
                return NextResponse.json({ error: 'Conexão não encontrada ou não pertence a esta empresa' }, { status: 400 });
            }
        }

        // Validate persona belongs to company (if provided)
        if (data.auto_approach_ai_persona_id) {
            const personaCheck = await conn`
        SELECT id FROM ai_personas 
        WHERE id = ${data.auto_approach_ai_persona_id} AND company_id = ${companyId}
        LIMIT 1
      `;
            if (!personaCheck || (personaCheck as any).length === 0) {
                return NextResponse.json({ error: 'Persona de IA não encontrada ou não pertence a esta empresa' }, { status: 400 });
            }
        }

        // Build dynamic update
        await conn`
      UPDATE incoming_webhook_configs SET
        auto_approach_enabled = COALESCE(${data.auto_approach_enabled ?? null}::boolean, auto_approach_enabled),
        auto_approach_connection_id = ${data.auto_approach_connection_id !== undefined ? data.auto_approach_connection_id : null},
        auto_approach_message = COALESCE(${data.auto_approach_message ?? null}, auto_approach_message),
        auto_approach_delay_seconds = COALESCE(${data.auto_approach_delay_seconds ?? null}::int, auto_approach_delay_seconds),
        auto_approach_ai_persona_id = ${data.auto_approach_ai_persona_id !== undefined ? data.auto_approach_ai_persona_id : null},
        updated_at = NOW()
      WHERE id = ${webhookId} AND company_id = ${companyId}
    `;

        // Fetch updated config
        const updated = await conn`
      SELECT 
        id,
        name,
        COALESCE(auto_approach_enabled, false) as auto_approach_enabled,
        auto_approach_connection_id,
        COALESCE(auto_approach_message, '') as auto_approach_message,
        COALESCE(auto_approach_delay_seconds, 5) as auto_approach_delay_seconds,
        auto_approach_ai_persona_id
      FROM incoming_webhook_configs
      WHERE id = ${webhookId} AND company_id = ${companyId}
      LIMIT 1
    `;

        return NextResponse.json({
            data: (updated as any)[0],
            message: 'Configuração de abordagem automática atualizada com sucesso',
        });
    } catch (error) {
        console.error('[AutoApproach API] PUT error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
