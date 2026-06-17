import { generateText, tool } from 'ai';
import OpenAI from 'openai';
import { z } from 'zod';
import { db } from './db';
import { contacts, conversations, kanbanBoards, kanbanLeads, companies, aiChats, campaigns, connections, users, tags, contactsToTags, messages } from './db/schema';
import { eq, and, sql, desc, count, isNull, isNotNull } from 'drizzle-orm';
import { resolveAIKeys } from './ai-keys-resolver';

// Definição das ferramentas (tools) que dão poderes gerenciais à IA

function createCopilotTools(companyId: string) {
    return {
        getKanbanSummary: tool({
            description: 'Recupera um resumo completo do status do Kanban (funis e etapas) para a empresa atual, mostrando onde os leads estão parados.',
            parameters: z.object({
                boardId: z.string(),
            }),
            execute: async ({ boardId }: any) => {
                try {
                    const conditions = [eq(kanbanBoards.companyId, companyId)];
                    if (boardId && boardId !== "") conditions.push(eq(kanbanBoards.id, boardId));

                    let query = db.select({
                        boardName: kanbanBoards.name,
                        stageName: sql<string>`${kanbanLeads.currentStage}->>'title'`,
                        cardCount: count(kanbanLeads.id),
                        totalValue: sql<number>`SUM(COALESCE(${kanbanLeads.value}, 0)::numeric)`
                    })
                    .from(kanbanLeads)
                    .innerJoin(kanbanBoards, eq(kanbanLeads.boardId, kanbanBoards.id))
                    .where(and(...conditions))
                    .groupBy(kanbanBoards.name, sql`${kanbanLeads.currentStage}->>'title'`);

                    const results = await query;
                    return { success: true, data: results };
                } catch (error: any) {
                    return { success: false, error: error.message };
                }
            }
        }),

        getAgentWorkload: tool({
            description: 'Verifica a carga de trabalho dos atendentes, mostrando quantos leads estão atribuídos a cada agente atualmente.',
            parameters: z.object({
                dummy: z.string()
            }),
            execute: async (args: any) => {
                try {
                    const results = await db.select({
                        agentId: conversations.assignedTo,
                        agentName: users.name,
                        leadCount: count(conversations.id)
                    })
                    .from(conversations)
                    .leftJoin(users, eq(conversations.assignedTo, users.id))
                    .where(
                        and(
                            eq(conversations.companyId, companyId),
                            isNotNull(conversations.assignedTo)
                        )
                    )
                    .groupBy(conversations.assignedTo, users.name);

                    return { success: true, data: results };
                } catch (error: any) {
                    return { success: false, error: error.message };
                }
            }
        }),

        toggleLeadBot: tool({
            description: 'Ativa ou desativa a inteligência artificial (robô) para a conversa de um lead específico.',
            parameters: z.object({
                conversationId: z.string().describe('O ID da conversa do lead'),
                action: z.enum(['enable', 'disable']).describe('enable para ligar a IA, disable para desligar')
            }),
            execute: async ({ conversationId, action }: any) => {
                try {
                    const isActive = action === 'enable';
                    await db.update(conversations)
                        .set({ aiActive: isActive })
                        .where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));
                    
                    return { success: true, message: `Robô ${isActive ? 'ativado' : 'desativado'} com sucesso para a conversa.` };
                } catch (error: any) {
                    return { success: false, error: error.message };
                }
            }
        }),

        getActiveCampaigns: tool({
            description: 'Consulta o status de todas as campanhas de disparo em massa da empresa, incluindo quantas mensagens já foram enviadas.',
            parameters: z.object({
                dummy: z.string()
            }),
            execute: async (args: any) => {
                try {
                    const results = await db.query.campaigns.findMany({
                        where: eq(campaigns.companyId, companyId),
                        columns: {
                            id: true,
                            name: true,
                            status: true,
                            scheduledAt: true
                        },
                        orderBy: [desc(campaigns.createdAt)],
                        limit: 10
                    });
                    return { success: true, data: results };
                } catch (error: any) {
                    return { success: false, error: error.message };
                }
            }
        })
    };
}

