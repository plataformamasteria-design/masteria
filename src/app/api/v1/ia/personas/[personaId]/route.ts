
// src/app/api/v1/ia/personas/[personaId]/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { aiPersonas, personaPromptSections } from '@/lib/db/schema';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { parsePromptIntoSections } from '@/lib/rag/prompt-parser';
import { apiCache } from '@/lib/api-cache';

const personaUpdateSchema = z.object({
    name: z.string().min(1, 'O nome é obrigatório').optional(),
    agentType: z.enum(['GENERAL', 'ATENDIMENTO', 'SDR', 'VENDAS', 'ONBOARDING', 'RELATOR']).optional(),
    systemPrompt: z.string().optional().nullable(),
    provider: z.preprocess(
        (value) => (value === 'OPENROUTER' ? 'GEMINI' : value),
        z.enum(['GEMINI'])
    ).optional(),
    model: z.string().min(1).optional(),
    credentialId: z.string().uuid().optional().nullable(),
    temperature: z.string().optional(),
    topP: z.string().optional(),
    maxOutputTokens: z.number().int().optional(),
    mcpServerUrl: z.string().url("A URL do servidor MCP é inválida.").optional().nullable(),
    mcpServerHeaders: z.record(z.string()).optional().nullable(),
    triggerKeywords: z.array(z.string()).optional(),
    isTriggerActive: z.boolean().optional(),
    useRag: z.boolean().optional(),
    firstResponseMinDelay: z.number().int().min(0).optional(),
    firstResponseMaxDelay: z.number().int().min(0).optional(),
    followupResponseMinDelay: z.number().int().min(0).optional(),
    followupResponseMaxDelay: z.number().int().min(0).optional(),
    resources: z.array(z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        type: z.enum(['LINK', 'PIX', 'TEXT', 'IMAGE']),
        content: z.string().min(1),
        description: z.string().optional(),
        isActive: z.boolean().default(true),
    })).optional().default([]),
    variables: z.record(z.string()).optional(),
    behaviorPresets: z.object({
        useAbbreviations: z.boolean().optional(),
        maxEmojisPerMessage: z.number().optional(),
        boldSingleCTA: z.boolean().optional(),
        variedGreetings: z.array(z.string()).optional(),
        splitResources: z.boolean().optional(),
    }).optional(),
    audioMode: z.enum(['text', 'audio', 'both']).optional(),
    voiceProvider: z.enum(['gemini', 'elevenlabs']).optional(),
    voiceSettings: z.object({
        voiceId: z.string().optional(),
        speed: z.number().optional(),
        stability: z.number().optional(),
        similarityBoost: z.number().optional(),
        style: z.number().optional(),
        useSpeakerBoost: z.boolean().optional(),
        modelId: z.string().optional(),
    }).optional(),
    // Follow-up Automático
    followupEnabled: z.boolean().optional(),
    followupMode: z.enum(['minutes', 'daily']).optional(),
    followupDelayMinutes: z.number().int().min(5).max(1440).optional(),
    followupDaysCount: z.number().int().min(1).max(30).optional(),
    followupMaxAttempts: z.number().int().min(1).max(30).optional(),
    followupMessages: z.array(z.string()).optional(),
    // Agendamento
    enableScheduling: z.boolean().optional(),
    schedulingPrompt: z.string().optional().nullable(),
    meetingReminderEnabled: z.boolean().optional(),
    meetingReminderMinutes: z.number().int().optional(),
    // Toggle de modo de resposta manual (se false, segue Inteligência Comportamental)
    audioModeEnabled: z.boolean().optional(),
    // Funil Kanban associado
    kanbanBoardId: z.string().uuid().optional().nullable(),
}).refine(
    (data) => {
        if (data.firstResponseMinDelay !== undefined && data.firstResponseMaxDelay !== undefined) {
            return data.firstResponseMinDelay <= data.firstResponseMaxDelay;
        }
        return true;
    },
    { message: 'Delay mínimo da primeira resposta deve ser menor ou igual ao máximo', path: ['firstResponseMinDelay'] }
).refine(
    (data) => {
        if (data.followupResponseMinDelay !== undefined && data.followupResponseMaxDelay !== undefined) {
            return data.followupResponseMinDelay <= data.followupResponseMaxDelay;
        }
        return true;
    },
    { message: 'Delay mínimo de demais respostas deve ser menor ou igual ao máximo', path: ['followupResponseMinDelay'] }
);

