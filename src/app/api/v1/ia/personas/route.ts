
// src/app/api/v1/ia/personas/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { aiPersonas, personaPromptSections } from '@/lib/db/schema';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { parsePromptIntoSections } from '@/lib/rag/prompt-parser';
import { getCachedOrFetch, CacheTTL, apiCache } from '@/lib/api-cache';
import { revalidatePath } from 'next/cache';

const personaCreateSchema = z.object({
    name: z.string().min(1, 'O nome é obrigatório.'),
    agentType: z.enum(['GENERAL', 'ATENDIMENTO', 'SDR', 'VENDAS', 'ONBOARDING', 'RELATOR']).optional().default('GENERAL'),
    systemPrompt: z.string().optional().nullable(),
    provider: z.preprocess(
        (value) => (value === 'OPENROUTER' ? 'GEMINI' : value),
        z.enum(['GEMINI'])
    ).optional(),
    model: z.string().min(1),
    credentialId: z.string().uuid().optional().nullable(),
    temperature: z.string(),
    topP: z.string(),
    maxOutputTokens: z.number().int().optional(),
    mcpServerUrl: z.string().url("A URL do servidor MCP é inválida.").optional().nullable(),
    mcpServerHeaders: z.record(z.string()).optional().nullable(),
    triggerKeywords: z.array(z.string()).optional(),
    isTriggerActive: z.boolean().optional().default(false),
    useRag: z.boolean().optional().default(false),
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
    audioMode: z.enum(['text', 'audio', 'both']).optional(),
    voiceProvider: z.enum(['gemini', 'elevenlabs']).optional(),
    voiceSettings: z.object({
        voiceId: z.string().optional(),
        speed: z.number().optional(),
        stability: z.number().optional(),
    }).optional(),
    // Agendamento
    enableScheduling: z.boolean().optional(),
    schedulingPrompt: z.string().optional().nullable(),
    meetingReminderEnabled: z.boolean().optional(),
    meetingReminderMinutes: z.number().int().optional(),
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



// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();

        const cacheKey = `ia-personas:${companyId}`;
        const personas = await getCachedOrFetch(cacheKey, async () => {
            return await db.query.aiPersonas.findMany({
                where: eq(aiPersonas.companyId, companyId),
                orderBy: desc(aiPersonas.createdAt),
            });
        }, CacheTTL.CONFIG_STATIC);

        return NextResponse.json(personas);
    } catch (error) {
        console.error('Erro ao buscar agentes:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}


export async function POST(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = personaCreateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }

        const [newPersona] = await db.insert(aiPersonas).values({
            companyId,
            ...parsed.data,
            provider: parsed.data.provider ?? 'GEMINI',
        }).returning();

        if (!newPersona) {
            return NextResponse.json({ error: 'Erro ao criar agente.' }, { status: 500 });
        }

        if (parsed.data.useRag && parsed.data.systemPrompt && parsed.data.systemPrompt.trim().length > 0) {
            console.log('[PersonaAPI] RAG ativo com systemPrompt preenchido - fazendo parsing automático...');

            try {
                const sections = await parsePromptIntoSections(
                    parsed.data.systemPrompt,
                    {
                        useAI: true,
                        defaultLanguage: 'pt',
                    },
                    companyId
                );

                console.log(`[PersonaAPI] Parser gerou ${sections.length} seções, salvando no banco...`);

                const sectionValues = sections.map(section => ({
                    personaId: newPersona.id,
                    sectionName: section.sectionName,
                    content: section.content,
                    language: section.language,
                    priority: section.priority,
                    tags: section.tags || [],
                    isActive: true,
                }));

                await db.transaction(async (tx) => {
                    await tx.insert(personaPromptSections).values(sectionValues);
                    await tx.update(aiPersonas)
                        .set({ systemPrompt: null })
                        .where(eq(aiPersonas.id, newPersona.id));
                });

                console.log(`[PersonaAPI] ✅ ${sections.length} seções criadas e systemPrompt limpo`);

                return NextResponse.json({
                    ...newPersona,
                    systemPrompt: null,
                    _ragSectionsCreated: sections.length,
                }, { status: 201 });

            } catch (parserError) {
                console.error('[PersonaAPI] Erro ao fazer parsing automático:', parserError);
                console.log('[PersonaAPI] Mantendo systemPrompt original, usuário pode migrar depois');
            }
        }

        // Invalida cache
        apiCache.invalidatePattern(`ia-personas:${companyId}`);
        revalidatePath('/agentes-ia');

        return NextResponse.json(newPersona, { status: 201 });

    } catch (error) {
        console.error('Erro ao criar agente:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
