import { generateText, tool } from 'ai';
import OpenAI from 'openai';
import { z } from 'zod';
import { db } from './db';
import { contacts, conversations, kanbanBoards, kanbanLeads, companies, aiChats, campaigns, connections, users, tags, contactsToTags, messages as messagesTable } from './db/schema';
import { eq, and, sql, desc, count, isNull, isNotNull } from 'drizzle-orm';
import { resolveAIKeys } from './ai-keys-resolver';

// Definição das ferramentas (tools) que dão poderes gerenciais à IA

function createCopilotTools(companyId: string, conversationId?: string) {
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
                        stages: kanbanBoards.stages,
                        stageId: kanbanLeads.stageId,
                        cardCount: count(kanbanLeads.id),
                        totalValue: sql<number>`SUM(COALESCE(${kanbanLeads.value}, 0)::numeric)`
                    })
                    .from(kanbanLeads)
                    .innerJoin(kanbanBoards, eq(kanbanLeads.boardId, kanbanBoards.id))
                    .where(and(...conditions))
                    .groupBy(kanbanBoards.name, kanbanBoards.stages, kanbanLeads.stageId);

                    const resultsRaw = await query;
                    
                    const results = resultsRaw.map(r => {
                        let sName = "Desconhecido";
                        if (r.stages && Array.isArray(r.stages)) {
                            const found = (r.stages as any[]).find(s => s.id === r.stageId);
                            if (found) sName = found.title;
                        }
                        return {
                            boardName: r.boardName,
                            stageName: sName,
                            cardCount: r.cardCount,
                            totalValue: r.totalValue
                        };
                    });

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
        }),
        scheduleAction: tool({
            description: 'Agenda uma ação para o Copilot executar no futuro (ex: "Me lembre disso amanhã às 18:00", "Envie o resumo no dia tal"). ATENÇÃO: Informe a data e hora absolutas em formato ISO.',
            parameters: z.object({
                prompt: z.string().describe('O comando exato que você deve executar no futuro (ex: "Enviar o resumo dos atendimentos de hoje")'),
                executeAt: z.string().describe('A data e hora (em formato ISO 8601, ex: 2026-06-18T18:00:00-03:00) em que a ação deve ser executada.')
            }),
            execute: async ({ prompt, executeAt }: any) => {
                try {
                    const { copilotScheduledTasks, conversations } = await import('./db/schema');
                    let contactId = null;
                    if (conversationId) {
                        const conv = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
                        if (conv) contactId = conv.contactId;
                    }

                    await db.insert(copilotScheduledTasks).values({
                        companyId,
                        contactId,
                        conversationId,
                        prompt,
                        executeAt: new Date(executeAt),
                        status: 'pending'
                    });
                    return { success: true, message: `Ação "${prompt}" agendada com sucesso para ${new Date(executeAt).toLocaleString('pt-BR')}.` };
                } catch (e: any) {
                    return { success: false, error: e.message };
                }
            }
        }),
        listScheduledActions: tool({
            description: 'Lista todas as ações do Copilot que estão agendadas para o futuro nesta conversa/lead.',
            parameters: z.object({ dummy: z.string().optional() }),
            execute: async () => {
                try {
                    const { copilotScheduledTasks } = await import('./db/schema');
                    if (!conversationId) return { success: false, error: "Sem contexto de conversa ativo." };
                    
                    const tasks = await db.query.copilotScheduledTasks.findMany({
                        where: and(
                            eq(copilotScheduledTasks.conversationId, conversationId),
                            eq(copilotScheduledTasks.status, 'pending')
                        )
                    });
                    return { success: true, data: tasks };
                } catch (e: any) {
                    return { success: false, error: e.message };
                }
            }
        }),
        cancelScheduledAction: tool({
            description: 'Cancela uma ação programada usando o ID retornado pelo listScheduledActions.',
            parameters: z.object({
                taskId: z.string().describe('O ID da tarefa agendada')
            }),
            execute: async ({ taskId }: any) => {
                try {
                    const { copilotScheduledTasks } = await import('./db/schema');
                    await db.update(copilotScheduledTasks)
                        .set({ status: 'cancelled', updatedAt: new Date() })
                        .where(eq(copilotScheduledTasks.id, taskId));
                    return { success: true, message: "Ação cancelada com sucesso." };
                } catch (e: any) {
                    return { success: false, error: e.message };
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
                description: "Pausa ou ativa uma campanha de tráfego pago (Meta Ads) usando o ID numérico da campanha. OBRIGATÓRIO: Use apenas o ID numérico exato (ex: 12023939393). NUNCA envie o nome. Se você tiver apenas o nome da campanha, você DEVE buscar os IDs usando getPaidTrafficCampaigns antes de chamar esta função.",
                parameters: {
                    type: "object",
                    properties: {
                        campaignId: { type: "string", description: "O ID numérico exato da campanha no Meta Ads. APENAS NÚMEROS." },
                        status: { type: "string", enum: ["ACTIVE", "PAUSED"], description: "O novo status da campanha. OBRIGATÓRIO: Use 'ACTIVE' para ativar e 'PAUSED' para desativar/pausar." }
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
                    properties: { conversationId: { type: "string", description: "OBRIGATÓRIO: Use o ID DA CONVERSA (conversationId) retornado pelo searchContact. Não confunda com o ID do contato. Se você não tem o conversationId, pesquise o contato primeiro." } },
                    required: ["conversationId"],
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
                description: "Cria e agenda (ou deixa em fila) uma campanha de disparos no WhatsApp. Para templates oficiais, SEMPRE use batchDelaySeconds 0.",
                parameters: {
                    type: "object",
                    properties: { 
                        name: { type: "string", description: "Nome da campanha" },
                        status: { type: "string", enum: ["QUEUED", "SCHEDULED"], description: "QUEUED para disparar logo após a criação, SCHEDULED para agendar" },
                        scheduledAt: { type: "string", description: "Data de agendamento em formato ISO (só se status for SCHEDULED)" },
                        contactListIds: { type: "array", items: { type: "string" }, description: "Array com IDs das listas alvo (opcional)" },
                        connectionId: { type: "string", description: "ID da conexão (número remetente) escolhida." },
                        templateId: { type: "string", description: "ID do template de mensagem escolhido." },
                        batchDelaySeconds: { type: "number", description: "Atraso entre mensagens. Use 0 para disparos da API Oficial." }
                    },
                    required: ["name", "status", "connectionId"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "getOfficialConnections",
                description: "Busca e lista todas as conexões (números) da API Oficial da Meta ativas. Essencial para perguntar ao usuário de qual número ele quer disparar a campanha.",
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
                name: "submitWhatsAppTemplate",
                description: "Cria um template oficial de WhatsApp avançado e envia para a aprovação da Meta. Suporta imagem/texto no cabeçalho e botões.",
                parameters: {
                    type: "object",
                    properties: { 
                        name: { type: "string", description: "Nome único do template (minúsculo sem espaços, ex: alerta_promo_1)" },
                        category: { type: "string", enum: ["MARKETING", "UTILITY", "AUTHENTICATION"] },
                        bodyText: { type: "string", description: "Texto principal do template (pode conter variáveis ex: {{1}})" },
                        headerType: { type: "string", enum: ["NONE", "TEXT", "IMAGE", "DOCUMENT"], description: "Tipo de cabeçalho do template (Opcional, padrão NONE)." },
                        headerContent: { type: "string", description: "Se headerType for TEXT, passe o texto. Se for IMAGE, passe uma URL pública de imagem de exemplo. Opcional." },
                        buttons: { 
                            type: "array", 
                            description: "Lista de botões para o template (Opcional)",
                            items: {
                                type: "object",
                                properties: {
                                    type: { type: "string", enum: ["QUICK_REPLY", "URL"] },
                                    text: { type: "string", description: "Texto do botão" },
                                    url: { type: "string", description: "Obrigatório se type for URL (pode incluir variáveis {{1}} no final da url)" }
                                },
                                required: ["type", "text"]
                            }
                        }
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
                description: "Pesquisa contatos no CRM pelo nome, email ou telefone. Retorna o ID do contato e o ID da conversa mais recente, vitais para executar outras ações.",
                parameters: {
                    type: "object",
                    properties: { 
                        query: { type: "string", description: "Nome, telefone ou email a pesquisar. Se for telefone, mande apenas os dígitos que possui (ex: 7585 ou 88920008007)." }
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
                        datePreset: { type: "string", description: "Período. Ex: today, yesterday, last_7d, last_30d, this_month, last_month. Padrão: last_30d" },
                        since: { type: "string", description: "Data inicial no formato YYYY-MM-DD. Use apenas se o usuário pedir um período muito específico." },
                        until: { type: "string", description: "Data final no formato YYYY-MM-DD." }
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
                        datePreset: { type: "string", description: "Período. Ex: today, last_7d, last_30d. Padrão: last_30d" },
                        since: { type: "string", description: "Data inicial (YYYY-MM-DD)" },
                        until: { type: "string", description: "Data final (YYYY-MM-DD)" }
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
                        datePreset: { type: "string", description: "Período. Padrão: last_30d" },
                        since: { type: "string", description: "Data inicial (YYYY-MM-DD)" },
                        until: { type: "string", description: "Data final (YYYY-MM-DD)" }
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
                        campaignId: { type: "string", description: "O ID numérico da campanha. APENAS NÚMEROS. NUNCA envie nomes ou colchetes." },
                        breakdown: { type: "string", enum: ["age", "gender", "age,gender", "country", "region", "impression_device", "publisher_platform"], description: "Qual quebra demográfica analisar." },
                        datePreset: { type: "string", description: "Período. Padrão: last_30d" },
                        since: { type: "string", description: "Data inicial (YYYY-MM-DD)" },
                        until: { type: "string", description: "Data final (YYYY-MM-DD)" }
                    },
                    required: ["campaignId", "breakdown"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "importLeadListFromDocument",
                description: "Importa leads de uma planilha CSV ou Excel (xlsx) recém-enviada e cria uma Lista de Contatos. Extrai os dados nativamente e usa IA apenas para entender quais colunas são telefone, nome e email.",
                parameters: {
                    type: "object",
                    properties: {
                        documentUrl: { type: "string", description: "A URL do documento (mediaUrl) enviada na conversa anterior [ARQUIVO ANEXADO: url]." },
                        listName: { type: "string", description: "O nome sugerido para a nova lista de contatos." }
                    },
                    required: ["documentUrl", "listName"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "sendDirectMessage",
                description: "Envia uma mensagem de texto simples diretamente para um lead/contato. IMPORTANTE: Só funciona se a janela de 24 horas estiver aberta (o lead interagiu recentemente). OBRIGATÓRIO ter o conversationId.",
                parameters: {
                    type: "object",
                    properties: {
                        conversationId: { type: "string", description: "O ID da conversa (obtido via searchContact se você não tiver no contexto)." },
                        text: { type: "string", description: "O conteúdo da mensagem a ser enviada." }
                    },
                    required: ["conversationId", "text"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "syncWhatsAppTemplates",
                description: "Força a sincronização do status de todos os templates pendentes com a API da Meta. Use sempre que o usuário perguntar se um template já foi aprovado.",
                parameters: {
                    type: "object",
                    properties: { dummy: { type: "string" } },
                    required: [],
                    additionalProperties: false
                }
            }
        }
    ];

    tools.push(
        {
            type: "function" as const,
            function: {
                name: "scheduleAction",
                description: 'Agenda uma ação para o Copilot executar no futuro (ex: "Me lembre disso amanhã às 18:00", "Envie o resumo no dia tal"). ATENÇÃO: Informe a data e hora absolutas em formato ISO.',
                parameters: {
                    type: "object",
                    properties: {
                        prompt: { type: "string", description: 'O comando exato que você deve executar no futuro (ex: "Enviar o resumo dos atendimentos de hoje")' },
                        executeAt: { type: "string", description: 'A data e hora (em formato ISO 8601, ex: 2026-06-18T18:00:00-03:00) em que a ação deve ser executada.' }
                    },
                    required: ["prompt", "executeAt"],
                    additionalProperties: false
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "listScheduledActions",
                description: 'Lista todas as ações do Copilot que estão agendadas para o futuro nesta conversa/lead.',
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
                name: "cancelScheduledAction",
                description: 'Cancela uma ação programada usando o ID retornado pelo listScheduledActions.',
                parameters: {
                    type: "object",
                    properties: {
                        taskId: { type: "string", description: "O ID da tarefa agendada" }
                    },
                    required: ["taskId"],
                    additionalProperties: false
                }
            }
        }
    );

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
            
            contextMessages = recentMessages.map(m => {
                let content = m.content || "";
                if (m.mediaUrl && (m.contentType === 'DOCUMENT' || m.mediaUrl.endsWith('.csv') || m.mediaUrl.endsWith('.xlsx'))) {
                    content += `\n[ARQUIVO ANEXADO: ${m.mediaUrl}]`;
                }
                return {
                    role: m.senderType === 'contact' ? "user" : "assistant",
                    content: content.trim() || "(Mídia/Sistema sem texto)"
                };
            });
        } catch (e) {
            console.warn('[COPILOT-ENGINE] Failed to fetch history context:', e);
        }
    }

    let finalSystemMessage = `Você é o Masteria Copilot, um assistente inteligente com acesso administrativo TOTAL ao CRM do usuário.\nA data e hora atual do sistema é: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.\nSua função é auxiliar o gestor respondendo perguntas, puxando métricas ou executando ações internas no sistema via ferramentas (tools).\nSeja objetivo e proativo. Nunca revele detalhes técnicos como 'executei a função X', diga apenas 'Puxei os dados do sistema e aqui estão...' ou 'Pronto, desativei o robô'.\nSe for questionado sobre métricas que você pode puxar, faça a chamada à ferramenta.\n\nREGRAS PARA DISPARO DE TEMPLATES (API OFICIAL):\n1. Use a ferramenta getOfficialConnections para listar as conexões oficiais disponíveis.\n2. Pergunte SEMPRE ao usuário qual número ele deseja usar para o disparo, a menos que ele já tenha especificado.\n3. Após a escolha do número, use a ferramenta createCampaign com batchDelaySeconds = 0 e status = "QUEUED" (a menos que ele peça para agendar).\n4. Se o usuário pedir para listar os templates, use getWhatsAppTemplates.`;
    let finalUserMessage = prompt;

    // Se estivermos em um fluxo de automação (temos histórico), o 'prompt' enviado 
    // é na verdade o "Comando Mestre" do nó. A real mensagem do usuário já está no contextMessages.
    if (conversationId && contextMessages.length > 0) {
        finalSystemMessage = `${finalSystemMessage}\n\n[DIRETRIZ EXECUTIVA PRINCIPAL DA AUTOMAÇÃO]:\n"${prompt}"\n\nATENÇÃO: A sua prioridade máxima é cumprir essa diretriz executiva, usando as ferramentas necessárias. Use o histórico da conversa com o usuário apenas como contexto para entender a situação ou responder à pergunta dele, mas não deixe de cumprir a Diretriz!`;
        finalUserMessage = ""; // A mensagem do usuário já está em contextMessages
    }

    const messages: any[] = [
        { role: "system", content: finalSystemMessage },
        ...contextMessages
    ];
    if (finalUserMessage) {
        messages.push({ role: "user", content: finalUserMessage });
    }

    let toolCallsCount = 0;
    const toolsObj: any = createCopilotTools(companyId, conversationId);

    for (let step = 0; step < 5; step++) {
        // Identificar a chamada do modelo de acordo com o que foi configurado
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
                    else if (tc.function.name === 'scheduleAction') toolRes = await toolsObj.scheduleAction.execute(args, undefined as any);
                    else if (tc.function.name === 'listScheduledActions') toolRes = await toolsObj.listScheduledActions.execute(args, undefined as any);
                    else if (tc.function.name === 'cancelScheduledAction') toolRes = await toolsObj.cancelScheduledAction.execute(args, undefined as any);
                    else if (tc.function.name === 'getPaidTrafficCampaigns') {
                        try {
                            const { getMetaAuthForCompany } = await import('./meta-ads');
                            const { metaFetchPaginated } = await import('./meta-fetch');
                            
                            const auth = await getMetaAuthForCompany(companyId);
                            
                            let insightsField = "";
                            let dateLabel = "";
                            if (args.since && args.until) {
                                insightsField = `insights.time_range({"since":"${args.since}","until":"${args.until}"})`;
                                dateLabel = `${args.since} a ${args.until}`;
                            } else {
                                const datePreset = args.datePreset || "last_30d";
                                insightsField = `insights.date_preset(${datePreset})`;
                                dateLabel = datePreset;
                            }

                            const statusFilter = args.status && args.status !== "ALL" ? args.status : undefined;
                            
                            const customParams: any = {};
                            if (statusFilter) {
                                customParams.filtering = JSON.stringify([{ field: "effective_status", operator: "IN", value: [statusFilter] }]);
                            }

                            const res = await metaFetchPaginated({
                                endpoint: "campaigns",
                                fields: `id,name,effective_status,objective,${insightsField}{spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,inline_link_clicks,cost_per_inline_link_click,actions}`,
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
                                    summary: `Dados de Tráfego Pago (Meta Ads) - Filtro Período: ${dateLabel}`,
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
                                            reach: insights.reach || "0",
                                            frequency: insights.frequency || "0",
                                            clicks: insights.clicks || "0",
                                            link_clicks: insights.inline_link_clicks || "0",
                                            cpc: insights.cpc ? `R$ ${insights.cpc}` : "N/A",
                                            cpm: insights.cpm ? `R$ ${insights.cpm}` : "N/A",
                                            ctr: insights.ctr ? `${insights.ctr}%` : "N/A",
                                            cplc: insights.cost_per_inline_link_click ? `R$ ${insights.cost_per_inline_link_click}` : "N/A",
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
                            let dateLabel = "";
                            const params: any = { level: "account" };
                            
                            if (args.since && args.until) {
                                params.time_range = JSON.stringify({ since: args.since, until: args.until });
                                dateLabel = `${args.since} a ${args.until}`;
                            } else {
                                params.date_preset = args.datePreset || "last_30d";
                                dateLabel = args.datePreset || "last_30d";
                            }

                            const res = await metaFetchPaginated({
                                endpoint: "insights",
                                fields: "spend,impressions,clicks,actions,cpc,cpm,ctr",
                                account: auth.accountId,
                                token: auth.token,
                                params
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
                                    summary: `Relatório Geral da Conta (Período: ${dateLabel})`,
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
                            
                            let insightsField = "";
                            if (args.since && args.until) {
                                insightsField = `insights.time_range({"since":"${args.since}","until":"${args.until}"})`;
                            } else {
                                const datePreset = args.datePreset || "last_30d";
                                insightsField = `insights.date_preset(${datePreset})`;
                            }

                            const res = await metaFetchPaginated({
                                endpoint: "adsets",
                                fields: `id,name,effective_status,targeting,${insightsField}{spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,inline_link_clicks,cost_per_inline_link_click,actions}`,
                                account: auth.accountId,
                                token: auth.token,
                                params: { filtering: JSON.stringify([{ field: "campaign.id", operator: "IN", value: [args.campaignId] }]) }
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
                                            reach: insights.reach || "0",
                                            frequency: insights.frequency || "0",
                                            clicks: insights.clicks || "0",
                                            link_clicks: insights.inline_link_clicks || "0",
                                            cpc: insights.cpc ? `R$ ${insights.cpc}` : "N/A",
                                            cpm: insights.cpm ? `R$ ${insights.cpm}` : "N/A",
                                            ctr: insights.ctr ? `${insights.ctr}%` : "N/A",
                                            cplc: insights.cost_per_inline_link_click ? `R$ ${insights.cost_per_inline_link_click}` : "N/A",
                                            leads: leads,
                                            cpl: leads > 0 && insights.spend ? `R$ ${(parseFloat(insights.spend) / leads).toFixed(2)}` : "N/A",
                                            targeting: c.targeting ? {
                                                age_min: c.targeting.age_min,
                                                age_max: c.targeting.age_max,
                                                geo_locations: c.targeting.geo_locations,
                                                interests: c.targeting.flexible_spec,
                                                custom_audiences: c.targeting.custom_audiences
                                            } : null
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
                            
                            let insightsField = "";
                            if (args.since && args.until) {
                                insightsField = `insights.time_range({"since":"${args.since}","until":"${args.until}"})`;
                            } else {
                                const datePreset = args.datePreset || "last_30d";
                                insightsField = `insights.date_preset(${datePreset})`;
                            }

                            const filtering = [];
                            if (args.adsetId) filtering.push({ field: "adset.id", operator: "IN", value: [args.adsetId] });
                            else if (args.campaignId) filtering.push({ field: "campaign.id", operator: "IN", value: [args.campaignId] });
                            const res = await metaFetchPaginated({
                                endpoint: "ads",
                                fields: `id,name,effective_status,creative{name,body,title,call_to_action_type,image_url,thumbnail_url,object_story_spec},${insightsField}{spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,inline_link_clicks,cost_per_inline_link_click,actions}`,
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
                                            reach: insights.reach || "0",
                                            frequency: insights.frequency || "0",
                                            clicks: insights.clicks || "0",
                                            link_clicks: insights.inline_link_clicks || "0",
                                            cpc: insights.cpc ? `R$ ${insights.cpc}` : "N/A",
                                            cpm: insights.cpm ? `R$ ${insights.cpm}` : "N/A",
                                            ctr: insights.ctr ? `${insights.ctr}%` : "N/A",
                                            cplc: insights.cost_per_inline_link_click ? `R$ ${insights.cost_per_inline_link_click}` : "N/A",
                                            leads: leads,
                                            cpl: leads > 0 && insights.spend ? `R$ ${(parseFloat(insights.spend) / leads).toFixed(2)}` : "N/A",
                                            creative: c.creative ? {
                                                body: c.creative.body || c.creative.object_story_spec?.link_data?.message || c.creative.object_story_spec?.video_data?.message || "N/A",
                                                title: c.creative.title || c.creative.object_story_spec?.link_data?.name || c.creative.object_story_spec?.video_data?.title || "N/A",
                                                cta: c.creative.call_to_action_type || c.creative.object_story_spec?.link_data?.call_to_action?.type || c.creative.object_story_spec?.video_data?.call_to_action?.type || "N/A",
                                                image_url: c.creative.image_url || c.creative.thumbnail_url || "N/A"
                                            } : null
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
                            
                            let dateLabel = "";
                            const params: any = { 
                                level: "campaign",
                                breakdowns: args.breakdown,
                                filtering: JSON.stringify([{ field: "campaign.id", operator: "IN", value: [args.campaignId] }])
                            };

                            if (args.since && args.until) {
                                params.time_range = JSON.stringify({ since: args.since, until: args.until });
                                dateLabel = `${args.since} a ${args.until}`;
                            } else {
                                params.date_preset = args.datePreset || "last_30d";
                                dateLabel = args.datePreset || "last_30d";
                            }

                            const res = await metaFetchPaginated({
                                endpoint: "insights",
                                fields: "spend,impressions,clicks,actions",
                                account: auth.accountId,
                                token: auth.token,
                                params
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
                            const board = await db.query.kanbanBoards.findFirst({
                                where: and(eq(kanbanBoards.id, args.boardId), eq(kanbanBoards.companyId, companyId))
                            });
                            if (!board) throw new Error("Board não encontrado.");

                            const leadsQuery = await db.query.kanbanLeads.findMany({
                                where: and(eq(kanbanLeads.companyId, companyId), eq(kanbanLeads.boardId, args.boardId)),
                                columns: {
                                    id: true,
                                    title: true,
                                    value: true,
                                    stageId: true
                                }
                            });
                            
                            let results = leadsQuery.map(l => {
                                let sName = "Desconhecido";
                                if (board.stages && Array.isArray(board.stages)) {
                                    const found = (board.stages as any[]).find(s => s.id === l.stageId);
                                    if (found) sName = found.title;
                                }
                                return { ...l, stageName: sName };
                            });

                            if (args.stageName) {
                                results = results.filter(r => r.stageName.toLowerCase() === args.stageName.toLowerCase());
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
                                where: eq(messagesTable.conversationId, targetConvId),
                                orderBy: [desc(messagesTable.sentAt)],
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
                            let finalConnectionId = args.connectionId;
                            if (!finalConnectionId) {
                                const connection = await db.query.connections.findFirst({
                                    where: and(eq(connections.companyId, companyId), eq(connections.connectionType, 'meta_api'))
                                });
                                if (!connection) throw new Error("Nenhuma conexão de API Oficial encontrada para disparar a campanha.");
                                finalConnectionId = connection.id;
                            }
                            
                            const inserted = await db.insert(campaigns).values({
                                companyId,
                                name: args.name,
                                status: args.status,
                                channel: "WHATSAPP",
                                scheduledAt: args.scheduledAt ? new Date(args.scheduledAt) : null,
                                connectionId: finalConnectionId,
                                templateId: args.templateId || null,
                                batchDelaySeconds: args.batchDelaySeconds !== undefined ? args.batchDelaySeconds : 15,
                                contactListIds: args.contactListIds || []
                            }).returning();
                            toolRes = { success: true, message: `Campanha '${args.name}' agendada/criada com sucesso!`, data: inserted[0] };
                        } catch (e: any) {
                            toolRes = { error: e.message };
                        }
                    }
                    else if (tc.function.name === 'getOfficialConnections') {
                        try {
                            const results = await db.query.connections.findMany({
                                where: and(eq(connections.companyId, companyId), eq(connections.connectionType, 'meta_api')),
                                columns: { id: true, wabaId: true, phoneNumber: true, config_name: true }
                            });
                            toolRes = { success: true, data: results };
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
                            
                            const components: any[] = [];
                            
                            if (args.headerType && args.headerType !== "NONE") {
                                let finalHandle = args.headerContent || "https://example.com/media";
                                
                                // Auto-upload da URL pública para a Sessão de Upload da Meta (Resumable Upload)
                                if ((args.headerType === "IMAGE" || args.headerType === "DOCUMENT") && args.headerContent?.startsWith('http')) {
                                    try {
                                        const { decrypt } = await import('@/lib/crypto');
                                        if (connection.appId && connection.accessToken) {
                                            const token = decrypt(connection.accessToken);
                                            const resp = await fetch(args.headerContent);
                                            if (resp.ok) {
                                                const buffer = Buffer.from(await resp.arrayBuffer());
                                                const mime = resp.headers.get('content-type') || 'application/octet-stream';
                                                
                                                // 1. Criar Sessão
                                                const fbApiVer = process.env.FACEBOOK_API_VERSION || 'v20.0';
                                                const sessResp = await fetch(`https://graph.facebook.com/${fbApiVer}/${connection.appId}/uploads?file_length=${buffer.byteLength}&file_type=${mime}`, {
                                                    method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
                                                });
                                                const sessData = await sessResp.json();
                                                
                                                // 2. Fazer Upload Binário
                                                if (sessData.id) {
                                                    const upResp = await fetch(`https://graph.facebook.com/${fbApiVer}/${sessData.id}`, {
                                                        method: 'POST',
                                                        headers: { 'Authorization': `OAuth ${token}`, 'file_offset': '0' },
                                                        body: buffer
                                                    });
                                                    const upData = await upResp.json();
                                                    if (upData.h) {
                                                        finalHandle = upData.h; // O Handle de Upload Retornado pela Meta
                                                    }
                                                }
                                            }
                                        }
                                    } catch (e) {
                                        console.warn("Falha no auto-upload da imagem para Meta:", e);
                                    }
                                }

                                components.push({
                                    type: "HEADER",
                                    format: args.headerType,
                                    text: args.headerType === "TEXT" ? args.headerContent : undefined,
                                    example: (args.headerType === "IMAGE" || args.headerType === "DOCUMENT") 
                                        ? { header_handle: [finalHandle] }
                                        : undefined
                                });
                            }
                            
                            components.push({ type: "BODY", text: args.bodyText });
                            
                            if (args.buttons && args.buttons.length > 0) {
                                components.push({
                                    type: "BUTTONS",
                                    buttons: args.buttons.map((b: any) => ({
                                        type: b.type,
                                        text: b.text,
                                        url: b.url
                                    }))
                                });
                            }

                            const inserted = await db.insert(messageTemplates).values({
                                companyId,
                                connectionId: connection.id,
                                wabaId: connection.wabaId,
                                name: args.name,
                                category: args.category,
                                language: "pt_BR",
                                components: components,
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
                            
                            let conditions = [
                                ilike(contacts.name, q),
                                ilike(contacts.email, q)
                            ];
                            
                            // Se a busca for quase só números, foque MUITO no telefone
                            if (cleanPhone.length >= 4 && cleanPhone.length >= args.query.length / 2) {
                                conditions = [ilike(contacts.phone, `%${cleanPhone}%`)];
                            } else if (cleanPhone.length > 4) {
                                conditions.push(ilike(contacts.phone, `%${cleanPhone}%`));
                            }
                            
                            const foundContacts = await db.query.contacts.findMany({
                                where: and(eq(contacts.companyId, companyId), or(...conditions)),
                                columns: { id: true, name: true, phone: true, email: true },
                                limit: 15
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
                                
                                // Prioriza os que têm conversationId
                                enriched.sort((a, b) => {
                                    if (a.conversationId && !b.conversationId) return -1;
                                    if (!a.conversationId && b.conversationId) return 1;
                                    return 0;
                                });

                                toolRes = { success: true, data: enriched.slice(0, 5) };
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
                    else if (tc.function.name === 'importLeadListFromDocument') {
                        try {
                            const { DocumentImportService } = await import('./document-import.service');
                            // args.documentUrl and args.listName are expected
                            const result = await DocumentImportService.processDocument(
                                companyId,
                                args.documentUrl,
                                args.listName
                            );
                            toolRes = result;
                        } catch (e: any) {
                            toolRes = { success: false, error: e.message };
                        }
                    }
                    else if (tc.function.name === 'sendDirectMessage') {
                        try {
                            const { sendUnifiedMessage } = await import('@/services/unified-message-sender.service');
                            
                            const conv = await db.query.conversations.findFirst({
                                where: and(eq(conversations.id, args.conversationId), eq(conversations.companyId, companyId)),
                                columns: { id: true, contactId: true, connectionId: true },
                                with: {
                                    contact: { columns: { phone: true } },
                                    connection: { columns: { connectionType: true } }
                                }
                            });
                            
                            if (!conv) throw new Error("Conversa não encontrada.");
                            if (!conv.contact?.phone) throw new Error("Contato não possui número de telefone salvo.");
                            if (!conv.connectionId) throw new Error("Conversa não possui uma conexão atrelada.");
                            
                            const provider = (conv.connection?.connectionType === 'meta_api' || conv.connection?.connectionType === 'instagram') ? 'apicloud' : 'evolution';

                            const result = await sendUnifiedMessage({
                                provider: provider as 'apicloud' | 'evolution',
                                connectionId: conv.connectionId,
                                to: conv.contact.phone,
                                message: args.text
                            });
                            
                            if (result.success) {
                                toolRes = { success: true, message: "Mensagem enviada com sucesso!", messageId: result.messageId };
                            } else {
                                throw new Error(result.error || "Falha desconhecida no envio.");
                            }
                        } catch (e: any) {
                            toolRes = { success: false, error: e.message };
                        }
                    }
                    else if (tc.function.name === 'syncWhatsAppTemplates') {
                        try {
                            const { messageTemplates } = await import('./db/schema');
                            const { syncTemplateStatus } = await import('./metaTemplatesService');
                            
                            const pendingTemplates = await db.query.messageTemplates.findMany({
                                where: and(eq(messageTemplates.companyId, companyId), eq(messageTemplates.status, 'PENDING')),
                                columns: { id: true, name: true }
                            });
                            
                            if (pendingTemplates.length === 0) {
                                toolRes = { success: true, message: "Não há templates pendentes para sincronizar." };
                            } else {
                                let aprovados = 0;
                                let rejeitados = 0;
                                let pendentes = 0;
                                
                                for (const t of pendingTemplates) {
                                    const res = await syncTemplateStatus(t.id);
                                    if (res.status === 'APPROVED') aprovados++;
                                    else if (res.status === 'REJECTED') rejeitados++;
                                    else pendentes++;
                                }
                                
                                toolRes = { success: true, message: `Sincronização concluída: ${aprovados} aprovados, ${rejeitados} rejeitados, ${pendentes} continuam pendentes.` };
                            }
                        } catch (e: any) {
                            toolRes = { success: false, error: e.message };
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
