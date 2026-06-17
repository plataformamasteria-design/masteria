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
                description: "Pausa ou ativa uma campanha de tráfego pago (Meta Ads) usando o ID numérico da campanha. OBRIGATÓRIO: Use apenas o ID numérico exato. Se você tiver apenas o nome da campanha, você DEVE buscar os IDs usando getPaidTrafficCampaigns antes de chamar esta função.",
                parameters: {
                    type: "object",
                    properties: {
                        campaignId: { type: "string", description: "O ID numérico exato da campanha no Meta Ads (ex: 12023939393)" },
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
                description: "Lista os leads atuais presentes em um Kanban/Funil específico. Permite filtrar opcionalmente por nome da etapa.",
                parameters: {
                    type: "object",
                    properties: { 
                        boardId: { type: "string", description: "ID do funil/board." },
                        stageName: { type: "string", description: "Nome exato da etapa para filtrar (opcional)." }
                    },
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
        },
        {
            type: "function" as const,
            function: {
                name: "createContactList",
                description: "Cria uma nova lista de transmissão/contatos.",
                parameters: {
                    type: "object",
                    properties: { 
                        name: { type: "string" },
                        description: { type: "string" }
                    },
                    required: ["name"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "createCampaign",
                description: "Cria e agenda (ou deixa em fila) uma campanha de disparos no WhatsApp.",
                parameters: {
                    type: "object",
                    properties: { 
                        name: { type: "string", description: "Nome da campanha" },
                        status: { type: "string", enum: ["QUEUED", "SCHEDULED"], description: "QUEUED para disparar logo após a criação, SCHEDULED para agendar" },
                        scheduledAt: { type: "string", description: "Data de agendamento em formato ISO (só se status for SCHEDULED)" },
                        contactListIds: { type: "array", items: { type: "string" }, description: "Array com IDs das listas alvo (opcional)" }
                    },
                    required: ["name", "status"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "submitWhatsAppTemplate",
                description: "Cria um template oficial de WhatsApp e envia para a aprovação da Meta.",
                parameters: {
                    type: "object",
                    properties: { 
                        name: { type: "string", description: "Nome do template (minúsculo sem espaços, ex: alerta_promo_1)" },
                        category: { type: "string", enum: ["MARKETING", "UTILITY", "AUTHENTICATION"] },
                        bodyText: { type: "string", description: "Texto principal do template (pode conter variáveis ex: {{1}})" }
                    },
                    required: ["name", "category", "bodyText"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "bulkToggleBot",
                description: "Ativa ou desativa a automação (robô) em massa para conversas recentes.",
                parameters: {
                    type: "object",
                    properties: { 
                        action: { type: "string", enum: ["enable", "disable"] },
                        daysAgo: { type: "number", description: "Afetar apenas leads que interagiram nos últimos X dias (ex: 7)" }
                    },
                    required: ["action", "daysAgo"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "searchContact",
                description: "Pesquisa contatos no CRM pelo nome, email ou telefone. Retorna o ID do contato e o ID da conversa mais recente, vitais para executar outras ações (como etiquetar ou resumir conversa).",
                parameters: {
                    type: "object",
                    properties: { 
                        query: { type: "string", description: "Nome, telefone ou email a pesquisar." }
                    },
                    required: ["query"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getContactLists",
                description: "Consulta e retorna todas as listas de transmissão/contatos disponíveis na empresa (IDs e nomes).",
                parameters: {
                    type: "object",
                    properties: { dummy: { type: "string" } },
                    required: [],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getKanbanBoards",
                description: "Consulta e retorna todos os funis (boards) do Kanban e suas respectivas etapas disponíveis.",
                parameters: {
                    type: "object",
                    properties: { dummy: { type: "string" } },
                    required: [],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getWhatsAppTemplates",
                description: "Consulta os templates de mensagem de WhatsApp da empresa e seus status de aprovação na Meta.",
                parameters: {
                    type: "object",
                    properties: { dummy: { type: "string" } },
                    required: [],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getPaidTrafficAccountInsights",
                description: "Busca as métricas gerais da conta de anúncios (Meta Ads). Puxa o total de gastos, leads, impressões e cliques consolidados da conta inteira.",
                parameters: {
                    type: "object",
                    properties: {
                        datePreset: { type: "string", description: "Período. Ex: today, yesterday, last_7d, last_30d, this_month, last_month. Padrão: last_30d" }
                    },
                    required: [],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getPaidTrafficAdSets",
                description: "Lista os conjuntos de anúncios de uma campanha específica no Meta Ads, incluindo suas métricas de performance (gasto, leads, etc).",
                parameters: {
                    type: "object",
                    properties: {
                        campaignId: { type: "string", description: "O ID da campanha no Meta Ads." },
                        datePreset: { type: "string", description: "Período. Ex: today, last_7d, last_30d. Padrão: last_30d" }
                    },
                    required: ["campaignId"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getPaidTrafficAds",
                description: "Lista os anúncios/criativos específicos de uma campanha ou de um conjunto de anúncios no Meta Ads e suas métricas.",
                parameters: {
                    type: "object",
                    properties: {
                        campaignId: { type: "string", description: "O ID da campanha (opcional, se passar adsetId não precisa)." },
                        adsetId: { type: "string", description: "O ID do conjunto de anúncios (opcional)." },
                        datePreset: { type: "string", description: "Período. Padrão: last_30d" }
                    },
                    required: [],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getPaidTrafficDemographics",
                description: "Faz análise de público / demografia no Meta Ads quebrando os resultados por idade, gênero, estado (region), país ou dispositivo.",
                parameters: {
                    type: "object",
                    properties: {
                        campaignId: { type: "string", description: "O ID da campanha." },
                        breakdown: { type: "string", enum: ["age", "gender", "age,gender", "country", "region", "impression_device", "publisher_platform"], description: "Qual quebra demográfica analisar." },
                        datePreset: { type: "string", description: "Período. Padrão: last_30d" }
                    },
                    required: ["campaignId", "breakdown"],
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

    let finalSystemMessage = "Você é o Masteria Copilot, um assistente inteligente com acesso administrativo TOTAL ao CRM do usuário.\nSua função é auxiliar o gestor respondendo perguntas, puxando métricas ou executando ações internas no sistema via ferramentas (tools).\nSeja objetivo e proativo. Nunca revele detalhes técnicos como 'executei a função X', diga apenas 'Puxei os dados do sistema e aqui estão...' ou 'Pronto, desativei o robô'.\nSe for questionado sobre métricas que você pode puxar, faça a chamada à ferramenta.";
    let finalUserMessage = prompt;

    // Se estivermos em um fluxo de automação (temos histórico), o 'prompt' enviado 
    // é na verdade o "Comando Mestre" do nó. A real mensagem do usuário já está no contextMessages.
    if (conversationId && contextMessages.length > 0) {
        finalSystemMessage = `${finalSystemMessage}\n\n[INSTRUÇÕES MESTRES (SYSTEM PROMPT)]:\n${prompt}`;
        // O usuário já falou no contextMessages, então o último "user" prompt força o modelo a agir
        finalUserMessage = `IMPORTANTE: A sua diretriz EXECUTIVA PRINCIPAL agora é: "${prompt}".\nUse o histórico da conversa apenas como contexto (por exemplo, para saber de qual lead estamos falando), mas cumpra rigorosamente a diretriz principal. Execute as ferramentas necessárias se for o caso.`;
    }

    const messages: any[] = [
        { role: "system", content: finalSystemMessage },
        ...contextMessages,
        { role: "user", content: finalUserMessage }
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
                    else if (tc.function.name === 'getPaidTrafficAccountInsights') {
                        try {
                            const { getMetaAuthForCompany } = await import('./meta-ads');
                            const { metaFetchPaginated } = await import('./meta-fetch');
                            const auth = await getMetaAuthForCompany(companyId);
                            const datePreset = args.datePreset || "last_30d";
                            const res = await metaFetchPaginated({
                                endpoint: "insights",
                                fields: "spend,impressions,clicks,actions,cpc,cpm,ctr",
                                account: auth.accountId,
                                token: auth.token,
                                params: { level: "account" },
                                datePreset
                            });
                            if (res.error) toolRes = { error: res.error };
                            else {
                                const data = res.data[0] || {};
                                let leads = 0;
                                if (data.actions) {
                                    const leadAction = (data.actions as any[]).find((a: any) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped' || a.action_type === 'leadgen_grouped');
                                    if (leadAction) leads = parseFloat(leadAction.value);
                                }
                                toolRes = {
                                    success: true,
                                    summary: `Relatório Geral da Conta (Período: ${datePreset})`,
                                    data: {
                                        spend: data.spend ? `R$ ${data.spend}` : "R$ 0.00",
                                        impressions: data.impressions || "0",
                                        clicks: data.clicks || "0",
                                        leads: leads,
                                        cpl: leads > 0 && data.spend ? `R$ ${(parseFloat(data.spend) / leads).toFixed(2)}` : "N/A",
                                        cpc: data.cpc || "N/A",
                                        ctr: data.ctr || "N/A"
                                    }
                                };
                            }
                        } catch (e: any) { toolRes = { error: e.message }; }
                    }
                    else if (tc.function.name === 'getPaidTrafficAdSets') {
                        try {
                            const { getMetaAuthForCompany } = await import('./meta-ads');
                            const { metaFetchPaginated } = await import('./meta-fetch');
                            const auth = await getMetaAuthForCompany(companyId);
                            const datePreset = args.datePreset || "last_30d";
                            const res = await metaFetchPaginated({
                                endpoint: "adsets",
                                fields: `id,name,effective_status,insights.date_preset(${datePreset}){spend,impressions,clicks,actions}`,
                                account: auth.accountId,
                                token: auth.token,
                                params: { filtering: JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: [args.campaignId] }]) }
                            });
                            if (res.error) toolRes = { error: res.error };
                            else {
                                toolRes = {
                                    success: true,
                                    adsets: res.data.map((c: any) => {
                                        const insights = c.insights?.data?.[0] || {};
                                        let leads = 0;
                                        if (insights.actions) {
                                            const leadAction = insights.actions.find((a: any) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped' || a.action_type === 'leadgen_grouped');
                                            if (leadAction) leads = parseFloat(leadAction.value);
                                        }
                                        return {
                                            id: c.id,
                                            name: c.name,
                                            status: c.effective_status,
                                            spend: insights.spend ? `R$ ${insights.spend}` : "R$ 0.00",
                                            impressions: insights.impressions || "0",
                                            clicks: insights.clicks || "0",
                                            leads: leads,
                                            cpl: leads > 0 && insights.spend ? `R$ ${(parseFloat(insights.spend) / leads).toFixed(2)}` : "N/A"
                                        };
                                    })
                                };
                            }
                        } catch (e: any) { toolRes = { error: e.message }; }
                    }
                    else if (tc.function.name === 'getPaidTrafficAds') {
                        try {
                            const { getMetaAuthForCompany } = await import('./meta-ads');
                            const { metaFetchPaginated } = await import('./meta-fetch');
                            const auth = await getMetaAuthForCompany(companyId);
                            const datePreset = args.datePreset || "last_30d";
                            const filtering = [];
                            if (args.adsetId) filtering.push({ field: "adset.id", operator: "EQUAL", value: [args.adsetId] });
                            else if (args.campaignId) filtering.push({ field: "campaign.id", operator: "EQUAL", value: [args.campaignId] });
                            const res = await metaFetchPaginated({
                                endpoint: "ads",
                                fields: `id,name,effective_status,insights.date_preset(${datePreset}){spend,impressions,clicks,actions}`,
                                account: auth.accountId,
                                token: auth.token,
                                params: filtering.length > 0 ? { filtering: JSON.stringify(filtering) } : {}
                            });
                            if (res.error) toolRes = { error: res.error };
                            else {
                                toolRes = {
                                    success: true,
                                    ads: res.data.map((c: any) => {
                                        const insights = c.insights?.data?.[0] || {};
                                        let leads = 0;
                                        if (insights.actions) {
                                            const leadAction = insights.actions.find((a: any) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped' || a.action_type === 'leadgen_grouped');
                                            if (leadAction) leads = parseFloat(leadAction.value);
                                        }
                                        return {
                                            id: c.id,
                                            name: c.name,
                                            status: c.effective_status,
                                            spend: insights.spend ? `R$ ${insights.spend}` : "R$ 0.00",
                                            impressions: insights.impressions || "0",
                                            clicks: insights.clicks || "0",
                                            leads: leads,
                                            cpl: leads > 0 && insights.spend ? `R$ ${(parseFloat(insights.spend) / leads).toFixed(2)}` : "N/A"
                                        };
                                    })
                                };
                            }
                        } catch (e: any) { toolRes = { error: e.message }; }
                    }
                    else if (tc.function.name === 'getPaidTrafficDemographics') {
                        try {
                            const { getMetaAuthForCompany } = await import('./meta-ads');
                            const { metaFetchPaginated } = await import('./meta-fetch');
                            const auth = await getMetaAuthForCompany(companyId);
                            const datePreset = args.datePreset || "last_30d";
                            const res = await metaFetchPaginated({
                                endpoint: "insights",
                                fields: "spend,impressions,clicks,actions",
                                account: auth.accountId,
                                token: auth.token,
                                params: { 
                                    level: "campaign",
                                    breakdowns: args.breakdown,
                                    filtering: JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: [args.campaignId] }])
                                },
                                datePreset
                            });
                            if (res.error) toolRes = { error: res.error };
                            else {
                                toolRes = {
                                    success: true,
                                    summary: `Análise Demográfica (${args.breakdown})`,
                                    data: res.data.map((d: any) => {
                                        let leads = 0;
                                        if (d.actions) {
                                            const leadAction = (d.actions as any[]).find((a: any) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped' || a.action_type === 'leadgen_grouped');
                                            if (leadAction) leads = parseFloat(leadAction.value);
                                        }
                                        const b1 = args.breakdown.split(',')[0];
                                        const b2 = args.breakdown.split(',')[1];
                                        const breakdownValue = b2 ? `${d[b1] || 'Unknown'} / ${d[b2] || 'Unknown'}` : (d[b1] || 'Unknown');
                                        return {
                                            breakdown_value: breakdownValue,
                                            spend: d.spend || "0",
                                            impressions: d.impressions || "0",
                                            clicks: d.clicks || "0",
                                            leads: leads,
                                            cpl: leads > 0 && d.spend ? (parseFloat(d.spend) / leads).toFixed(2) : "N/A"
                                        };
                                    })
                                };
                            }
                        } catch (e: any) { toolRes = { error: e.message }; }
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
                            let results = await db.query.kanbanLeads.findMany({
                                where: and(eq(kanbanLeads.companyId, companyId), eq(kanbanLeads.boardId, args.boardId)),
                                columns: {
                                    id: true,
                                    title: true,
                                    value: true,
                                    currentStage: true
                                }
                            });
                            if (args.stageName) {
                                results = results.filter(r => r.currentStage && (r.currentStage as any).title?.toLowerCase() === args.stageName.toLowerCase());
                            }
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
                    else if (tc.function.name === 'createContactList') {
                        try {
                            const { contactLists } = await import('./db/schema');
                            const inserted = await db.insert(contactLists).values({
                                companyId,
                                name: args.name,
                                description: args.description || ""
                            }).returning();
                            toolRes = { success: true, message: `Lista '${args.name}' criada com sucesso.`, data: inserted[0] };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'bulkToggleBot') {
                        try {
                            const { gte } = await import('drizzle-orm');
                            const dateThreshold = new Date();
                            dateThreshold.setDate(dateThreshold.getDate() - args.daysAgo);
                            
                            const isActive = args.action === 'enable';
                            const result = await db.update(conversations)
                                .set({ aiActive: isActive })
                                .where(and(eq(conversations.companyId, companyId), gte(conversations.lastMessageAt, dateThreshold)))
                                .returning({ id: conversations.id });
                                
                            toolRes = { success: true, message: `Robô ${isActive ? 'ativado' : 'desativado'} em massa para ${result.length} conversas recentes.` };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'createCampaign') {
                        try {
                            const connection = await db.query.connections.findFirst({
                                where: and(eq(connections.companyId, companyId), eq(connections.connectionType, 'meta_api'))
                            });
                            
                            if (!connection) throw new Error("Nenhuma conexão de API Oficial encontrada para disparar a campanha.");
                            
                            const inserted = await db.insert(campaigns).values({
                                companyId,
                                name: args.name,
                                status: args.status,
                                channel: "WHATSAPP",
                                scheduledAt: args.scheduledAt ? new Date(args.scheduledAt) : null,
                                connectionId: connection.id,
                                contactListIds: args.contactListIds || []
                            }).returning();
                            toolRes = { success: true, message: `Campanha '${args.name}' agendada/criada com sucesso!`, data: inserted[0] };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'submitWhatsAppTemplate') {
                        try {
                            const { messageTemplates } = await import('./db/schema');
                            const { submitTemplateToMeta } = await import('./metaTemplatesService');
                            
                            const connection = await db.query.connections.findFirst({
                                where: and(eq(connections.companyId, companyId), eq(connections.connectionType, 'meta_api')),
                                columns: { id: true, wabaId: true }
                            });
                            if (!connection || !connection.wabaId) throw new Error("Nenhuma conexão oficial com WABA ID encontrada.");
                            
                            const inserted = await db.insert(messageTemplates).values({
                                companyId,
                                connectionId: connection.id,
                                wabaId: connection.wabaId,
                                name: args.name,
                                category: args.category,
                                language: "pt_BR",
                                components: [
                                    { type: "BODY", text: args.bodyText }
                                ],
                                status: "DRAFT"
                            }).returning();
                            
                            const submissionResult = await submitTemplateToMeta(inserted[0].id);
                            
                            if (submissionResult.success) {
                                toolRes = { success: true, message: `Template submetido com sucesso! Status: ${submissionResult.status}`, metaId: submissionResult.metaTemplateId };
                            } else {
                                toolRes = { success: false, error: submissionResult.error };
                            }
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'searchContact') {
                        try {
                            const { ilike, or } = await import('drizzle-orm');
                            const q = `%${args.query}%`;
                            const cleanPhone = args.query.replace(/[^0-9]/g, '');
                            
                            const conditions = [
                                ilike(contacts.name, q),
                                ilike(contacts.email, q)
                            ];
                            if (cleanPhone.length > 5) {
                                conditions.push(ilike(contacts.phone, `%${cleanPhone}%`));
                            }
                            
                            const foundContacts = await db.query.contacts.findMany({
                                where: and(eq(contacts.companyId, companyId), or(...conditions)),
                                columns: { id: true, name: true, phone: true, email: true },
                                limit: 5
                            });
                            
                            if (foundContacts.length === 0) {
                                toolRes = { success: false, message: "Nenhum contato encontrado com essa pesquisa." };
                            } else {
                                const enriched = await Promise.all(foundContacts.map(async (c) => {
                                    const conv = await db.query.conversations.findFirst({
                                        where: eq(conversations.contactId, c.id),
                                        orderBy: [desc(conversations.lastMessageAt)],
                                        columns: { id: true }
                                    });
                                    return { ...c, conversationId: conv?.id || null };
                                }));
                                toolRes = { success: true, data: enriched };
                            }
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'getContactLists') {
                        try {
                            const { contactLists } = await import('./db/schema');
                            const lists = await db.query.contactLists.findMany({
                                where: eq(contactLists.companyId, companyId),
                                columns: { id: true, name: true, description: true }
                            });
                            toolRes = { success: true, data: lists };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'getKanbanBoards') {
                        try {
                            const boards = await db.query.kanbanBoards.findMany({
                                where: eq(kanbanBoards.companyId, companyId),
                                columns: { id: true, name: true, stages: true }
                            });
                            toolRes = { success: true, data: boards };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'getWhatsAppTemplates') {
                        try {
                            const { messageTemplates } = await import('./db/schema');
                            const templates = await db.query.messageTemplates.findMany({
                                where: eq(messageTemplates.companyId, companyId),
                                columns: { id: true, name: true, category: true, status: true, language: true },
                                orderBy: [desc(messageTemplates.createdAt)],
                                limit: 20
                            });
                            toolRes = { success: true, data: templates };
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