// GET /api/v1/ia/personas/[personaId] - Fetch a single agent

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ personaId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { personaId } = await params;

        const [agent] = await db.select()
            .from(aiPersonas)
            .where(and(eq(aiPersonas.id, personaId), eq(aiPersonas.companyId, companyId)));

        if (!agent) {
            return NextResponse.json({ error: 'Agente não encontrado ou não pertence à sua empresa.' }, { status: 404 });
        }

        // LOG: Verificar leitura
        console.log(`[PersonaAPI] GET Record:`, { id: agent.id, isTriggerActive: agent.isTriggerActive });

        return NextResponse.json(agent);
    } catch (error) {
        console.error('Erro ao buscar agente:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}


import { revalidatePath } from 'next/cache';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ personaId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { personaId } = await params;
        const body = await request.json();
        const parsed = personaUpdateSchema.safeParse(body);

        // LOG: Verificar o que está chegando
        console.log(`[PersonaAPI] PUT Payload:`, { isTriggerActive: body.isTriggerActive, triggerKeywords: body.triggerKeywords });

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }

        const [currentAgent] = await db.select()
            .from(aiPersonas)
            .where(and(eq(aiPersonas.id, personaId), eq(aiPersonas.companyId, companyId)));

        if (!currentAgent) {
            return NextResponse.json({ error: 'Agente não encontrado ou não pertence à sua empresa.' }, { status: 404 });
        }

        const ragWasActivated = !currentAgent.useRag && parsed.data.useRag === true;
        const promptToMigrate = parsed.data.systemPrompt ?? currentAgent.systemPrompt;

        const { kanbanBoardId, ...restData } = parsed.data;
        const [updated] = await db.update(aiPersonas)
            .set({
                ...restData,
                ...(kanbanBoardId !== undefined ? { kanbanBoardId: kanbanBoardId } : {}),
                updatedAt: new Date(),
            })
            .where(and(eq(aiPersonas.id, personaId), eq(aiPersonas.companyId, companyId)))
            .returning();

        // LOG: Verificar o que foi salvo
        console.log(`[PersonaAPI] Updated Record:`, { id: updated?.id, isTriggerActive: updated?.isTriggerActive });

        if (!updated) {
            return NextResponse.json({ error: 'Agente não encontrado ou não pertence à sua empresa.' }, { status: 404 });
        }

        // FORCE CACHE INVALIDATION
        revalidatePath(`/agentes-ia/${personaId}`);
        revalidatePath(`/agentes-ia`);

        if (ragWasActivated && promptToMigrate && promptToMigrate.trim().length > 0) {
            console.log('[PersonaAPI] RAG foi ativado em agente existente com systemPrompt - fazendo migração automática...');

            try {
                const sections = await parsePromptIntoSections(
                    promptToMigrate,
                    {
                        useAI: true,
                        defaultLanguage: 'pt',
                    },
                    companyId
                );

                console.log(`[PersonaAPI] Parser gerou ${sections.length} seções, salvando no banco...`);

                const sectionValues = sections.map(section => ({
                    personaId: updated.id,
                    sectionName: section.sectionName,
                    content: section.content,
                    language: section.language,
                    priority: section.priority,
                    tags: section.tags || [],
                    isActive: true,
                }));

                await db.insert(personaPromptSections).values(sectionValues);

                console.log(`[PersonaAPI] ✅ ${sections.length} seções RAG criadas - systemPrompt preservado`);

                return NextResponse.json({
                    ...updated,
                    _ragSectionsCreated: sections.length,
                });

            } catch (parserError) {
                console.error('[PersonaAPI] Erro ao fazer migração automática:', parserError);
                console.log('[PersonaAPI] Mantendo systemPrompt original, usuário pode migrar manualmente');
            }
        }

        if (updated) {
            apiCache.invalidatePattern(`ia-personas:${companyId}`);
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Erro ao atualizar agente:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ personaId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { personaId } = await params;

        await db.delete(aiPersonas)
            .where(and(eq(aiPersonas.id, personaId), eq(aiPersonas.companyId, companyId)));

        // Invalida cache
        apiCache.invalidatePattern(`ia-personas:${companyId}`);
        revalidatePath('/agentes-ia');

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Erro ao excluir agente:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
