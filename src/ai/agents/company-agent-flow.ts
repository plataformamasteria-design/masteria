'use server';

import { z } from 'zod';
import { getUserSession } from '@/app/actions';
import { db, aiChats, aiPersonas } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

// Definição dos Schemas (Recriados)
const CompanyAgentInputSchema = z.object({
    chatId: z.string(),
    query: z.string(),
});

const CompanyAgentOutputSchema = z.object({
    answer: z.string(),
});

// URL da API Externa (Python Microservice)
const EXTERNAL_API_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function companyAgent(input: z.infer<typeof CompanyAgentInputSchema>): Promise<z.infer<typeof CompanyAgentOutputSchema>> {
    try {
        const session = await getUserSession();
        const companyId = session.user?.companyId;

        if (!companyId) {
            throw new Error("Sessão inválida ou ID da empresa não encontrado.");
        }

        const { chatId, query } = input;

        // Buscar a persona associada ao chat (VALIDANDO O TENANT)
        const [chat] = await db.select({
            personaId: aiChats.personaId
        })
            .from(aiChats)
            .where(
                and(
                    eq(aiChats.id, chatId),
                    eq(aiChats.companyId, companyId)
                )
            );

        if (!chat || !chat.personaId) {
            throw new Error("Este chat não existe ou você não tem permissão para acessá-lo.");
        }

        const [persona] = await db.select()
            .from(aiPersonas)
            .where(
                and(
                    eq(aiPersonas.id, chat.personaId),
                    eq(aiPersonas.companyId, companyId)
                )
            );

        if (!persona) {
            throw new Error(`Agente de IA não encontrado ou acesso negado.`);
        }

        const userId = session.user?.id;
        if (!userId) {
            throw new Error("Sessão inválida: ID do usuário não encontrado.");
        }
        const response = await fetch(`${EXTERNAL_API_URL}/personas/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: query,
                company_id: companyId,
                persona_id: chat.personaId,
                contact_id: userId, // Usando userId como contact_id para rastreamento
                context: {
                    conversation_id: chatId,
                    source: 'zap-master-webapp',
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.error?.message || data.error || 'Erro desconhecido da API de IA.';
            throw new Error(`Erro da API de Agentes: ${errorMessage}`);
        }

        // A resposta da sua API já vem no formato esperado
        return CompanyAgentOutputSchema.parse({ answer: data.message });

    } catch (error) {
        console.error("[Company Agent Flow] Erro na chamada à API externa:", error);
        return CompanyAgentOutputSchema.parse({
            answer: `<b>Erro ao comunicar com o serviço de IA:</b> ${(error as Error).message}`
        });
    }
}
