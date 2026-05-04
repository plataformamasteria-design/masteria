// src/app/api/v1/ia/personas/[personaId]/duplicate/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { aiPersonas, personaPromptSections } from '@/lib/db/schema';
import { getCompanyIdFromSession } from '@/app/actions';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ personaId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { personaId } = await params;

        const [originalAgent] = await db.select()
            .from(aiPersonas)
            .where(and(eq(aiPersonas.id, personaId), eq(aiPersonas.companyId, companyId)));

        if (!originalAgent) {
            return NextResponse.json({ error: 'Agente não encontrado ou não pertence à sua empresa.' }, { status: 404 });
        }

        const duplicatedName = `${originalAgent.name} (Cópia)`;

        const [newAgent] = await db.insert(aiPersonas).values({
            companyId,
            name: duplicatedName,
            agentType: originalAgent.agentType,
            systemPrompt: originalAgent.systemPrompt,
            provider: originalAgent.provider,
            model: originalAgent.model,
            credentialId: originalAgent.credentialId,
            temperature: originalAgent.temperature,
            topP: originalAgent.topP,
            maxOutputTokens: originalAgent.maxOutputTokens,
            mcpServerUrl: originalAgent.mcpServerUrl,
            mcpServerHeaders: originalAgent.mcpServerHeaders,
            useRag: originalAgent.useRag,
            firstResponseMinDelay: originalAgent.firstResponseMinDelay,
            firstResponseMaxDelay: originalAgent.firstResponseMaxDelay,
            followupResponseMinDelay: originalAgent.followupResponseMinDelay,
            followupResponseMaxDelay: originalAgent.followupResponseMaxDelay,
        }).returning();

        if (!newAgent) {
            return NextResponse.json({ error: 'Erro ao duplicar agente.' }, { status: 500 });
        }

        if (originalAgent.useRag) {
            const originalSections = await db.select()
                .from(personaPromptSections)
                .where(eq(personaPromptSections.personaId, personaId));

            if (originalSections.length > 0) {
                const duplicatedSections = originalSections.map(section => ({
                    personaId: newAgent.id,
                    sectionName: section.sectionName,
                    content: section.content,
                    language: section.language,
                    priority: section.priority,
                    tags: section.tags || [],
                    isActive: section.isActive,
                }));

                await db.insert(personaPromptSections).values(duplicatedSections);
                console.log(`[PersonaAPI] ✅ Duplicadas ${duplicatedSections.length} seções RAG para novo agente`);
            }
        }

        console.log(`[PersonaAPI] ✅ Agente "${originalAgent.name}" duplicado como "${duplicatedName}"`);

        return NextResponse.json(newAgent, { status: 201 });

    } catch (error) {
        console.error('Erro ao duplicar agente:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