/**
 * Motor central de execução do Assistente Copilot
 */
export async function executeCopilotCommand(prompt: string, companyId: string, conversationId?: string, historyLimit: number = 5) {
    const resolvedKeys = await resolveAIKeys(companyId);
    const OPENAI_KEY = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '';

    if (!OPENAI_KEY) {
        throw new Error('Nenhuma chave da OpenAI configurada na empresa ou no ambiente para rodar o Copilot.');
    }

    const openai = new OpenAI({ apiKey: OPENAI_KEY });
    
    let contactId: string | undefined;
    if (conversationId) {
        const conv = await db.query.conversations.findFirst({
            where: (conv, { eq }) => eq(conv.id, conversationId),
            columns: { contactId: true }
        });
        if (conv) contactId = conv.contactId;
    }
    
    const tools = [
        {
            type: "function" as const,
            function: {
                name: "getKanbanSummary",
                description: "Recupera um resumo completo do status do Kanban (funis e etapas) para a empresa atual, mostrando onde os leads estão parados.",
                parameters: {
                    type: "object",
                    properties: { boardId: { type: "string" } },
                    required: ["boardId"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getAgentWorkload",
                description: "Verifica a carga de trabalho dos atendentes, mostrando quantos leads estão atribuídos a cada agente atualmente.",
                parameters: {
                    type: "object",
                    properties: { dummy: { type: "string" } },
                    required: ["dummy"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "toggleLeadBot",
                description: "Ativa ou desativa a inteligência artificial (robô) para a conversa de um lead específico.",
                parameters: {
                    type: "object",
                    properties: { conversationId: { type: "string" }, action: { type: "string", enum: ["enable", "disable"] } },
                    required: ["conversationId", "action"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getActiveCampaigns",
                description: "Consulta o status de todas as campanhas de disparo em massa da empresa, incluindo quantas mensagens já foram enviadas.",
                parameters: {
                    type: "object",
                    properties: { dummy: { type: "string" } },
                    required: ["dummy"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getPaidTrafficCampaigns",
                description: "Busca os dados e métricas reais de campanhas de tráfego pago (Meta Ads / Facebook Ads), como investimento, cliques, leads e custo por lead. Permite filtrar por status, objetivo e período de data.",
                parameters: {
                    type: "object",
                    properties: {
                        status: { type: "string", enum: ["ACTIVE", "PAUSED", "ALL"], description: "Filtrar por status. Padrão é ALL." },
                        datePreset: { type: "string", description: "Período pré-definido. Ex: today, yesterday, last_7d, last_30d, this_month, last_month. Padrão: last_30d" },
                        objective: { type: "string", description: "Filtrar por objetivo (ex: OUTCOME_LEADS, OUTCOME_SALES). Opcional." }
                    },
                    required: [],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "setPaidTrafficCampaignStatus",
                description: "Pausa ou ativa uma campanha de tráfego pago (Meta Ads) usando o ID da campanha. Útil para pausar campanhas que não estão performando bem.",
                parameters: {
                    type: "object",
                    properties: {
                        campaignId: { type: "string", description: "O ID da campanha no Meta Ads" },
                        status: { type: "string", enum: ["ACTIVE", "PAUSED"], description: "O novo status da campanha" }
                    },
                    required: ["campaignId", "status"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "setPaidTrafficCampaignBudget",
                description: "Altera o orçamento diário de uma campanha de tráfego pago (Meta Ads) usando o ID da campanha. O valor deve ser em Reais (BRL).",
                parameters: {
                    type: "object",
                    properties: {
                        campaignId: { type: "string", description: "O ID da campanha no Meta Ads" },
                        dailyBudgetBRL: { type: "number", description: "O novo orçamento diário em Reais (ex: 50.50)" }
                    },
                    required: ["campaignId", "dailyBudgetBRL"],
                    additionalProperties: false
                }
        },
        {
            type: "function" as const,
            function: {
                name: "getTags",
                description: "Consulta e lista todas as etiquetas (tags) disponíveis no sistema com seus IDs, nomes e cores.",
                parameters: {
                    type: "object",
                    properties: { dummy: { type: "string" } },
                    required: ["dummy"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "createTag",
                description: "Cria uma nova etiqueta (tag) no sistema.",
                parameters: {
                    type: "object",
                    properties: { 
                        name: { type: "string", description: "Nome da etiqueta" },
                        color: { type: "string", description: "Cor da etiqueta em formato HEX (ex: #FF0000 para vermelho). Caso não forneça, use uma aleatória." }
                    },
                    required: ["name", "color"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "assignTagToLead",
                description: "Atribui uma etiqueta (tag) a um lead pelo ID da tag.",
                parameters: {
                    type: "object",
                    properties: { 
                        tagId: { type: "string", description: "O ID da etiqueta" },
                        contactId: { type: "string", description: "O ID do contato/lead. Se não informado, o sistema tenta usar o contato da conversa atual, mas é bom fornecer se souber." }
                    },
                    required: ["tagId"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getKanbanLeads",
                description: "Lista os leads atuais presentes em um Kanban/Funil específico.",
                parameters: {
                    type: "object",
                    properties: { boardId: { type: "string", description: "ID do funil/board." } },
                    required: ["boardId"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "moveKanbanLead",
                description: "Move um lead para outra etapa do Kanban.",
                parameters: {
                    type: "object",
                    properties: { 
                        leadId: { type: "string", description: "ID do lead no Kanban (tabela kanbanLeads)." },
                        newStageId: { type: "string", description: "ID da nova etapa para qual o lead vai." },
                        newStageTitle: { type: "string", description: "Título da nova etapa para preencher o json de currentStage." }
                    },
                    required: ["leadId", "newStageId", "newStageTitle"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getLeadAssignment",
                description: "Verifica qual atendente humano está associado a este lead/conversa.",
                parameters: {
                    type: "object",
                    properties: { conversationId: { type: "string", description: "Se vazio, usa a conversa atual do contexto." } },
                    required: [],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getLeadConversations",
                description: "Puxa as últimas 50 mensagens do lead atual para que você (a IA) possa ler e resumir a conversa.",
                parameters: {
                    type: "object",
                    properties: { conversationId: { type: "string", description: "Se vazio, usa a conversa atual do contexto." } },
                    required: [],
                    additionalProperties: false
                }
            }
        }
    ];

    let contextMessages: any[] = [];
    if (conversationId && historyLimit > 0) {
        try {
            const { messages } = await import('./db/schema');
            const recentMessages = await db.query.messages.findMany({
                where: (msg, { eq }) => eq(msg.conversationId, conversationId),
                orderBy: (msg, { desc }) => [desc(msg.sentAt)],
                limit: historyLimit
            });
            
            // Reverter para manter ordem cronológica (mais antigas primeiro)
            recentMessages.reverse();
            
            contextMessages = recentMessages.map(m => ({
                role: m.senderType === 'contact' ? "user" : "assistant",
                content: m.content || "(Mídia/Sistema)"
            }));
        } catch (e) {
            console.warn('[COPILOT-ENGINE] Failed to fetch history context:', e);
        }
    }

    const messages: any[] = [
        { role: "system", content: "Você é o Masteria Copilot, um assistente inteligente com acesso administrativo TOTAL ao CRM do usuário.\nSua função é auxiliar o gestor respondendo perguntas, puxando métricas ou executando ações internas no sistema via ferramentas (tools).\nSeja objetivo e proativo. Nunca revele detalhes técnicos como 'executei a função X', diga apenas 'Puxei os dados do sistema e aqui estão...' ou 'Pronto, desativei o robô'.\nSe for questionado sobre métricas que você pode puxar, faça a chamada à ferramenta." },
        ...contextMessages,
        { role: "user", content: prompt }
    ];

    let toolCallsCount = 0;
    const toolsObj: any = createCopilotTools(companyId);

    for (let step = 0; step < 5; step++) {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            tools: tools
        });

        const msg = response.choices[0].message;
        messages.push(msg);

        if (msg.tool_calls && msg.tool_calls.length > 0) {
            toolCallsCount += msg.tool_calls.length;
            for (const tc of msg.tool_calls) {
                let args = JSON.parse(tc.function.arguments || "{}");
                try {
                    let toolRes = null;
                    if (tc.function.name === 'getKanbanSummary') toolRes = await toolsObj.getKanbanSummary.execute(args, undefined as any);
                    else if (tc.function.name === 'getAgentWorkload') toolRes = await toolsObj.getAgentWorkload.execute(args, undefined as any);
                    else if (tc.function.name === 'toggleLeadBot') toolRes = await toolsObj.toggleLeadBot.execute(args, undefined as any);
                    else if (tc.function.name === 'getActiveCampaigns') toolRes = await toolsObj.getActiveCampaigns.execute(args, undefined as any);
                    else if (tc.function.name === 'getPaidTrafficCampaigns') {
                        try {
                            const { getMetaAuthForCompany } = await import('./meta-ads');
                            const { metaFetchPaginated } = await import('./meta-fetch');
                            
                            const auth = await getMetaAuthForCompany(companyId);
                            
                            const datePreset = args.datePreset || "last_30d";
                            const statusFilter = args.status && args.status !== "ALL" ? args.status : undefined;
                            
                            const customParams: any = {};
                            if (statusFilter) {
                                customParams.filtering = JSON.stringify([{ field: "effective_status", operator: "IN", value: [statusFilter] }]);
                            }

                            const res = await metaFetchPaginated({
                                endpoint: "campaigns",
                                fields: `id,name,effective_status,objective,insights.date_preset(${datePreset}){spend,impressions,clicks,actions}`,
                                account: auth.accountId,
                                token: auth.token,
                                params: customParams
                            });
                            
                            if (res.error) {
                                toolRes = { error: res.error };
                            } else {
                                let campaigns = res.data;
                                if (args.objective) {
                                    campaigns = campaigns.filter((c: any) => c.objective === args.objective);
                                }
                                
                                toolRes = {
                                    summary: `Dados de Tráfego Pago (Meta Ads) - Filtro Período: ${datePreset}`,
                                    campaigns: campaigns.map((c: any) => {
                                        const insights = c.insights?.data?.[0] || {};
                                        let leads = 0;
                                        if (insights.actions) {
                                            const leadAction = insights.actions.find((a: any) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped' || a.action_type === 'leadgen_grouped');
                                            if (leadAction) leads = parseFloat(leadAction.value);
                                        }
                                        return {
                                            id: c.id,
                                            campaign_name: c.name,
                                            status: c.effective_status,
                                            objective: c.objective,
                                            spend: insights.spend ? `R$ ${insights.spend}` : "R$ 0.00",
                                            impressions: insights.impressions || "0",
                                            clicks: insights.clicks || "0",
                                            leads: leads,
                                            cpl: leads > 0 && insights.spend ? `R$ ${(parseFloat(insights.spend) / leads).toFixed(2)}` : "N/A"
                                        };
                                    })
                                };
                            }
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'setPaidTrafficCampaignStatus') {
                        try {
                            const { getMetaAuthForCompany } = await import('./meta-ads');
                            const { updateStatus } = await import('./meta-write');
                            const auth = await getMetaAuthForCompany(companyId);
                            const res = await updateStatus(args.campaignId, args.status as any, auth.token);
                            
                            if (res.error) toolRes = { error: res.error };
                            else toolRes = { success: true, message: `Status da campanha alterado com sucesso para ${args.status}` };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'setPaidTrafficCampaignBudget') {
                        try {
                            const { getMetaAuthForCompany } = await import('./meta-ads');
                            const { updateBudget } = await import('./meta-write');
                            const auth = await getMetaAuthForCompany(companyId);
                            // O orçamento precisa ser enviado em centavos para a Meta API
                            const budgetInCents = Math.round(args.dailyBudgetBRL * 100);
                            const res = await updateBudget(args.campaignId, { daily_budget: budgetInCents }, auth.token);
                            
                            if (res.error) toolRes = { error: res.error };
                            else toolRes = { success: true, message: `Orçamento diário atualizado com sucesso para R$ ${args.dailyBudgetBRL}` };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'getTags') {
                        try {
                            const results = await db.query.tags.findMany({
                                where: eq(tags.companyId, companyId)
                            });
                            toolRes = { success: true, data: results };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'createTag') {
                        try {
                            const { name, color } = args;
                            const newColor = color || `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
                            const inserted = await db.insert(tags).values({
                                companyId,
                                name,
                                color: newColor
                            }).returning();
                            toolRes = { success: true, message: `Etiqueta '${name}' criada com sucesso`, data: inserted[0] };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'assignTagToLead') {
                        try {
                            const targetContactId = args.contactId || contactId;
                            if (!targetContactId) throw new Error("Contact ID não fornecido e não foi possível inferir da conversa.");
                            
                            await db.insert(contactsToTags).values({
                                companyId,
                                contactId: targetContactId,
                                tagId: args.tagId
                            });
                            toolRes = { success: true, message: `Etiqueta atribuída com sucesso ao contato.` };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'getKanbanLeads') {
                        try {
                            const results = await db.query.kanbanLeads.findMany({
                                where: and(eq(kanbanLeads.companyId, companyId), eq(kanbanLeads.boardId, args.boardId)),
                                columns: {
                                    id: true,
                                    title: true,
                                    value: true,
                                    currentStage: true
                                }
                            });
                            toolRes = { success: true, count: results.length, data: results };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'moveKanbanLead') {
                        try {
                            await db.update(kanbanLeads)
                                .set({ currentStage: { id: args.newStageId, title: args.newStageTitle } })
                                .where(and(eq(kanbanLeads.id, args.leadId), eq(kanbanLeads.companyId, companyId)));
                            toolRes = { success: true, message: `Lead movido com sucesso para a etapa ${args.newStageTitle}` };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'getLeadAssignment') {
                        try {
                            const targetConvId = args.conversationId || conversationId;
                            if (!targetConvId) throw new Error("ID da conversa não fornecido.");
                            
                            const results = await db.select({
                                agentId: users.id,
                                agentName: users.name,
                                agentEmail: users.email
                            })
                            .from(conversations)
                            .leftJoin(users, eq(conversations.assignedTo, users.id))
                            .where(eq(conversations.id, targetConvId));
                            
                            if (results.length === 0) throw new Error("Conversa não encontrada.");
                            
                            const agent = results[0];
                            if (agent.agentId) {
                                toolRes = { success: true, message: "Lead está atribuído a um atendente humano.", agent };
                            } else {
                                toolRes = { success: true, message: "Lead NÃO está atribuído a nenhum atendente humano no momento." };
                            }
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'getLeadConversations') {
                        try {
                            const targetConvId = args.conversationId || conversationId;
                            if (!targetConvId) throw new Error("ID da conversa não fornecido.");
                            
                            const history = await db.query.messages.findMany({
                                where: eq(messages.conversationId, targetConvId),
                                orderBy: [desc(messages.sentAt)],
                                limit: 50,
                                columns: {
                                    content: true,
                                    senderType: true,
                                    isAiGenerated: true,
                                    sentAt: true
                                }
                            });
                            history.reverse();
                            toolRes = { success: true, messages: history };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    
                    messages.push({
                        role: "tool",
                        tool_call_id: tc.id,
                        content: JSON.stringify(toolRes)
                    });
                } catch (e: any) {
                    messages.push({
                        role: "tool",
                        tool_call_id: tc.id,
                        content: JSON.stringify({ success: false, error: e.message })
                    });
                }
            }
        } else {
            return {
                reply: msg.content || '',
                toolCalls: new Array(toolCallsCount)
            };
        }
    }

    return {
        reply: messages[messages.length - 1]?.content || "Processamento concluído após coletar os dados.",
        toolCalls: new Array(toolCallsCount)
    };
}
