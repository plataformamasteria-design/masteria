// src/lib/flow-engine.ts
'use server';

import { db } from './db';
import { automationFlows, automationFlowExecutions, automationExecutionLogs, contacts, connections, messages, conversations, messageTemplates, mediaAssets, kanbanBoards, kanbanLeads, contactsToTags, tags } from './db/schema';
import { eq, and, or, desc, sql, isNull, inArray } from 'drizzle-orm';
import { sendUnifiedMessage } from '@/services/unified-message-sender.service';
import { sendWhatsappTemplateMessage, sendWhatsappTextMessage } from '@/lib/facebookApiService';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { createSystemMessage } from '@/services/system-message.service';
import { resolveAIKeys } from './ai-keys-resolver';
import { logContactEvent } from './contact-events';

// =====================================================
// FLOW ENGINE V3 — BFS Graph Traversal + Context
// =====================================================

/** Represents a single step/node in the flow */
interface FlowStep {
    id: string;
    type: string;
    data: any;
    nextSteps: string[];
    connections: { target: string; sourceHandle: string | null }[];
}

/** Execution context passed between nodes */
interface ExecutionContext {
    executionId: string;
    companyId: string;
    contactId: string;
    contactPhone: string;
    contactName: string;
    contactEmail: string;
    contactTags: string[];
    contactNotes: string;
    variables: Record<string, any>;
    connectionId: string;
    provider: string;
}

// Normaliza telefone: remove +, espaços, e gera variações com/sem 55 e com/sem 9
function normalizePhoneVariations(rawPhone: string): string[] {
    const cleaned = rawPhone.replace(/[^0-9]/g, '');
    const variations = new Set<string>();
    variations.add(cleaned);

    // Se começa com 55, considerar também sem 55
    if (cleaned.startsWith('55')) {
        const without55 = cleaned.substring(2);
        variations.add(without55);
        // Se DDD + 9 dígitos (com 9), considerar sem 9
        if (without55.length === 11) {
            variations.add(without55.substring(0, 2) + without55.substring(3));
        }
        // Se DDD + 8 dígitos (sem 9), considerar com 9
        if (without55.length === 10) {
            variations.add(without55.substring(0, 2) + '9' + without55.substring(2));
        }
    } else {
        // Sem 55, adicionar com 55
        variations.add('55' + cleaned);
        if (cleaned.length === 11) {
            variations.add(cleaned.substring(0, 2) + cleaned.substring(3));
            variations.add('55' + cleaned.substring(0, 2) + cleaned.substring(3));
        }
        if (cleaned.length === 10) {
            variations.add(cleaned.substring(0, 2) + '9' + cleaned.substring(2));
            variations.add('55' + cleaned.substring(0, 2) + '9' + cleaned.substring(2));
        }
    }

    // Adicionar variações com prefixo + (DB armazena com +55...)
    const withPlus = new Set<string>();
    for (const v of variations) {
        withPlus.add(v);
        if (v.startsWith('55') && v.length >= 12) {
            withPlus.add('+' + v);
        }
    }

    return Array.from(withPlus);
}

// Interpola variáveis no formato {{variable}} em templates
async function interpolateTemplate(content: string, ctx: ExecutionContext): Promise<string> {
    if (!content) return '';
    return content.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const path = key.trim();
        // contact.name, contact.phone, etc
        if (path.startsWith('contact.')) {
            const field = path.split('.')[1];
            if (field === 'name') return ctx.contactName;
            if (field === 'phone') return ctx.contactPhone;
            if (field === 'email') return ctx.contactEmail;
            if (field === 'tags') return (ctx.contactTags || []).join(', ');
            if (field === 'notes') return ctx.contactNotes;
        }

        // nota_interna shortcut
        if (path === 'nota_interna') return ctx.contactNotes;

        // Direct variable access
        if (ctx.variables[path] !== undefined) return ctx.variables[path];

        // UI template syntax: "Gatilho: Nova Mensagem.body.nome" → extract "body.nome"
        // Then try: "nome" (last segment), "body.nome" (dot path), webhook_body.nome (nested)
        if (path.includes('.')) {
            const segments = path.split('.');
            // Try last segment as variable key (e.g., "nome")
            const lastSegment = segments[segments.length - 1];
            if (ctx.variables[lastSegment] !== undefined) return ctx.variables[lastSegment];

            // Try "body.xxx" pattern — look in webhook_body
            const bodyIdx = segments.findIndex(s => s.trim().toLowerCase() === 'body');
            if (bodyIdx >= 0 && bodyIdx < segments.length - 1) {
                const bodyKey = segments.slice(bodyIdx + 1).join('.');
                if (ctx.variables[bodyKey] !== undefined) return ctx.variables[bodyKey];
                // Try in webhook_body object
                const wb = ctx.variables.webhook_body;
                if (wb && typeof wb === 'object') {
                    const val = bodyKey.split('.').reduce((obj: any, k: string) => obj?.[k], wb);
                    if (val !== undefined) return String(val);
                }
            }
        }

        // Fallback: try removing prefix before ":"  (e.g., "Gatilho: Nova Mensagem.body.nome" → "Nova Mensagem.body.nome")
        if (path.includes(':')) {
            const afterColon = path.split(':').slice(1).join(':').trim();
            // Recursively try the part after the colon
            if (afterColon.includes('.')) {
                const segs = afterColon.split('.');
                const last = segs[segs.length - 1];
                if (ctx.variables[last] !== undefined) return ctx.variables[last];
            }
            if (ctx.variables[afterColon] !== undefined) return ctx.variables[afterColon];
        }

        return '';
    });
}

// Logging helper — insere log detalhado de execução por nó
async function logNodeExecution(
    ctx: ExecutionContext,
    nodeId: string,
    nodeType: string,
    status: 'ok' | 'error' | 'skip',
    message?: string,
    inputData?: Record<string, any>,
    outputData?: Record<string, any>,
    durationMs?: number
) {
    try {
        // Truncar dados grandes para não sobrecarregar o DB
        const safeInput = inputData ? JSON.parse(JSON.stringify(inputData, (_, v) =>
            typeof v === 'string' && v.length > 500 ? v.slice(0, 500) + '...' : v
        )) : null;
        const safeOutput = outputData ? JSON.parse(JSON.stringify(outputData, (_, v) =>
            typeof v === 'string' && v.length > 500 ? v.slice(0, 500) + '...' : v
        )) : null;

        await db.insert(automationExecutionLogs).values({
            executionId: ctx.executionId,
            companyId: ctx.companyId,
            nodeId,
            nodeType: nodeType || null,
            status,
            message: message || null,
            inputData: safeInput,
            outputData: safeOutput,
            durationMs: durationMs ?? null,
        });
    } catch (e) {
        console.error('[FLOW-ENGINE] Log insert failed:', e);
    }
}

// Resolve o próximo nó baseado no handle de saída
function resolveNextNode(step: FlowStep, sourceHandleId?: string): string | undefined {
    if (sourceHandleId) {
        const conn = step.connections?.find(c => c.sourceHandle === sourceHandleId);
        if (conn) return conn.target;
        // Se um handle específico foi solicitado e não existe conexão nele, a execução deve parar.
        // Fazer fallback para a primeira conexão causaria execução de fluxos não intencionais.
        return undefined;
    }
    return step.connections?.[0]?.target || step.nextSteps?.[0];
}

// Resolve múltiplos handle IDs para múltiplos targets (router, intent)
function resolveMultipleHandles(step: FlowStep, handleIds: string[]): string[] {
    const targets: string[] = [];
    for (const handleId of handleIds) {
        const conn = step.connections?.find(c => c.sourceHandle === handleId);
        if (conn) targets.push(conn.target);
    }
    return targets;
}

// ==============================
// Trigger evaluation
// ==============================

export async function evaluateMessageTriggers(companyId: string, contactId: string, message: any): Promise<boolean> {
    const flows = await db.query.automationFlows.findMany({
        where: and(
            eq(automationFlows.isActive, true),
            or(
                eq(automationFlows.companyId, companyId),
                eq(automationFlows.companyId, 'current-company')
            )
        )
    });

    // 🔧 BUG FIX: Retornar true se algum novo flow foi lançado
    // Usado pelo automation-engine para evitar que resumeFlowForContact retome
    // imediatamente um flow que acabou de pausar (causa mensagem de boas-vindas duplicada)
    let anyFlowLaunched = false;

    // Pre-fetch data for advanced filtering (TriggerNodeV4 categories)
    const contactData = await db.query.contacts.findFirst({
        where: eq(contacts.id, contactId)
    });
    
    // ✅ Correctly fetch tags using the relation table
    const contactTagsQuery = await db.select({ tagName: tags.name })
        .from(contactsToTags)
        .innerJoin(tags, eq(contactsToTags.tagId, tags.id))
        .where(eq(contactsToTags.contactId, contactId));
    const contactTags = contactTagsQuery.map(t => t.tagName);

    const conversationData = message?.conversationId ? await db.query.conversations.findFirst({
        where: eq(conversations.id, message.conversationId)
    }) : null;
    const leadData = await db.query.kanbanLeads.findFirst({
        where: and(eq(kanbanLeads.contactId, contactId), eq(kanbanLeads.companyId, companyId))
    });

    for (const flow of flows) {
        const logic = flow.executionLogic as any;
        const steps = Array.isArray(logic) ? logic : logic?.steps;
        if (!steps?.length) continue;

        const trigger = steps.find((s: FlowStep) => s.type === 'trigger');
        if (!trigger) continue;

        const triggerType = trigger.data?.triggerType || 'message_received';

        // Only process message-based triggers
        if (!['message_received', 'keyword'].includes(triggerType)) continue;

        const keyword = (trigger.data?.keyword || '').trim();
        const matchMode = trigger.data?.match_mode || 'contains';
        // ✅ Extrair texto do BD (message.content) que contém a transcrição de áudios ou texto puro
        const messageText = (message?.content || message?.body || message?.text || '');
        const messageTextLower = messageText.toLowerCase();
        const keywordLower = keyword.toLowerCase();

        let shouldTrigger = false;

        if (triggerType === 'message_received') {
            // Any message — optional keyword filter
            if (!keyword) {
                shouldTrigger = true;
            } else {
                switch (matchMode) {
                    case 'exact':
                        shouldTrigger = messageTextLower === keywordLower;
                        break;
                    case 'starts_with':
                        shouldTrigger = messageTextLower.startsWith(keywordLower);
                        break;
                    case 'regex':
                        try {
                            const regex = new RegExp(keyword, 'i');
                            shouldTrigger = regex.test(messageText);
                        } catch {
                            shouldTrigger = messageTextLower.includes(keywordLower);
                        }
                        break;
                    case 'contains':
                    default:
                        shouldTrigger = messageTextLower.includes(keywordLower);
                        break;
                }
            }

            // ✅ Advanced Filters (from TriggerNodeV4)
            if (shouldTrigger && trigger.data?.message_category && trigger.data?.message_category !== 'general') {
                const category = trigger.data.message_category;
                console.log(`[FLOW-ENGINE] Evaluating advanced filters for trigger category: ${category}`);
                console.log(`[FLOW-ENGINE] Data state -> ConversationConnectionId: ${conversationData?.connectionId}, FilterConnection: ${trigger.data.filter_connection}`);
                console.log(`[FLOW-ENGINE] Data state -> ContactTags: ${JSON.stringify(contactTags)}, FilterTag: ${trigger.data.filter_tag}`);
                console.log(`[FLOW-ENGINE] Data state -> LeadBoardId: ${leadData?.boardId}, FilterFunnel: ${trigger.data.filter_funnel}, LeadStageId: ${leadData?.stageId}, FilterStage: ${trigger.data.filter_stage}`);
                
                if (category === 'connection' && trigger.data.filter_connection) {
                    if (String(conversationData?.connectionId) !== String(trigger.data.filter_connection)) {
                        shouldTrigger = false;
                    }
                }
                else if (category === 'tag' && trigger.data.filter_tag) {
                    if (!contactTags.includes(trigger.data.filter_tag)) {
                        shouldTrigger = false;
                    }
                }
                else if (category === 'funnel_stage') {
                    if (trigger.data.filter_funnel && leadData?.boardId !== trigger.data.filter_funnel) {
                        shouldTrigger = false;
                    }
                    if (shouldTrigger && trigger.data.filter_stage && leadData?.stageId !== trigger.data.filter_stage) {
                        shouldTrigger = false;
                    }
                    if (!leadData) {
                        shouldTrigger = false;
                    }
                }
                else if (category === 'assigned' && trigger.data.filter_assignee_id) {
                    if (trigger.data.filter_assignee_type === 'user') {
                        if (conversationData?.assignedTo !== trigger.data.filter_assignee_id) {
                            shouldTrigger = false;
                        }
                    } else if (trigger.data.filter_assignee_type === 'team') {
                        if (conversationData?.teamId !== trigger.data.filter_assignee_id) {
                            shouldTrigger = false;
                        }
                    }
                }
            }
        } else if (triggerType === 'keyword' && keyword) {
            switch (matchMode) {
                case 'exact':
                    shouldTrigger = messageTextLower === keywordLower;
                    break;
                case 'starts_with':
                    shouldTrigger = messageTextLower.startsWith(keywordLower);
                    break;
                case 'regex':
                    try {
                        const regex = new RegExp(keyword, 'i');
                        shouldTrigger = regex.test(messageText);
                    } catch {
                        shouldTrigger = messageTextLower.includes(keywordLower);
                    }
                    break;
                case 'contains':
                default:
                    shouldTrigger = messageTextLower.includes(keywordLower);
                    break;
            }
        }

        if (shouldTrigger) {
            // Skip if there's already a paused/running execution for this contact on this flow
            const existingExec = await db.query.automationFlowExecutions.findFirst({
                where: and(
                    eq(automationFlowExecutions.contactId, contactId),
                    eq(automationFlowExecutions.flowId, flow.id),
                    inArray(automationFlowExecutions.status, ['paused', 'running'])
                ),
            });
            if (existingExec) {
                console.log(`[FLOW - ENGINE] ⏩ Skipping trigger for flow ${flow.id} — existing ${existingExec.status} execution ${existingExec.id} for contact ${contactId}`);
                continue;
            }

            await triggerFlow(flow.id, companyId, contactId, {
                message_text: messageText,
                message_type: message?.type || 'text',
                trigger_type: triggerType,
                matched_keyword: keyword || undefined,
            });
            anyFlowLaunched = true;
        }
    }

    return anyFlowLaunched;
}

export async function evaluateWebhookTriggers(companyId: string, contactId: string, eventType: string, body: any) {
    const flows = await db.query.automationFlows.findMany({
        where: and(
            eq(automationFlows.isActive, true),
            or(
                eq(automationFlows.companyId, companyId),
                eq(automationFlows.companyId, 'current-company')
            )
        )
    });

    for (const flow of flows) {
        const logic = flow.executionLogic as any;
        const steps = Array.isArray(logic) ? logic : logic?.steps;
        if (!steps?.length) continue;

        const trigger = steps.find((s: FlowStep) => s.type === 'trigger');
        if (!trigger) continue;

        const triggerType = trigger.data?.triggerType;

        // Match webhook-based triggers
        let shouldTrigger = false;

        if (triggerType === 'webhook' || triggerType === 'manual') {
            // Generic webhook — always match
            shouldTrigger = true;
        } else if (triggerType === 'webhook_pix') {
            const pixEvent = trigger.data?.pix_event || 'pix_created';
            shouldTrigger = eventType === pixEvent || eventType.includes('pix');
        } else if (triggerType === 'webhook_sale') {
            const saleEvent = trigger.data?.sale_event || 'purchase_approved';
            shouldTrigger = eventType === saleEvent || eventType.includes('purchase') || eventType.includes('sale');
        } else if (triggerType === eventType) {
            // Legacy: exact event type match
            shouldTrigger = true;
        }

        if (shouldTrigger) {
            // Flatten body for variable access
            const flatBody: Record<string, any> = {};
            if (body && typeof body === 'object') {
                for (const [key, value] of Object.entries(body)) {
                    flatBody[key] = value;
                }
            }

            await triggerFlow(flow.id, companyId, contactId, {
                webhook_body: body,
                event_type: eventType,
                trigger_type: triggerType,
                ...flatBody,
            });
        }
    }
}

// ==============================
// Event-based Trigger Evaluators (V2)
// ==============================

/**
 * Evaluates triggers when a new contact is created.
 * Called from contact creation endpoints.
 */
export async function evaluateContactCreatedTriggers(companyId: string, contactId: string, contactTags?: string[]) {
    const flows = await db.query.automationFlows.findMany({
        where: and(
            eq(automationFlows.isActive, true),
            or(
                eq(automationFlows.companyId, companyId),
                eq(automationFlows.companyId, 'current-company')
            )
        )
    });

    for (const flow of flows) {
        const logic = flow.executionLogic as any;
        const steps = Array.isArray(logic) ? logic : logic?.steps;
        if (!steps?.length) continue;

        const trigger = steps.find((s: FlowStep) => s.type === 'trigger');
        if (!trigger) continue;

        const triggerType = trigger.data?.triggerType;
        if (triggerType !== 'contact_created') continue;

        // Optional tag filter
        const filterTag = trigger.data?.filter_tag;
        if (filterTag && contactTags && !contactTags.includes(filterTag)) continue;

        // Skip duplicate executions
        const existingExec = await db.query.automationFlowExecutions.findFirst({
            where: and(
                eq(automationFlowExecutions.contactId, contactId),
                eq(automationFlowExecutions.flowId, flow.id),
                inArray(automationFlowExecutions.status, ['paused', 'running'])
            ),
        });
        if (existingExec) continue;

        console.log(`[FLOW-ENGINE] 👤 Contact created trigger: flow ${flow.id} for contact ${contactId}`);
        await triggerFlow(flow.id, companyId, contactId, {
            trigger_type: 'contact_created',
        });
    }
}

/**
 * Evaluates triggers when a tag is added to a contact.
 * Called from tag update endpoints.
 */
export async function evaluateTagAddedTriggers(companyId: string, contactId: string, addedTag: string) {
    const flows = await db.query.automationFlows.findMany({
        where: and(
            eq(automationFlows.isActive, true),
            or(
                eq(automationFlows.companyId, companyId),
                eq(automationFlows.companyId, 'current-company')
            )
        )
    });

    for (const flow of flows) {
        const logic = flow.executionLogic as any;
        const steps = Array.isArray(logic) ? logic : logic?.steps;
        if (!steps?.length) continue;

        const trigger = steps.find((s: FlowStep) => s.type === 'trigger');
        if (!trigger) continue;

        const triggerType = trigger.data?.triggerType;
        if (triggerType !== 'contact_tag_added') continue;

        // Match specific tag if configured
        const tagName = trigger.data?.tag_name;
        if (tagName && tagName.toLowerCase() !== addedTag.toLowerCase()) continue;

        // Skip duplicate executions
        const existingExec = await db.query.automationFlowExecutions.findFirst({
            where: and(
                eq(automationFlowExecutions.contactId, contactId),
                eq(automationFlowExecutions.flowId, flow.id),
                inArray(automationFlowExecutions.status, ['paused', 'running'])
            ),
        });
        if (existingExec) continue;

        console.log(`[FLOW-ENGINE] 🏷️ Tag added trigger: flow ${flow.id}, tag="${addedTag}", contact ${contactId}`);
        await triggerFlow(flow.id, companyId, contactId, {
            trigger_type: 'contact_tag_added',
            added_tag: addedTag,
        });
    }
}

/**
 * Evaluates schedule triggers. Called from cron job.
 * Checks schedule_freq, schedule_time, and cron_expression.
 */
export async function evaluateScheduleTriggers() {
    const flows = await db.query.automationFlows.findMany({
        where: eq(automationFlows.isActive, true),
    });

    const now = new Date();
    const nowHour = now.getHours().toString().padStart(2, '0');
    const nowMinute = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${nowHour}:${nowMinute}`;
    const dayOfWeek = now.getDay(); // 0=Sunday
    const dayOfMonth = now.getDate();

    for (const flow of flows) {
        const logic = flow.executionLogic as any;
        const steps = Array.isArray(logic) ? logic : logic?.steps;
        if (!steps?.length) continue;

        const trigger = steps.find((s: FlowStep) => s.type === 'trigger');
        if (!trigger) continue;
        if (trigger.data?.triggerType !== 'schedule') continue;

        const freq = trigger.data?.schedule_freq || 'every_day';
        const scheduleTime = trigger.data?.schedule_time || '09:00';
        let shouldRun = false;

        switch (freq) {
            case 'every_hour':
                // Run at minute 0 of every hour
                shouldRun = nowMinute === '00';
                break;
            case 'every_day':
                shouldRun = currentTime === scheduleTime;
                break;
            case 'every_week':
                // Run on Monday at scheduled time
                shouldRun = dayOfWeek === 1 && currentTime === scheduleTime;
                break;
            case 'every_month':
                // Run on 1st of month at scheduled time
                shouldRun = dayOfMonth === 1 && currentTime === scheduleTime;
                break;
            case 'custom_cron':
                // Basic cron parsing (minute hour day month weekday)
                // For now, just check time match — full cron requires a library
                shouldRun = currentTime === scheduleTime;
                break;
        }

        if (!shouldRun) continue;

        console.log(`[FLOW-ENGINE] ⏰ Schedule trigger: flow ${flow.id} (freq=${freq}, time=${scheduleTime})`);

        // Trigger without a specific contact — flow should use lookup_lead or run company-wide
        await triggerFlow(flow.id, flow.companyId, null, {
            trigger_type: 'schedule',
            schedule_freq: freq,
            schedule_time: scheduleTime,
        });
    }
}

// ==============================
// Flow trigger (creates execution)
// ==============================

export async function triggerFlow(flowId: string, companyId: string, contactId: string | null, initialVars: any = {}): Promise<string | null> {
    console.log(`[FLOW - ENGINE] 🔥 Triggering flow: ${flowId} for contact: ${contactId} `);

    const flow = await db.query.automationFlows.findFirst({
        where: and(
            eq(automationFlows.id, flowId),
            or(
                eq(automationFlows.companyId, companyId),
                eq(automationFlows.companyId, 'current-company')
            )
        )
    });

    if (!flow) {
        console.error(`[FLOW - ENGINE] ❌ Flow not found: ${flowId} (companyId: ${companyId})`);
        return null;
    }

    if (!flow.isActive) {
        console.warn(`[FLOW - ENGINE] ⚠️ Flow is inactive: ${flowId} `);
        // Para test-real, permitir execução mesmo inativo
    }

    const [execution] = await db.insert(automationFlowExecutions).values({
        flowId,
        companyId,
        contactId,
        status: 'running',
        variables: { vars: initialVars },
    }).returning();

    console.log(`[FLOW - ENGINE] 📝 Execution created: ${execution.id} `);

    if (contactId) {
        try {
            await logContactEvent(companyId, contactId, 'AUTOMATION', `Automação Iniciada: ${flow.name}`, { flowId });
        } catch (e) {
            console.warn('[logContactEvent] Falha ao logar automação', e);
        }
    }

    // System message: notificar início da automação no chat
    if (contactId) {
        const activeConv = await db.query.conversations.findFirst({
            where: and(
                eq(conversations.contactId, contactId),
                eq(conversations.companyId, companyId),
            ),
            orderBy: desc(conversations.lastMessageAt),
        });
        if (activeConv) {
            await createSystemMessage({
                conversationId: activeConv.id,
                companyId,
                content: `⚡ Automação "${flow.name}" iniciada`,
            });
        }
    }

    // Process from trigger node
    try {
        await processFlowExecution(execution.id, flow.executionLogic as any);
    } catch (err) {
        console.error(`[FLOW - ENGINE] ❌ processFlowExecution error: `, err);
        await db.update(automationFlowExecutions)
            .set({ status: 'failed', error: String(err), finishedAt: new Date() })
            .where(eq(automationFlowExecutions.id, execution.id));
    }

    return execution.id;
}

// ==============================
// BFS Flow Execution Engine V3
// ==============================

export async function processFlowExecution(executionId: string, logic: { steps: FlowStep[] } | FlowStep[], currentStepId?: string) {
    const execution = await db.query.automationFlowExecutions.findFirst({
        where: eq(automationFlowExecutions.id, executionId),
        with: { contact: true }
    });

    if (!execution || execution.status === 'completed' || execution.status === 'failed') return;

    const contact = execution.contact;

    // Get the correct connection for this contact's active conversation
    // ✅ FIX: Previously picked ANY active connection — could return Meta API when
    // the message came via Baileys, causing silent send failures.
    let connection: typeof connections.$inferSelect | undefined = undefined;
    if (execution.contactId) {
        const activeConv = await db.query.conversations.findFirst({
            where: and(
                eq(conversations.contactId, execution.contactId),
                eq(conversations.companyId, execution.companyId),
            ),
            orderBy: desc(conversations.lastMessageAt),
        });
        if (activeConv?.connectionId) {
            connection = await db.query.connections.findFirst({
                where: eq(connections.id, activeConv.connectionId)
            }) ?? undefined;
            console.log(`[FLOW-ENGINE] 🔗 Resolved connection from conversation: ${activeConv.connectionId} (type: ${connection?.connectionType})`);
        }
    }
    // Fallback: any active connection for the company (schedule triggers, etc.)
    if (!connection) {
        connection = await db.query.connections.findFirst({
            where: and(
                eq(connections.companyId, execution.companyId),
                eq(connections.isActive, true)
            )
        }) ?? undefined;
        console.log(`[FLOW-ENGINE] 🔗 Fallback connection: ${connection?.id} (type: ${connection?.connectionType})`);
    }

    // Build execution context
    // Derive provider from connectionType (no 'provider' column exists)
    let derivedProvider = 'baileys';
    if (connection?.connectionType === 'meta_api' || connection?.connectionType === 'apicloud') {
        derivedProvider = 'apicloud';
    } else if (['baileys', 'evolution'].includes(connection?.connectionType || '')) {
        derivedProvider = 'baileys';
    }

    let realContactTags: string[] = [];
    if (execution.contactId) {
        const contactTagsQuery = await db.select({ tagName: tags.name })
            .from(contactsToTags)
            .innerJoin(tags, eq(contactsToTags.tagId, tags.id))
            .where(eq(contactsToTags.contactId, execution.contactId));
        realContactTags = contactTagsQuery.map(t => t.tagName);
    }

    const ctx: ExecutionContext = {
        executionId,
        companyId: execution.companyId,
        contactId: execution.contactId || '',
        contactPhone: contact?.phone || '',
        contactName: contact?.name || 'Cliente',
        contactEmail: contact?.email || '',
        contactTags: realContactTags,
        contactNotes: (contact as any)?.notes || '',
        variables: (execution.variables as any)?.vars || {},
        connectionId: connection?.id || 'default',
        provider: derivedProvider,
    };

    // Normalize: executionLogic can be array directly or { steps: [...] }
    const steps = Array.isArray(logic) ? logic : (logic?.steps || []);
    // Find starting node
    const startStep = currentStepId
        ? steps.find(s => s.id === currentStepId)
        : (steps.find(s => s.type === 'trigger') || steps[0]);

    if (!startStep) {
        await db.update(automationFlowExecutions)
            .set({ status: 'completed', finishedAt: new Date() })
            .where(eq(automationFlowExecutions.id, executionId));
        return;
    }

    // BFS Queue — supports branching (multiple next nodes)
    const queue: string[] = [startStep.id];
    const visited = new Set<string>();
    let nodeCount = 0;
    const MAX_NODES = 100; // Safety limit to prevent infinite loops

    while (queue.length > 0 && nodeCount < MAX_NODES) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);
        nodeCount++;

        const step = steps.find(s => s.id === nodeId);
        if (!step) continue;

        try {
            console.log(`[FLOW - ENGINE] 🚀 Executing: ${step.type} (${step.id})`);

            // --- TIMEOUT BYPASS ---
            if (ctx.variables._timeout_triggered_for_step === step.id) {
                console.log(`[FLOW - ENGINE] ⏱️ Timeout forced bypass for step ${step.id}`);
                // Remover flag para não travar próximos nós
                delete ctx.variables._timeout_triggered_for_step;
                
                await logNodeExecution(
                    ctx, step.id, step.type, 'timeout',
                    'Timeout triggered by worker',
                    { config: step.data },
                    { action: 'continue', sourceHandle: 'timeout' },
                    0
                );
                
                // Update DB to clear the flag
                await db.update(automationFlowExecutions)
                    .set({ variables: { vars: ctx.variables } })
                    .where(eq(automationFlowExecutions.id, executionId));
                
                // Strictly look for timeout or not_responded handles, avoiding fallback
                const timeoutConn = step.connections?.find(c => c.sourceHandle === 'timeout' || c.sourceHandle === 'not_responded');
                const timeoutNextId = timeoutConn ? timeoutConn.target : undefined;
                
                if (timeoutNextId && !visited.has(timeoutNextId)) queue.push(timeoutNextId);
                
                continue;
            }
            // ----------------------

            // Capturar input do nó (config + variáveis do contexto naquele momento)
            const nodeInput: Record<string, any> = {
                config: step.data || {},
                contactPhone: ctx.contactPhone,
                contactName: ctx.contactName,
                variables: { ...ctx.variables },
            };

            const startTime = Date.now();
            const result = await executeNode(step, ctx, steps);
            const elapsed = Date.now() - startTime;

            // Montar output estruturado
            const nodeOutput: Record<string, any> = {
                action: result.action || 'continue',
                sourceHandle: result.sourceHandle || null,
                message: result.message || null,
            };
            if (result.newVars) nodeOutput.newVars = result.newVars;
            if (result.delayMs) nodeOutput.delayMs = result.delayMs;
            if (result.nextNodeIds) nodeOutput.nextNodeIds = result.nextNodeIds;

            await logNodeExecution(
                ctx, step.id, step.type, 'ok',
                result.message,
                nodeInput,
                nodeOutput,
                elapsed
            );

            // Update context variables if node produced new ones
            if (result.newVars) {
                Object.assign(ctx.variables, result.newVars);
                const updateFields: Record<string, any> = { variables: { vars: ctx.variables } };
                // Se lookup_lead atualizou o contactId, atualizar no DB também
                if (result.newVars.lead_id && ctx.contactId) {
                    updateFields.contactId = ctx.contactId;
                }
                await db.update(automationFlowExecutions)
                    .set(updateFields)
                    .where(eq(automationFlowExecutions.id, executionId));
            }

            // Handle special results
            if (result.action === 'pause') {
                await db.update(automationFlowExecutions)
                    .set({ status: 'paused', currentStepId: step.id })
                    .where(eq(automationFlowExecutions.id, executionId));
                console.log(`[FLOW - ENGINE] ⏸️ Paused at ${step.id} `);
                return;
            }

            if (result.action === 'delay') {
                const delayMs = result.delayMs || 60000;
                await db.update(automationFlowExecutions)
                    .set({
                        status: 'delayed',
                        currentStepId: resolveNextNode(step) || step.id,
                        variables: { vars: ctx.variables, _resumeAt: Date.now() + delayMs }
                    })
                    .where(eq(automationFlowExecutions.id, executionId));
                console.log(`[FLOW - ENGINE] ⏳ Delayed ${delayMs}ms at ${step.id} `);
                // Schedule resume via setTimeout (in-process; the cron module handles crash recovery)
                setTimeout(() => {
                    processFlowExecution(executionId, logic, resolveNextNode(step));
                }, delayMs);
                return;
            }

            if (result.action === 'stop') {
                await db.update(automationFlowExecutions)
                    .set({ status: 'completed', finishedAt: new Date() })
                    .where(eq(automationFlowExecutions.id, executionId));
                console.log(`[FLOW - ENGINE] 🛑 Stopped at ${step.id} `);
                return;
            }

            // Enqueue next nodes
            if (result.nextNodeIds && result.nextNodeIds.length > 0) {
                // Multi-branch: enqueue all targets
                for (const nid of result.nextNodeIds) {
                    if (!visited.has(nid)) queue.push(nid);
                }
            } else {
                // Single next
                const next = resolveNextNode(step, result.sourceHandle);
                if (next && !visited.has(next)) queue.push(next);
            }

        } catch (error) {
            const elapsed = Date.now() - (Date.now()); // fallback
            console.error(`[FLOW - ENGINE] ❌ Failed at ${step.type} (${step.id}): `, error);
            await logNodeExecution(
                ctx, step.id, step.type, 'error',
                String(error),
                { config: step.data || {}, variables: { ...ctx.variables } },
                { error: String(error) },
                0
            );
            await db.update(automationFlowExecutions)
                .set({ status: 'failed', error: String(error), finishedAt: new Date() })
                .where(eq(automationFlowExecutions.id, executionId));

            // System message: notificar falha da automação
            if (ctx.contactId) {
                const failedFlow = await db.query.automationFlows.findFirst({ where: eq(automationFlows.id, execution.flowId) });
                const failConv = await db.query.conversations.findFirst({
                    where: and(
                        eq(conversations.contactId, ctx.contactId),
                        eq(conversations.companyId, ctx.companyId),
                    ),
                    orderBy: desc(conversations.lastMessageAt),
                });
                if (failConv) {
                    await createSystemMessage({
                        conversationId: failConv.id,
                        companyId: ctx.companyId,
                        content: `❌ Automação "${failedFlow?.name || 'Fluxo'}" falhou no node "${step.type}"`,
                    });
                }
            }
            return;
        }
    }

    // BFS completed — all nodes visited
    await db.update(automationFlowExecutions)
        .set({ status: 'completed', finishedAt: new Date() })
        .where(eq(automationFlowExecutions.id, executionId));
    console.log(`[FLOW - ENGINE] ✅ Execution ${executionId} completed(${nodeCount} nodes).`);

    // System message: notificar conclusão da automação
    if (execution.contactId) {
        const flow = await db.query.automationFlows.findFirst({ where: eq(automationFlows.id, execution.flowId) });
        const activeConv = await db.query.conversations.findFirst({
            where: and(
                eq(conversations.contactId, execution.contactId),
                eq(conversations.companyId, execution.companyId),
            ),
            orderBy: desc(conversations.lastMessageAt),
        });
        if (activeConv) {
            await createSystemMessage({
                conversationId: activeConv.id,
                companyId: execution.companyId,
                content: `✅ Automação "${flow?.name || 'Fluxo'}" concluída (${nodeCount} etapas)`,
            });
        }
    }
}

// ==============================
// Node execution handlers
// ==============================

interface NodeResult {
    action?: 'continue' | 'pause' | 'delay' | 'stop';
    sourceHandle?: string;
    nextNodeIds?: string[];
    newVars?: Record<string, any>;
    delayMs?: number;
    message?: string;
}

async function executeNode(step: FlowStep, ctx: ExecutionContext, allSteps: FlowStep[]): Promise<NodeResult> {
    switch (step.type) {
        // ---- System ----
        case 'trigger':
            return { message: 'Trigger activated' };

        // ---- Messages ----
        case 'send_message':
        case 'message': {
            const text = await interpolateTemplate(step.data.message || step.data.content || '', ctx);
            await sendUnifiedMessage({
                provider: ctx.provider as any,
                connectionId: ctx.connectionId,
                to: ctx.contactPhone || ctx.contactId,
                message: text,
            });
            return { message: `Sent: ${text.slice(0, 50)} ` };
        }

        case 'send_image':
        case 'send_video':
        case 'send_document':
        case 'send_audio':
        case 'media': {
            const caption = await interpolateTemplate(step.data.caption || step.data.content || '', ctx);
            const mediaType = step.type === 'send_image' ? 'image'
                : step.type === 'send_video' ? 'video'
                    : step.type === 'send_audio' ? 'audio'
                        : step.type === 'send_document' ? 'document'
                            : step.data.mediaType || 'image';
            await sendUnifiedMessage({
                provider: ctx.provider as any,
                connectionId: ctx.connectionId,
                to: ctx.contactPhone || ctx.contactId,
                message: caption,
                mediaUrl: step.data.file_url || step.data.url,
                mediaType,
            });
            return { message: `Media sent: ${mediaType} ` };
        }

        // ---- Interaction ----
        case 'ask_question': {
            if (ctx.variables.last_response && ctx.variables._ask_step_id === step.id) {
                const answer = ctx.variables.last_response;
                delete ctx.variables._ask_step_id;
                
                const saveToVar = ctx.variables._ask_save_to_var || 'last_response';
                const options = ctx.variables._ask_options as string[] | undefined;
                delete ctx.variables._ask_save_to_var;
                delete ctx.variables._ask_options;
                
                let sourceHandle = 'fallback';
                if (options && options.length > 0) {
                    const matchIdx = options.findIndex(o => o.toLowerCase().trim() === answer.toLowerCase().trim());
                    if (matchIdx >= 0) sourceHandle = `opt-${matchIdx}`;
                }
                
                return {
                    action: 'continue',
                    sourceHandle,
                    newVars: { [saveToVar]: answer },
                    message: `Answered: ${answer}`
                };
            }

            const question = await interpolateTemplate(step.data.question || '', ctx);

            // Format options as numbered list if configured
            let fullMessage = question;
            const options = step.data.options as string[] | undefined;
            if (options && options.length > 0) {
                const optionsList = options
                    .filter((o: string) => o && o.trim())
                    .map((o: string, i: number) => `${i + 1}️⃣ ${o.trim()}`)
                    .join('\n');
                if (optionsList) {
                    fullMessage += '\n\n' + optionsList;
                }
            }

            await sendUnifiedMessage({
                provider: ctx.provider as any,
                connectionId: ctx.connectionId,
                to: ctx.contactPhone || ctx.contactId,
                message: fullMessage,
            });

            // Store save_to_var and options metadata so the resume handler can use them
            const questionVars: Record<string, any> = {
                _ask_step_id: step.id,
                _ask_save_to_var: step.data.save_to_var || 'last_response',
            };
            if (options && options.length > 0) {
                questionVars._ask_options = options.filter((o: string) => o && o.trim());
            }

            return { action: 'pause', newVars: questionVars, message: `Question sent, waiting for answer` };
        }

        case 'capture_info': {
            if (ctx.variables.last_response && ctx.variables._capture_step_id === step.id) {
                const answer = ctx.variables.last_response;
                
                // Validação de tipo (e-mail, phone)
                let isValid = true;
                const validationType = ctx.variables._capture_validation;
                if (validationType) {
                    if (validationType === 'email') {
                        isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer);
                    } else if (validationType === 'phone' || validationType === 'number') {
                        isValid = /^\d+$/.test(answer.replace(/\D/g, ''));
                    }
                }

                if (!isValid) {
                    // Send an error message and repeat question
                    await sendUnifiedMessage({
                        provider: ctx.provider as any,
                        connectionId: ctx.connectionId,
                        to: ctx.contactPhone || ctx.contactId,
                        message: "Formato inválido. Por favor, tente novamente com o formato correto:",
                    });
                    return { action: 'pause' }; // Keep paused, do not clear vars
                }

                delete ctx.variables._capture_step_id;
                const fieldKey = ctx.variables._capture_field_key || 'captured_value';
                delete ctx.variables._capture_field_key;
                delete ctx.variables._capture_validation;
                
                // --- SAVE TO CRM DB ---
                if (ctx.contactId) {
                    try {
                        const standardFields = ['name', 'nome', 'email', 'phone', 'telefone', 'celular'];
                        const lKey = fieldKey.toLowerCase();
                        
                        let updateData: any = {};
                        if (lKey === 'name' || lKey === 'nome') updateData.name = answer;
                        else if (lKey === 'email') updateData.email = answer;
                        else if (lKey === 'phone' || lKey === 'telefone' || lKey === 'celular') updateData.phone = answer.replace(/\D/g, '');
                        else {
                            // Fetch existing customFields
                            const [contactData] = await db.select({ customFields: contacts.customFields }).from(contacts).where(eq(contacts.id, ctx.contactId)).limit(1);
                            updateData.customFields = { ...(contactData?.customFields || {}), [fieldKey]: answer };
                        }
                        
                        await db.update(contacts).set(updateData).where(eq(contacts.id, ctx.contactId));
                    } catch (e) {
                        console.error('[FLOW-ENGINE] Capture CRM save error:', e);
                    }
                }

                return {
                    action: 'continue',
                    newVars: { [fieldKey]: answer },
                    message: `Captured: ${answer}`
                };
            }

            const prompt = await interpolateTemplate(step.data.prompt_message || step.data.question || '', ctx);
            if (prompt) {
                await sendUnifiedMessage({
                    provider: ctx.provider as any,
                    connectionId: ctx.connectionId,
                    to: ctx.contactPhone || ctx.contactId,
                    message: prompt,
                });
            }

            // Store field_key and validation config for the resume handler
            const fieldKey = step.data.field_key === 'custom'
                ? (step.data.custom_field_name || 'custom_field')
                : (step.data.field_key || 'captured_value');

            return {
                action: 'pause',
                newVars: {
                    _capture_step_id: step.id,
                    _capture_field_key: fieldKey,
                    _capture_validation: step.data.validation || null,
                },
                message: `Capture: waiting for ${fieldKey}`,
            };
        }

        case 'wait_response':
        case 'interaction': {
            if (ctx.variables.last_response && ctx.variables._wait_step_id === step.id) {
                delete ctx.variables._wait_step_id;
                delete ctx.variables._wait_timeout_at;
                delete ctx.variables._wait_timeout_message;
                
                return {
                    action: 'continue',
                    sourceHandle: 'responded',
                    message: `Lead responded`
                };
            }

            if (step.data?.interactionType === 'wait_response' || step.type === 'wait_response') {
                const timeoutAmount = parseInt(step.data?.timeout_amount || step.data?.timeout_minutes || '0');
                const timeoutUnit = step.data?.timeout_unit || 'minutes';

                if (timeoutAmount > 0) {
                    const multipliers: Record<string, number> = {
                        seconds: 1000,
                        minutes: 60 * 1000,
                        hours: 60 * 60 * 1000,
                        days: 24 * 60 * 60 * 1000,
                    };
                    const timeoutMs = timeoutAmount * (multipliers[timeoutUnit] || 60000);

                    // Store timeout metadata for the cron/resume handler
                    return {
                        action: 'pause',
                        newVars: {
                            _wait_timeout_at: Date.now() + timeoutMs,
                            _wait_timeout_message: step.data.timeout_message || '',
                            _wait_step_id: step.id,
                        },
                        message: `Waiting for response (timeout: ${timeoutAmount} ${timeoutUnit})`,
                    };
                }

                return { action: 'pause', message: 'Waiting for response' };
            }
            if (step.data?.interactionType === 'capture') {
                return { action: 'pause', message: 'Capture mode' };
            }
            return {};
        }

        // ---- Logic: Condition (Sim/Não) ----
        case 'condition': {
            const condType = step.data.condition_type;
            const condValue = step.data.condition_value;
            const condValues = step.data.condition_values;
            let condMet = false;

            if (condType === 'has_tag') {
                condMet = ctx.contactTags.includes(condValue);
                if (!condMet && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(condValue)) {
                    const tagObj = await db.query.tags.findFirst({ where: eq(tags.id, condValue) });
                    if (tagObj) condMet = ctx.contactTags.includes(tagObj.name);
                }
            } else if (condType === 'response_equals') {
                condMet = ctx.variables.last_response === condValue;
            } else if (condType === 'response_contains') {
                condMet = (ctx.variables.last_response || '').includes(condValue);
            } else if (condType === 'response_in') {
                let options: string[] = [];
                if (Array.isArray(condValues) && condValues.length > 0) {
                    options = condValues.map(s => String(s).trim().toLowerCase());
                } else {
                    options = (condValue || '').split(',').map((s: string) => s.trim().toLowerCase());
                }
                condMet = options.includes((ctx.variables.last_response || '').toLowerCase());
            } else if (condType === 'is_assigned') {
                condMet = !!ctx.variables.assigned_to;
            } else {
                const reqTag = step.data.conditionValue;
                condMet = reqTag ? ctx.contactTags.includes(reqTag) : true;
            }

            return {
                sourceHandle: condMet ? 'yes' : 'no',
                message: `Condition: ${condMet ? 'YES' : 'NO'} `,
            };
        }

        // Legacy compatibility for logic node
        case 'logic': {
            if (step.data.logicType === 'wait') {
                const seconds = parseInt(step.data.delaySeconds || '60');
                return { action: 'delay', delayMs: seconds * 1000, message: `Delay: ${seconds} s` };
            }
            if (step.data.logicType === 'branch') {
                const reqTag = step.data.conditionValue;
                const condMet = reqTag ? ctx.contactTags.includes(reqTag) : true;
                return { sourceHandle: condMet ? 'true' : 'false', message: `Branch: ${condMet} ` };
            }
            if (step.data.logicType === 'filter') {
                return { sourceHandle: 'pass' };
            }
            return {};
        }

        // ---- Logic: Filter (Pass/Block) ----
        case 'filter': {
            const conditions = step.data.conditions || [];
            const matchMode = step.data.match_mode || 'all';

            if (conditions.length === 0) {
                return { sourceHandle: 'pass', message: 'Filter: no conditions (pass)' };
            }

            const results: boolean[] = [];
            for (const cond of conditions) {
                const rawField = await interpolateTemplate(cond.field || '', ctx);
                const rawValue = await interpolateTemplate(cond.value || '', ctx);
                const fieldValue = ctx.variables[cond.field] || rawField || '';
                
                let passed = false;
                switch (cond.operator) {
                    case 'equals': passed = fieldValue === rawValue; break;
                    case 'not_equals': passed = fieldValue !== rawValue; break;
                    case 'contains': passed = String(fieldValue).includes(rawValue); break;
                    case 'not_contains': passed = !String(fieldValue).includes(rawValue); break;
                    case 'starts_with': passed = String(fieldValue).startsWith(rawValue); break;
                    case 'ends_with': passed = String(fieldValue).endsWith(rawValue); break;
                    case 'greater_than': passed = parseFloat(String(fieldValue)) > parseFloat(rawValue); break;
                    case 'less_than': passed = parseFloat(String(fieldValue)) < parseFloat(rawValue); break;
                    case 'is_empty': passed = !fieldValue; break;
                    case 'is_not_empty': passed = !!fieldValue; break;
                    default: passed = true; break;
                }
                results.push(passed);
            }

            const passed = matchMode === 'all'
                ? results.every((r: boolean) => r)
                : results.some((r: boolean) => r);

            return { sourceHandle: passed ? 'pass' : 'block', message: `Filter: ${passed ? 'PASS' : 'BLOCK'} ` };
        }

        // ---- Logic: Router (N handles) ----
        case 'router': {
            const rules = step.data.rules || [];
            for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                const rawField = await interpolateTemplate(rule.field || '', ctx);
                const rawValue = await interpolateTemplate(rule.value || '', ctx);
                const fieldValue = ctx.variables[rule.field] || rawField || '';
                
                let matches = false;
                switch (rule.operator) {
                    case 'equals': matches = fieldValue === rawValue; break;
                    case 'not_equals': matches = fieldValue !== rawValue; break;
                    case 'contains': matches = String(fieldValue).includes(rawValue); break;
                    case 'not_contains': matches = !String(fieldValue).includes(rawValue); break;
                    case 'starts_with': matches = String(fieldValue).startsWith(rawValue); break;
                    case 'ends_with': matches = String(fieldValue).endsWith(rawValue); break;
                    case 'greater_than': matches = parseFloat(String(fieldValue)) > parseFloat(rawValue); break;
                    case 'less_than': matches = parseFloat(String(fieldValue)) < parseFloat(rawValue); break;
                    default: matches = false;
                }
                if (matches) {
                    return { sourceHandle: `route-${i}`, message: `Router: matched route ${i}` };
                }
            }
            return { sourceHandle: 'fallback', message: 'Router: fallback' };
        }

        // ---- Logic: Delay ----
        case 'delay': {
            const amount = parseInt(step.data.amount || '5');
            const unit = step.data.unit || 'minutes';
            const multipliers: Record<string, number> = {
                seconds: 1000,
                minutes: 60 * 1000,
                hours: 60 * 60 * 1000,
                days: 24 * 60 * 60 * 1000,
            };
            const ms = amount * (multipliers[unit] || 60000);
            return { action: 'delay', delayMs: ms, message: `Delay: ${amount} ${unit} ` };
        }

        // ---- CRM (Kanban Integration V2) ----
        case 'crm_move':
        case 'crm': {
            const funnelName = step.data.funnel_name || step.data.funnel_id;
            const stageName = step.data.stage_name || step.data.stage_id || step.data.description || step.data.tag;

            if (!ctx.contactId) return { message: 'CRM: no contact' };

            // Also add as tag for backward compatibility
            if (stageName && !ctx.contactTags.includes(stageName)) {
                ctx.contactTags.push(stageName);
                try {
                    let tagRecord = await db.query.tags.findFirst({
                        where: and(eq(tags.name, stageName), eq(tags.companyId, ctx.companyId))
                    });
                    if (!tagRecord) {
                        const inserted = await db.insert(tags).values({
                            companyId: ctx.companyId,
                            name: stageName,
                        }).returning();
                        tagRecord = inserted[0];
                    }
                    await db.insert(contactsToTags).values({
                        contactId: ctx.contactId,
                        tagId: tagRecord.id,
                        companyId: ctx.companyId
                    }).onConflictDoNothing();
                } catch (e) {
                    console.error('[FLOW-ENGINE] Kanban Tag assignment error:', e);
                }
            }

            // Real Kanban integration: find board and move card
            if (funnelName) {
                try {
                    // Find the board by name or ID
                    const board = await db.query.kanbanBoards.findFirst({
                        where: and(
                            eq(kanbanBoards.companyId, ctx.companyId),
                            or(
                                eq(kanbanBoards.id, funnelName),
                                eq(kanbanBoards.name, funnelName)
                            )
                        )
                    });

                    if (board) {
                        // Find the target stage in board.stages JSONB
                        const stages = (board.stages || []) as Array<{ id: string; name: string }>;
                        const targetStage = stages.find(s =>
                            s.name === stageName || s.id === stageName
                        ) || stages[0];

                        if (targetStage) {
                            // Find existing lead card or create one
                            const existingLead = await db.query.kanbanLeads.findFirst({
                                where: and(
                                    eq(kanbanLeads.boardId, board.id),
                                    eq(kanbanLeads.contactId, ctx.contactId)
                                )
                            });

                            if (existingLead) {
                                // Move existing card
                                await db.update(kanbanLeads)
                                    .set({
                                        stageId: targetStage.id,
                                        currentStage: targetStage as any,
                                        lastStageChangeAt: new Date(),
                                    })
                                    .where(eq(kanbanLeads.id, existingLead.id));
                            } else {
                                // Create new card
                                await db.insert(kanbanLeads).values({
                                    companyId: ctx.companyId,
                                    boardId: board.id,
                                    stageId: targetStage.id,
                                    contactId: ctx.contactId,
                                    title: ctx.contactName || 'Lead',
                                    currentStage: targetStage as any,
                                    lastStageChangeAt: new Date(),
                                });
                            }

                            return { message: `CRM: moved to ${board.name} → ${targetStage.name}` };
                        }
                    }
                } catch (e) {
                    console.error('[FLOW-ENGINE] CRM Move Kanban error:', e);
                }
            }

            return { message: `CRM: moved to ${stageName || '(none)'}` };
        }

        // ---- Assign User ----
        case 'assign_user': {
            if (!ctx.contactId) return { message: 'Assign: no contact to assign' };

            const assignType = step.data.assign_type || 'user';
            
            try {
                if (assignType === 'user') {
                    const userId = step.data.user_id;
                    if (userId) {
                        await db.update(conversations)
                            .set({ assignedTo: userId })
                            .where(eq(conversations.contactId, ctx.contactId));
                        return { message: `Assign: user ${userId}` };
                    }
                } else if (assignType === 'team') {
                    const teamId = step.data.team_id;
                    if (teamId) {
                        await db.update(conversations)
                            .set({ teamId: teamId })
                            .where(eq(conversations.contactId, ctx.contactId));
                        return { message: `Assign: team ${teamId}` };
                    }
                } else if (assignType === 'random_in_team') {
                    const teamId = step.data.team_id;
                    const agentWeights = step.data.agent_weights as Array<{ user_id: string; weight: number }> || [];
                    
                    if (teamId && agentWeights.length > 0) {
                        // Weighted random selection
                        const totalWeight = agentWeights.reduce((sum, a) => sum + (a.weight || 0), 0);
                        if (totalWeight > 0) {
                            let randomNum = Math.random() * totalWeight;
                            let selectedUserId = agentWeights[0].user_id;
                            
                            for (const agent of agentWeights) {
                                if (randomNum < (agent.weight || 0)) {
                                    selectedUserId = agent.user_id;
                                    break;
                                }
                                randomNum -= (agent.weight || 0);
                            }
                            
                            if (selectedUserId) {
                                await db.update(conversations)
                                    .set({ assignedTo: selectedUserId, teamId: teamId })
                                    .where(eq(conversations.contactId, ctx.contactId));
                                return { message: `Assign: random to ${selectedUserId} (team ${teamId})` };
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[FLOW-ENGINE] Assign User error:', e);
            }

            return { message: 'Assign: missing configuration or failed' };
        }

        // ---- Add Tag ----
        case 'add_tag': {
            if (!ctx.contactId) return { message: 'Add Tag: no contact' };
            const tagIdOrName = step.data.tagId || step.data.tag_name;
            if (!tagIdOrName) return { message: 'Add Tag: no tag specified' };

            try {
                // Find tag by ID or name
                let tag = await db.query.tags.findFirst({
                    where: and(
                        eq(tags.companyId, ctx.companyId),
                        or(eq(tags.id, tagIdOrName), eq(tags.name, tagIdOrName))
                    )
                });
                
                if (!tag) {
                    // Auto-create tag Se não encontrado
                    const inserted = await db.insert(tags).values({
                        companyId: ctx.companyId,
                        name: tagIdOrName,
                    }).returning();
                    tag = inserted[0];
                }

                if (tag) {
                    await db.insert(contactsToTags).values({
                        contactId: ctx.contactId,
                        tagId: tag.id,
                        companyId: ctx.companyId
                    }).onConflictDoNothing();
                    if (!ctx.contactTags.includes(tag.name)) {
                        ctx.contactTags.push(tag.name);
                    }
                    return { message: `Add Tag: ${tag.name}` };
                }
            } catch (e) {
                console.error('[FLOW-ENGINE] Add Tag error:', e);
            }
            return { message: 'Add Tag: failed or not found' };
        }

        // ---- Remove Tag ----
        case 'remove_tag': {
            if (!ctx.contactId) return { message: 'Remove Tag: no contact' };
            const tagIdOrName = step.data.tagId || step.data.tag_name;
            if (!tagIdOrName) return { message: 'Remove Tag: no tag specified' };

            try {
                const tag = await db.query.tags.findFirst({
                    where: and(
                        eq(tags.companyId, ctx.companyId),
                        or(eq(tags.id, tagIdOrName), eq(tags.name, tagIdOrName))
                    )
                });

                if (tag) {
                    await db.delete(contactsToTags).where(
                        and(
                            eq(contactsToTags.contactId, ctx.contactId),
                            eq(contactsToTags.tagId, tag.id)
                        )
                    );
                    
                    const index = ctx.contactTags.indexOf(tag.name);
                    if (index !== -1) {
                        ctx.contactTags.splice(index, 1);
                    }
                    return { message: `Remove Tag: ${tag.name}` };
                }
            } catch (e) {
                console.error('[FLOW-ENGINE] Remove Tag error:', e);
            }
            return { message: 'Remove Tag: not found or failed' };
        }

        // ---- Bot Toggle ----
        case 'bot_toggle': {
            const action = step.data.action || 'enable';
            return { newVars: { bot_enabled: action === 'enable' }, message: `Bot: ${action} ` };
        }

        // ---- Stop ----
        case 'stop_bot':
            return { action: 'stop', message: 'Automation stopped' };

        // ---- Loop Restart ----
        case 'loop_restart': {
            const delayAmount = parseInt(step.data.delay_amount || '60');
            const delayUnit = step.data.delay_unit || 'minutes';
            const mult: Record<string, number> = { minutes: 60000, hours: 3600000, days: 86400000 };
            return { action: 'delay', delayMs: delayAmount * (mult[delayUnit] || 60000), message: `Loop restart after ${delayAmount} ${delayUnit} ` };
        }

        // ---- Lookup Lead ----
        case 'lookup_lead': {
            // Smart phone resolution: try multiple sources
            let rawPhone = '';

            // 1. Tentar phone_field da config (UI usa esse campo)
            if (step.data.phone_field) {
                // Se é um template {{...}}, interpolar
                const interpolated = await interpolateTemplate(step.data.phone_field, ctx);
                if (interpolated && interpolated !== step.data.phone_field) {
                    rawPhone = interpolated;
                }
                // Se é uma chave direta de variável
                if (!rawPhone && ctx.variables[step.data.phone_field]) {
                    rawPhone = ctx.variables[step.data.phone_field];
                }
            }

            // 2. Tentar phone_variable da config
            if (!rawPhone && step.data.phone_variable) {
                rawPhone = ctx.variables[step.data.phone_variable] || '';
            }

            // 3. Fallbacks diretos
            if (!rawPhone) rawPhone = ctx.contactPhone || '';
            if (!rawPhone) rawPhone = ctx.variables.contact_phone || '';
            if (!rawPhone) rawPhone = ctx.variables.customer_phone || '';
            if (!rawPhone) rawPhone = ctx.variables.phone || '';
            if (!rawPhone) rawPhone = ctx.variables.whatsapp || '';
            if (!rawPhone) rawPhone = ctx.variables.telefone || '';
            if (!rawPhone) rawPhone = ctx.variables.celular || '';
            if (!rawPhone) rawPhone = ctx.variables.mobile || '';
            if (!rawPhone) rawPhone = ctx.variables.whatsapp_number || '';

            // 4. Busca universal: procurar qualquer variável que pareça um telefone
            if (!rawPhone) {
                for (const [key, val] of Object.entries(ctx.variables)) {
                    if (typeof val === 'string' && /^\+?\d{10,15}$/.test(val.replace(/[\s\-\(\)]/g, ''))) {
                        rawPhone = val;
                        console.log(`[FLOW - ENGINE] Lookup: found phone in variable "${key}": ${val} `);
                        break;
                    }
                }
            }

            if (!rawPhone) {
                console.error(`[FLOW - ENGINE] Lookup: no phone found.Variables: `, Object.keys(ctx.variables));
                return { sourceHandle: 'not_found', message: 'Lookup: no phone provided' };
            }

            const phoneVariations = normalizePhoneVariations(rawPhone);
            console.log(`[FLOW - ENGINE] Lookup lead: raw = ${rawPhone}, variations = ${phoneVariations.join(', ')} `);

            // Buscar contato por qualquer variação do telefone — ALL at once
            const { inArray } = await import('drizzle-orm');
            const allMatches = await db.select().from(contacts).where(
                and(
                    inArray(contacts.phone, phoneVariations),
                    eq(contacts.companyId, ctx.companyId)
                )
            ).limit(10);

            // Preferir contato com nome (real) sobre auto-criado (sem nome)
            let foundContact = null;
            if (allMatches.length > 0) {
                // Prioridade: contato com whatsappName > com nome > primeiro
                foundContact = allMatches.find(c => (c as any).whatsappName)
                    || allMatches.find(c => c.name && c.name.trim() !== '')
                    || allMatches[0];
                console.log(`[FLOW - ENGINE] Lookup: ${allMatches.length} match(es) found, selected: ${foundContact.name} (${foundContact.phone})`);
            }

            if (foundContact) {
                // Lead encontrado — atualizar contexto
                ctx.contactId = foundContact.id;
                ctx.contactPhone = foundContact.phone;
                ctx.contactName = foundContact.name || '';
                ctx.contactEmail = foundContact.email || '';
                return {
                    sourceHandle: 'found',
                    newVars: {
                        lead_id: foundContact.id,
                        lead_name: foundContact.name,
                        lead_phone: foundContact.phone,
                        lead_email: foundContact.email || '',
                        lead_found: true,
                    },
                    message: `Lookup: found ${foundContact.name} (${foundContact.phone})`,
                };
            }

            // Lead não encontrado
            if (step.data.auto_create !== false) {
                // Criar lead automaticamente
                // Tentar nome: config default > variável 'nome' do webhook > fallback
                const defaultName = step.data.default_name
                    ? await interpolateTemplate(step.data.default_name, ctx)
                    : (ctx.variables.nome || ctx.variables.name || ctx.variables.lead_name || `Lead ${rawPhone} `);
                // Usar formato +55 para compatibilidade com Meta API
                const normalizedPhone = phoneVariations.find(p => p.startsWith('+55')) || phoneVariations.find(p => p.startsWith('55')) || phoneVariations[0];

                const [newContact] = await db.insert(contacts).values({
                    companyId: ctx.companyId,
                    name: defaultName,
                    phone: normalizedPhone,
                    email: ctx.variables.email || ctx.variables.contact_email || null,
                    status: 'ACTIVE',
                }).returning();

                ctx.contactId = newContact.id;
                ctx.contactPhone = newContact.phone;
                ctx.contactName = newContact.name;

                return {
                    sourceHandle: 'found', // Fluxo segue pelo 'found' após criar
                    newVars: {
                        lead_id: newContact.id,
                        lead_name: newContact.name,
                        lead_phone: newContact.phone,
                        lead_found: false,
                        lead_created: true,
                    },
                    message: `Lookup: created ${newContact.name} (${newContact.phone})`,
                };
            }

            return { sourceHandle: 'not_found', message: 'Lookup: not found, auto_create disabled' };
        }

        // ---- Send Template ----
        // Usa o mesmo padrão do campaign-sender.ts: chama sendWhatsappTemplateMessage diretamente
        case 'send_template': {
            const templateName = step.data.template_name;
            if (!templateName) return { message: 'Template: no template name' };

            const templateLanguage = step.data.template_language || 'pt_BR';

            // 1. Buscar template do DB para obter body text e connectionId
            let templateId = step.data.template_id || '';
            let templateConnectionId = step.data.template_connection_id || '';
            let bodyText = '';

            if (templateId) {
                const tpl = await db.query.messageTemplates.findFirst({
                    where: eq(messageTemplates.id, templateId)
                });
                if (tpl) {
                    if (!templateConnectionId) templateConnectionId = tpl.connectionId || '';
                    // Extrair body text dos components (mesmo padrão do campaign-sender)
                    const comps = tpl.components as any[] | null;
                    const bodyComp = comps?.find((c: any) => c.type === 'BODY');
                    bodyText = bodyComp?.text || '';
                }
            }
            if (!templateId) {
                const tpl = await db.query.messageTemplates.findFirst({
                    where: and(
                        eq(messageTemplates.name, templateName),
                        eq(messageTemplates.companyId, ctx.companyId)
                    )
                });
                if (tpl) {
                    templateId = tpl.id;
                    if (!templateConnectionId) templateConnectionId = tpl.connectionId || '';
                    const comps = tpl.components as any[] | null;
                    const bodyComp = comps?.find((c: any) => c.type === 'BODY');
                    bodyText = bodyComp?.text || '';
                }
            }

            const connId = templateConnectionId || ctx.connectionId;

            // 2. Interpolar variáveis do template (mesmo padrão do campaign-sender)
            const templateVars = (step.data.template_variables || []).map((v: any) => v.value || '');
            const interpolatedVars: string[] = [];
            for (const v of templateVars) {
                interpolatedVars.push(await interpolateTemplate(v, ctx));
            }

            // 3. Construir components array — EXATAMENTE como campaign-sender.ts faz
            const components: Record<string, unknown>[] = [];

            // 3a. HEADER — templates com IMAGE/VIDEO/DOCUMENT
            // Usa o MESMO padrão do campaign-sender: image.id (meta handle) — NÃO image.link (URLs expiram)
            if (templateId) {
                const tplData = await db.query.messageTemplates.findFirst({
                    where: eq(messageTemplates.id, templateId),
                    columns: { components: true },
                });
                const tplComps = (tplData?.components || []) as any[];
                const headerComp = tplComps.find((c: any) => c.type === 'HEADER');
                if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes((headerComp.format || '').toUpperCase())) {
                    const headerType = headerComp.format.toLowerCase() as 'image' | 'video' | 'document';
                    let headerAdded = false;

                    // Buscar connection para obter wabaId (necessário para meta handles)
                    const templateConn = await db.query.connections.findFirst({
                        where: eq(connections.id, connId),
                        columns: { wabaId: true },
                    });
                    const wabaId = templateConn?.wabaId || '';

                    // Prioridade 1: media_asset_id no step config
                    // Prioridade 2: buscar media_asset com meta_handle válido para o mesmo WABA
                    if (step.data.media_asset_id) {
                        // Buscar asset específico configurado no nó
                        const asset = await db.query.mediaAssets.findFirst({
                            where: eq(mediaAssets.id, step.data.media_asset_id),
                        });
                        if (asset) {
                            const handles = ((asset as any).metaHandles || []) as { handle: string; wabaId: string }[];
                            const match = handles.find((h) => h.wabaId === wabaId);
                            if (match) {
                                components.push({
                                    type: 'header',
                                    parameters: [{ type: headerType, [headerType]: { id: match.handle } }],
                                });
                                headerAdded = true;
                                console.log(`[FLOW - ENGINE] 📎 Header ${headerType} via config asset: handle = ${match.handle} `);
                            }
                        }
                    }

                    // Fallback: buscar qualquer media_asset com handle válido para o WABA
                    if (!headerAdded && wabaId) {
                        const allAssets = await db.select()
                            .from(mediaAssets)
                            .where(eq(mediaAssets.companyId, ctx.companyId));

                        for (const asset of allAssets) {
                            const handles = ((asset as any).metaHandles || []) as { handle: string; wabaId: string }[];
                            const match = handles.find((h) => h.wabaId === wabaId);
                            // Match tipo de mídia: image/* para IMAGE headers
                            const mimeMatch = headerType === 'image' && asset.mimeType?.startsWith('image/')
                                || headerType === 'video' && asset.mimeType?.startsWith('video/')
                                || headerType === 'document';
                            if (match && mimeMatch) {
                                components.push({
                                    type: 'header',
                                    parameters: [{ type: headerType, [headerType]: { id: match.handle } }],
                                });
                                headerAdded = true;
                                console.log(`[FLOW - ENGINE] 📎 Header ${headerType} via fallback asset: ${asset.name} handle = ${match.handle} `);
                                break;
                            }
                        }
                    }

                    // Último recurso: URL explícita do step config
                    if (!headerAdded && (step.data.header_image_url || step.data.header_media_url)) {
                        const headerUrl = step.data.header_image_url || step.data.header_media_url;
                        components.push({
                            type: 'header',
                            parameters: [{ type: headerType, [headerType]: { link: headerUrl } }],
                        });
                        headerAdded = true;
                        console.log(`[FLOW - ENGINE] 📎 Header ${headerType} via explicit URL`);
                    }

                    if (!headerAdded) {
                        console.warn(`[FLOW - ENGINE] ⚠️ Template requires ${headerType} header but no valid media handle or URL found`);
                    }
                }
            }

            // 3b. BODY params — extrair {{N}} do body text e criar bodyParams
            const bodyVariables = bodyText.match(/\{\{(\d+)\}\}/g) || [];
            const bodyParams = bodyVariables.map((placeholder: string, idx: number) => {
                // Usar o valor interpolado na mesma posição
                const text = interpolatedVars[idx] || 'N/A';
                return { type: 'text', text };
            });

            if (bodyParams.length > 0) {
                components.push({ type: 'body', parameters: bodyParams });
            }

            // 4. Normalizar telefone
            let sendToPhone = (ctx.contactPhone || ctx.contactId || '').replace(/[^0-9]/g, '');
            if (sendToPhone && !sendToPhone.startsWith('55') && sendToPhone.length <= 11) {
                sendToPhone = '55' + sendToPhone;
            }

            console.log(`[FLOW - ENGINE] 📨 Sending template "${templateName}"(${templateLanguage}) to ${sendToPhone} via connection ${connId} `);
            console.log(`[FLOW - ENGINE] 📨 Body params: `, bodyParams.map((p: any) => p.text));
            console.log(`[FLOW - ENGINE] 📨 Components: `, JSON.stringify(components));

            // 5. Chamar sendWhatsappTemplateMessage DIRETAMENTE (mesmo padrão do campaign-sender)
            let sendSuccess = false;
            let sendMessageId: string | null = null;
            let sendError = '';

            try {
                const response = await sendWhatsappTemplateMessage({
                    connectionId: connId,
                    to: sendToPhone,
                    templateName,
                    languageCode: templateLanguage,
                    components,
                });
                sendSuccess = true;
                sendMessageId = (response as any)?.messages?.[0]?.id || null;
                console.log(`[FLOW - ENGINE] ✅ Template sent successfully! MessageId: ${sendMessageId} `);
            } catch (err: any) {
                sendError = err?.message || 'Erro desconhecido ao enviar template';
                console.error(`[FLOW - ENGINE] ❌ Template send error: `, sendError);
            }

            // 6. Salvar mensagem na conversa do contato (sucesso ou falha)
            try {
                if (ctx.contactId) {
                    let conv = await db.query.conversations.findFirst({
                        where: and(
                            eq(conversations.contactId, ctx.contactId),
                            eq(conversations.connectionId, connId)
                        )
                    });
                    if (!conv) {
                        const [newConv] = await db.insert(conversations).values({
                            companyId: ctx.companyId,
                            contactId: ctx.contactId,
                            connectionId: connId,
                            status: 'IN_PROGRESS',
                        }).returning();
                        conv = newConv;
                        console.log(`[FLOW - ENGINE] 📝 Created conversation ${conv.id} for contact ${ctx.contactId}`);
                    }
                    const flowMsgId = sendMessageId || `flow - tpl - ${Date.now()} -${Math.random().toString(36).substring(7)} `;
                    await db.insert(messages).values({
                        companyId: ctx.companyId,
                        conversationId: conv.id,
                        senderType: 'SYSTEM',
                        content: `Template: ${templateName} `,
                        contentType: 'TEXT',
                        providerMessageId: flowMsgId,
                        status: sendSuccess ? 'SENT' : 'FAILED',
                    });
                    console.log(`[FLOW - ENGINE] ✅ Template message saved to conversation ${conv.id} `);
                }
            } catch (saveErr: any) {
                console.error(`[FLOW - ENGINE] ⚠️ Failed to save template message: `, saveErr?.message);
            }

            if (!sendSuccess) {
                return { message: `Template failed: ${sendError} ` };
            }
            return { message: `Template sent: ${templateName} (${templateLanguage}) → ${sendMessageId || 'ok'} ` };
        }

        // ---- AI Agent V2 ----
        case 'ai_agent':
        case 'ai': {
            const resolvedKeys = await resolveAIKeys(ctx.companyId);
            const OPENAI_KEY = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '';
            if (!OPENAI_KEY) {
                console.error('[FLOW-ENGINE] ❌ No OpenAI API key configured');
                return {
                    sourceHandle: 'completed',
                    newVars: { ai_error: 'No OpenAI API key configured' },
                    message: 'AI Agent: No API key configured — skipping AI node',
                };
            }
            let systemPrompt = await interpolateTemplate(
                step.data.system_message || step.data.description || step.data.systemPrompt || '', ctx
            );
            
            const openai = new OpenAI({ apiKey: OPENAI_KEY });
            // Força um modelo padrão OpenAI confiável apenas se o frontend enviar modelo do Gemini (pois o backend não tem suporte nativo ainda)
            let modelName = step.data.model || 'gpt-4o-mini';
            if (modelName.includes('gemini')) modelName = 'gpt-4o-mini';
            
            // Corrige o ID do modelo "ChatGPT 4.1" que foi adicionado na UI para o ID real da OpenAI
            if (modelName === 'chatgpt-4.1') modelName = 'gpt-4o';
            
            const temperature = typeof step.data.temperature === 'number' ? step.data.temperature : 0.7;

            // Determine if we're in dialogue mode to use chat-based approach
            const isDialogueMode = !!step.data.dialogue_mode;

            // ── Google Calendar Tool Setup ───────────────────────────────────
            let calendarTools: object[] = [];
            let calendarToolConfig: import('@/lib/ai-calendar-tools').CalendarToolConfig | null = null;

            if (step.data.google_calendar_enabled) {
                try {
                    const { buildCalendarTools, buildCalendarSystemContext, checkGoogleCredential } =
                        await import('@/lib/ai-calendar-tools');
                    const hasCred = await checkGoogleCredential(ctx.companyId);
                    if (hasCred) {
                        calendarToolConfig = {
                            companyId: ctx.companyId,
                            createMeetLink: step.data.google_meet_enabled ?? false,
                            durationMinutes: step.data.appointment_duration ?? 30,
                            workingHoursStart: step.data.working_hours_start ?? 9,
                            workingHoursEnd: step.data.working_hours_end ?? 18,
                            calendarInstruction: step.data.calendar_instruction || '',
                        };
                        calendarTools = buildCalendarTools(calendarToolConfig);
                        // Prepend calendar context to system prompt
                        const calCtx = buildCalendarSystemContext(calendarToolConfig);
                        systemPrompt = calCtx + (systemPrompt ? '\n\n' + systemPrompt : '');
                        console.log('[FLOW-ENGINE] 📅 Google Calendar tools enabled for this agent');
                    } else {
                        console.warn('[FLOW-ENGINE] ⚠️ google_calendar_enabled=true but no active credential found');
                    }
                } catch (calErr) {
                    console.error('[FLOW-ENGINE] Calendar tools setup error:', calErr);
                }
            }

            // Build webhook vars context string (used in both modes)
            let webhookContext = '';
            if (step.data.include_webhook_vars && step.data.webhook_var_keys?.length) {
                const webhookData: string[] = [];
                for (const key of step.data.webhook_var_keys) {
                    if (ctx.variables[key] !== undefined) {
                        webhookData.push(`${key}: ${ctx.variables[key]}`);
                    }
                }
                if (webhookData.length) {
                    webhookContext = `\n\n[Dados do Webhook]:\n${webhookData.join('\n')}`;
                }
            }

            let responseText = '';
            let tokenInfo: any = null;

            if (isDialogueMode) {
                // ===== DIALOGUE MODE: OpenAI Chat Completion =====
                const chatHistory: any[] = [];
                
                // 1. System Prompt + Webhook Data
                const fullSystem = (systemPrompt + webhookContext).trim();
                if (fullSystem) chatHistory.push({ role: 'system', content: fullSystem });

                // 2. Chat history from DB
                if (step.data.include_history !== false && ctx.contactId) {
                    const historyCount = step.data.history_count || 20;
                    try {
                        const conversation = await db.query.conversations.findFirst({
                            where: and(
                                eq(conversations.contactId, ctx.contactId),
                                eq(conversations.companyId, ctx.companyId)
                            ),
                            orderBy: [desc(conversations.lastMessageAt)],
                        });

                        if (conversation) {
                            const recentMessages = await db.select()
                                .from(messages)
                                .where(eq(messages.conversationId, conversation.id))
                                .orderBy(desc(messages.sentAt))
                                .limit(historyCount);

                            let totalChars = 0;
                            const MAX_CHARS = 30000; // ~7500 tokens limit to prevent context overflow
                            const keptMessages: any[] = [];

                            for (const m of recentMessages) {
                                // 🔧 BUG FIX: Excluir mensagens de sistema do histórico enviado ao GPT
                                if (m.senderType === 'SYSTEM') continue;

                                // 🔧 BUG FIX: Limpar tokens contaminados do histórico e usar aiTranscription para áudios
                                const content = ((m as any).aiTranscription || m.content || '').replace(/_+TOKENS:\d+/g, '').trim();
                                if (!content) continue;

                                if (totalChars + content.length > MAX_CHARS) {
                                    console.log(`[FLOW-ENGINE] ✂️ Context limit reached. Truncating older messages (Char count: ${totalChars})`);
                                    break; // Stop adding older messages to stay within token limits
                                }
                                totalChars += content.length;

                                const isLead = m.senderType === 'USER' || m.senderType === 'CONTACT';
                                keptMessages.push({ role: isLead ? 'user' : 'assistant', content });
                            }

                            // Reverse to chronological order after safely filtering
                            chatHistory.push(...keptMessages.reverse());
                        }
                    } catch (e) {
                        console.warn('[FLOW-ENGINE] Failed to fetch chat history for dialogue:', e);
                    }
                }

                // Remove the last entry if it's a 'user' message (it might be the trigger)
                if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
                    chatHistory.pop();
                }

                // 3. The lead's current message
                const leadMessage = ctx.variables.last_response || ctx.variables.message_text || 'Olá';
                chatHistory.push({ role: 'user', content: leadMessage });

                console.log(`[FLOW-ENGINE] 💬 Dialogue mode: ${chatHistory.length} history entries, sending new message`);

                try {
                    const completionParams: Parameters<typeof openai.chat.completions.create>[0] = {
                        model: modelName,
                        messages: chatHistory,
                        temperature,
                        ...(calendarTools.length > 0 && { tools: calendarTools as any, tool_choice: 'auto' as const }),
                    };

                    let completion = await openai.chat.completions.create(completionParams);

                    // ── Tool-calling loop for Google Calendar ────────────────
                    let toolIterations = 0;
                    const maxToolIterations = step.data.max_iterations || 5;

                    while (
                        completion.choices[0]?.finish_reason === 'tool_calls' &&
                        toolIterations < maxToolIterations
                    ) {
                        const toolCalls = completion.choices[0]?.message?.tool_calls || [];
                        chatHistory.push(completion.choices[0].message);

                        const { executeCalendarTool } = await import('@/lib/ai-calendar-tools');

                        for (const toolCall of toolCalls) {
                            let toolArgs: Record<string, unknown> = {};
                            try { toolArgs = JSON.parse(toolCall.function.arguments); } catch {}

                            console.log(`[FLOW-ENGINE] 🔧 Tool call: ${toolCall.function.name}`, toolArgs);

                            const toolResult = await executeCalendarTool(
                                toolCall.function.name,
                                toolArgs,
                                ctx.companyId,
                                {
                                    contactName: ctx.contactName || '',
                                    contactEmail: ctx.contactEmail || null,
                                    contactPhone: ctx.contactPhone,
                                    contactId: ctx.contactId,
                                    conversationId: ctx.variables.conversation_id as string | undefined,
                                    config: calendarToolConfig!,
                                }
                            );

                            console.log(`[FLOW-ENGINE] ✅ Tool result: ${toolCall.function.name}`, toolResult);

                            chatHistory.push({
                                role: 'tool' as const,
                                tool_call_id: toolCall.id,
                                content: JSON.stringify(toolResult.data || toolResult),
                            });

                            // Auto-send Meet link to lead after successful appointment creation
                            if (
                                toolCall.function.name === 'create_appointment' &&
                                toolResult.success &&
                                toolResult.meetLink &&
                                step.data.google_meet_enabled
                            ) {
                                try {
                                    const meetMsg = `📅 Link da sua videochamada:\n${toolResult.meetLink}`;
                                    await sendUnifiedMessage({
                                        provider: 'baileys',
                                        connectionId: ctx.connectionId,
                                        to: ctx.contactPhone || '',
                                        message: meetMsg,
                                    });
                                    console.log('[FLOW-ENGINE] 📅 Meet link sent to lead');
                                } catch (meetSendErr) {
                                    console.warn('[FLOW-ENGINE] Failed to send Meet link:', meetSendErr);
                                }
                            }
                        }

                        completion = await openai.chat.completions.create({
                            ...completionParams,
                            messages: chatHistory,
                        });
                        toolIterations++;
                    }

                    responseText = completion.choices[0]?.message?.content?.trim() || '';
                    if (completion.usage) {
                        tokenInfo = {
                            promptTokens: completion.usage.prompt_tokens,
                            completionTokens: completion.usage.completion_tokens,
                            totalTokens: completion.usage.total_tokens,
                        };
                    }
                } catch (error: any) {
                    console.error('[FLOW-ENGINE] OpenAI Dialogue Error:', error.message || error);
                    // 🔧 BUG FIX: Graceful fallback em caso de erro 429/cota OpenAI
                    // Em vez de crashar e quebrar a automação (jogando "Falha no node"), informamos instabilidade.
                    const isQuotaError = error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('insufficient');
                    if (isQuotaError) {
                        responseText = 'Peço desculpas, mas estou enfrentando uma leve instabilidade no sistema. Por favor, aguarde um instante enquanto direcionamos para um especialista.';
                    } else {
                        throw error; // Let the step block catch it
                    }
                }

            } else {
                // ===== SINGLE-SHOT MODE: OpenAI generateContent equivalent =====
                const inputParts: string[] = [];

                if (step.data.include_lead_message !== false) {
                    const leadMessage = ctx.variables.last_response || ctx.variables.message_text || '';
                    if (leadMessage) {
                        inputParts.push(`[Mensagem do Lead]: ${leadMessage}`);
                    }
                }

                if (webhookContext) {
                    inputParts.push(webhookContext);
                }

                if (step.data.include_history !== false && ctx.contactId) {
                    const historyCount = step.data.history_count || 10;
                    try {
                        const conversation = await db.query.conversations.findFirst({
                            where: and(
                                eq(conversations.contactId, ctx.contactId),
                                eq(conversations.companyId, ctx.companyId)
                            ),
                            orderBy: [desc(conversations.lastMessageAt)],
                        });

                        if (conversation) {
                            const recentMessages = await db.select()
                                .from(messages)
                                .where(eq(messages.conversationId, conversation.id))
                                .orderBy(desc(messages.sentAt))
                                .limit(historyCount);

                            if (recentMessages.length > 0) {
                                const historyFormatted = recentMessages
                                    .reverse()
                                    .map(m => {
                                        const role = m.senderType === 'USER' || m.senderType === 'CONTACT' ? 'Lead' : 'Assistente';
                                        const cleanContent = (m.content || '').replace(/_+TOKENS:\d+/g, '').trim();
                                        return `${role}: ${cleanContent}`;
                                    })
                                    .join('\n');
                                inputParts.push(`[Histórico de Conversa(últimas ${recentMessages.length} msgs)]:\n${historyFormatted}`);
                            }
                        }
                    } catch (e) {
                        console.warn('[FLOW-ENGINE] Failed to fetch chat history:', e);
                    }
                }

                const userInput = inputParts.join('\n\n') || 'Sem input disponível';
                
                const messagesPayload: any[] = [];
                if (systemPrompt) messagesPayload.push({ role: 'system', content: systemPrompt });
                messagesPayload.push({ role: 'user', content: userInput });

                try {
                    const completion = await openai.chat.completions.create({
                        model: modelName,
                        messages: messagesPayload,
                        temperature,
                    });
    
                    responseText = completion.choices[0]?.message?.content?.trim() || '';
                    if (completion.usage) {
                        tokenInfo = {
                            promptTokens: completion.usage.prompt_tokens,
                            completionTokens: completion.usage.completion_tokens,
                            totalTokens: completion.usage.total_tokens,
                        };
                    }
                } catch (error: any) {
                    console.error('[FLOW-ENGINE] OpenAI Single-Shot Error:', error.message || error);
                    // 🔧 BUG FIX: Graceful fallback em caso de erro 429/cota OpenAI
                    const isQuotaError = error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('insufficient');
                    if (isQuotaError) {
                        responseText = 'Peço desculpas, mas estou enfrentando uma leve instabilidade no sistema. Por favor, aguarde um instante enquanto direcionamos para um especialista.';
                    } else {
                        throw error;
                    }
                }
            }

            if (tokenInfo) {
                console.log(`[FLOW-ENGINE] 📊 Tokens: prompt=${tokenInfo.promptTokens}, completion=${tokenInfo.completionTokens}, total=${tokenInfo.totalTokens}`);
            }

            // 3. ENVIAR RESPOSTA ao lead (mesmo padrão do chat.ts / auto-approach)
            if (responseText && ctx.contactPhone) {
                // Buscar conversa do lead (para connectionId correto + salvar mensagem)
                let aiConversation: any = null;
                try {
                    aiConversation = await db.query.conversations.findFirst({
                        where: and(
                            eq(conversations.contactId, ctx.contactId),
                            eq(conversations.companyId, ctx.companyId)
                        ),
                        with: { connection: true },
                        orderBy: [desc(conversations.lastMessageAt)],
                    });
                } catch (e) {
                    console.warn('[FLOW-ENGINE] Failed to find conversation:', e);
                }

                // Determinar conexão: conversa > override > fallback
                let aiConnectionId = step.data.connection_id || '';
                if (!aiConnectionId && aiConversation?.connectionId) {
                    aiConnectionId = aiConversation.connectionId;
                }
                if (!aiConnectionId) aiConnectionId = ctx.connectionId;

                // Determinar provider real buscando a conexão resolvida
                let aiProvider = 'apicloud';
                try {
                    const resolvedConn = await db.query.connections.findFirst({
                        where: eq(connections.id, aiConnectionId)
                    });
                    if (['baileys', 'evolution'].includes(resolvedConn?.connectionType || '')) {
                        aiProvider = 'baileys';
                    }
                } catch (e) {
                    console.warn('[FLOW-ENGINE] Failed to resolve connection type for ai_agent, falling back to ctx.provider:', e);
                    aiProvider = ctx.provider || 'apicloud';
                }

                console.log(`[FLOW - ENGINE] 🤖 AI sending via ${aiProvider} connection = ${aiConnectionId} to = ${ctx.contactPhone} `);

                // Dividir mensagem em partes para simular humano
                const parts = responseText.split('\n\n').filter((s: string) => s.trim());
                for (let i = 0; i < parts.length; i++) {
                    if (i > 0) await new Promise(r => setTimeout(r, 2000));
                    try {
                        // Enviar via sendUnifiedMessage (mesmo que chat.ts / auto-approach)
                        const sendResult = await sendUnifiedMessage({
                            provider: aiProvider as any,
                            connectionId: aiConnectionId,
                            to: ctx.contactPhone,
                            message: parts[i].trim(),
                        });

                        if (!sendResult.success) {
                            console.error(`[FLOW - ENGINE] ❌ AI send failed: ${sendResult.error} `);
                            continue;
                        }

                        console.log(`[FLOW - ENGINE] ✅ AI message sent: ${sendResult.messageId || 'ok'} `);

                        // Salvar no DB (mesmo padrão do auto-approach: company_id + SENT)
                        if (aiConversation) {
                            try {
                                await db.insert(messages).values({
                                    companyId: ctx.companyId,
                                    conversationId: aiConversation.id,
                                    providerMessageId: sendResult.messageId || null,
                                    senderType: 'AI',
                                    // 🔧 BUG FIX: Nunca persistir tokens no content — causava contaminação no histórico
                                    // e reprodução do padrão ___TOKENS pela IA nas próximas mensagens ao WhatsApp
                                    content: parts[i].trim(),
                                    contentType: 'TEXT',
                                    status: 'SENT',
                                    sentAt: new Date(),
                                    isAiGenerated: true,
                                });
                                await db.update(conversations)
                                    .set({ lastMessageAt: new Date() })
                                    .where(eq(conversations.id, aiConversation.id));
                            } catch (dbErr) {
                                console.warn('[FLOW-ENGINE] DB save failed:', dbErr);
                            }
                        }
                    } catch (sendErr) {
                        console.error(`[FLOW - ENGINE] ❌ AI message exception: `, sendErr);
                    }
                }
            }

            // 4. MODO DIÁLOGO
            if (step.data.dialogue_mode) {
                const turnCount = (ctx.variables[`ai_turns_${step.id} `] || 0) + 1;
                const maxTurns = step.data.max_turns || 10;

                // Verificar se objetivo foi cumprido
                if (step.data.completion_condition) {
                    try {
                        const evalPrompt = `Com base na conversa abaixo, a seguinte condição foi satisfeita ?\n\nCondição: "${step.data.completion_condition}"\n\nÚltima mensagem do lead: "${ctx.variables.last_response || ''}"\nResposta do agente: "${responseText}"\n\nResponda APENAS com SIM ou NÃO.`;
                        const evalResult = await openai.chat.completions.create({
                            model: 'gpt-4o-mini',
                            messages: [{ role: 'user', content: evalPrompt }],
                            temperature: 0,
                        });
                        const evalResponse = (evalResult.choices[0]?.message?.content?.trim() || '').toUpperCase();

                        if (evalResponse.includes('SIM')) {
                            return {
                                sourceHandle: 'completed',
                                newVars: {
                                    last_ai_response: responseText,
                                    [`ai_${step.id} `]: responseText,
                                    [`ai_turns_${step.id} `]: turnCount,
                                    ai_completion_reason: 'objective_met',
                                    ...(tokenInfo ? { ai_tokens: tokenInfo } : {}),
                                },
                                message: `AI Agent: objective met after ${turnCount} turns${tokenInfo ? ` | Tokens: ${tokenInfo.totalTokens}` : ''} `,
                            };
                        }
                    } catch (e) {
                        console.warn('[FLOW-ENGINE] AI completion check failed:', e);
                    }
                }

                // Verificar max turnos
                if (turnCount >= maxTurns) {
                    return {
                        sourceHandle: 'max_turns',
                        newVars: {
                            last_ai_response: responseText,
                            [`ai_${step.id} `]: responseText,
                            [`ai_turns_${step.id} `]: turnCount,
                            ai_completion_reason: 'max_turns_reached',
                            ...(tokenInfo ? { ai_tokens: tokenInfo } : {}),
                        },
                        message: `AI Agent: max turns(${maxTurns}) reached${tokenInfo ? ` | Tokens: ${tokenInfo.totalTokens}` : ''} `,
                    };
                }

                // Ainda em diálogo — pause e esperar próxima mensagem
                const newVarsToReturn: Record<string, any> = {
                    last_ai_response: responseText,
                    [`ai_${step.id} `]: responseText,
                    [`ai_turns_${step.id} `]: turnCount,
                    ...(tokenInfo ? { ai_tokens: tokenInfo } : {}),
                };

                const timeoutEnabled = step.data.timeout_enabled || step.data.response_timeout_enabled;
                if (timeoutEnabled) {
                    const timeoutAmountStr = step.data.timeout_amount || step.data.response_timeout_minutes || '30';
                    const timeoutAmount = parseInt(String(timeoutAmountStr));
                    const timeoutUnit = step.data.timeout_unit || 'minutes';
                    const multipliers: Record<string, number> = {
                        seconds: 1000,
                        minutes: 60 * 1000,
                        hours: 60 * 60 * 1000,
                        days: 24 * 60 * 60 * 1000,
                    };
                    const ms = timeoutAmount * (multipliers[timeoutUnit] || 60000);
                    if (ms > 0) {
                        newVarsToReturn._ai_timeout_at = Date.now() + ms;
                        newVarsToReturn._ai_step_id = step.id;
                    }
                }

                return {
                    action: 'pause',
                    newVars: newVarsToReturn,
                    message: `AI Agent: turn ${turnCount}/${maxTurns}, waiting for lead response${tokenInfo ? ` | Tokens: ${tokenInfo.totalTokens}` : ''}`,
                };
            }

            // 5. MODO SINGLE-SHOT (sem diálogo)
            return {
                sourceHandle: 'completed',
                newVars: {
                    last_ai_response: responseText,
                    [`ai_${step.id} `]: responseText,
                    ...(tokenInfo ? { ai_tokens: tokenInfo } : {}),
                },
                message: `AI: ${responseText.slice(0, 80)}${tokenInfo ? ` | Tokens: ${tokenInfo.totalTokens}` : ''} `,
            };
        }

        // ---- Follow Up AI ----
        case 'follow_up_ai': {
            if (ctx.variables[`follow_up_sent_${step.id}`]) {
                // If it resumes and this is true, it means the lead replied.
                return {
                    sourceHandle: 'responded',
                    message: 'Follow-Up: Lead respondeu',
                };
            }

            const resolvedKeys = await resolveAIKeys(ctx.companyId);
            const provider = step.data.provider || 'openai';
            const OPENAI_KEY = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '';
            const GEMINI_KEY = resolvedKeys.geminiApiKey || process.env.GEMINI_API_KEY || '';
            
            if (provider === 'openai' && !OPENAI_KEY) return { message: 'Follow-Up: No OpenAI API key' };
            if (provider === 'gemini' && !GEMINI_KEY) return { message: 'Follow-Up: No Gemini API key' };
            
            if (step.data.require_global_bot || step.data.require_lead_bot) {
                if (ctx.variables.bot_enabled === false && step.data.require_lead_bot) {
                    return { message: 'Follow-Up: Bot disabled for lead' };
                }
            }

            const modelName = step.data.model || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash');
            const followupPrompt = await interpolateTemplate(step.data.followup_prompt || '', ctx);
            
            const historyCount = step.data.history_count || 20;
            const chatHistory: any[] = [];
            let aiConversation = null;

            if (ctx.contactId) {
                try {
                    aiConversation = await db.query.conversations.findFirst({
                        where: and(
                            eq(conversations.contactId, ctx.contactId),
                            eq(conversations.companyId, ctx.companyId)
                        ),
                        with: { connection: true },
                        orderBy: [desc(conversations.lastMessageAt)],
                    });

                    if (aiConversation) {
                        const recentMessages = await db.select()
                            .from(messages)
                            .where(eq(messages.conversationId, aiConversation.id))
                            .orderBy(desc(messages.sentAt))
                            .limit(historyCount);

                        const chronological = recentMessages.reverse();
                        for (const m of chronological) {
                            if (m.senderType === 'SYSTEM') continue;
                            const isLead = m.senderType === 'USER' || m.senderType === 'CONTACT';
                            const role = isLead ? 'user' : 'assistant';
                            const content = (m.content || '').replace(/_+TOKENS:\d+/g, '').trim();
                            if (!content) continue;
                            chatHistory.push({ role, content });
                        }
                    }
                } catch (e) {}
            }
            
            const historyText = chatHistory.map(m => `${m.role === 'user' ? 'Lead' : 'Assessor'}: ${m.content}`).join('\n');
            const systemContext = `[Contexto do Sistema]: O lead leu a última mensagem do Assessor no histórico acima, mas NÃO RESPONDEU. Sua tarefa é gerar uma mensagem de "repescagem" (follow-up) para tentar reengajar o lead, seguindo ESTRITAMENTE o objetivo e as regras acima. NÃO repita a mensagem anterior, e crie algo novo que estimule a resposta.`;
            const finalPrompt = `${followupPrompt}\n\n[Histórico Recente]:\n${historyText || 'Sem histórico'}\n\n${systemContext}`;
            
            let responseText = '';
            let tokenInfo: any = null;
            
            if (provider === 'openai') {
                const openai = new OpenAI({ apiKey: OPENAI_KEY });
                try {
                    const completion = await openai.chat.completions.create({
                        model: modelName,
                        messages: [{ role: 'user', content: finalPrompt }],
                        temperature: 0.7,
                    });
                    responseText = completion.choices[0]?.message?.content?.trim() || '';
                    if (completion.usage) {
                        tokenInfo = { totalTokens: completion.usage.total_tokens };
                    }
                } catch (e) {
                    console.error('[FLOW-ENGINE] Follow-Up OpenAI error:', e);
                    return { message: 'Follow-Up erro na OpenAI' };
                }
            } else {
                try {
                    const { GoogleGenerativeAI } = require('@google/generative-ai');
                    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
                    const geminiModel = genAI.getGenerativeModel({ model: modelName });
                    const result = await geminiModel.generateContent(finalPrompt);
                    responseText = result.response.text().trim();
                    tokenInfo = { totalTokens: result.response.usageMetadata?.totalTokenCount || 0 };
                } catch (e) {
                    console.error('[FLOW-ENGINE] Follow-Up Gemini error:', e);
                    return { message: 'Follow-Up erro no Gemini' };
                }
            }
            
            const parts = step.data.format_for_send 
                ? responseText.split('⌁⌁⌁').map(p => p.trim()).filter(Boolean)
                : [responseText];

            let aiConnectionId = step.data.connection_id || aiConversation?.connectionId || ctx.connectionId;

            // Determinar provider real buscando a conexão resolvida
            let aiProvider = 'apicloud';
            try {
                const resolvedConn = await db.query.connections.findFirst({
                    where: eq(connections.id, aiConnectionId)
                });
                if (['baileys', 'evolution'].includes(resolvedConn?.connectionType || '')) {
                    aiProvider = 'baileys';
                }
            } catch (e) {
                console.warn('[FLOW-ENGINE] Failed to resolve connection type for follow_up_ai, falling back to ctx.provider:', e);
                aiProvider = ctx.provider || 'apicloud';
            }

            for (let i = 0; i < parts.length; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, 2000));
                try {
                    const sendResult = await sendUnifiedMessage({
                        provider: aiProvider as any,
                        connectionId: aiConnectionId,
                        to: ctx.contactPhone,
                        message: parts[i],
                    });
                    if (sendResult.success && aiConversation) {
                        await db.insert(messages).values({
                            companyId: ctx.companyId,
                            conversationId: aiConversation.id,
                            providerMessageId: sendResult.messageId || null,
                            senderType: 'AI',
                            content: parts[i],
                            contentType: 'TEXT',
                            status: 'SENT',
                            sentAt: new Date(),
                            isAiGenerated: true,
                        });
                        await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, aiConversation.id));
                    }
                } catch (e) {}
            }
            
            const timeoutAmountStr = step.data.timeout_amount || step.data.response_timeout_minutes || '8';
            const timeoutAmount = parseInt(String(timeoutAmountStr));
            const timeoutUnit = step.data.timeout_unit || (step.data.response_timeout_minutes ? 'minutes' : 'hours');
            const multipliers: Record<string, number> = {
                seconds: 1000, minutes: 60 * 1000, hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000,
            };
            const ms = timeoutAmount * (multipliers[timeoutUnit] || 60000);
            
            const newVarsToReturn: Record<string, any> = {
                [`follow_up_sent_${step.id}`]: true,
                last_ai_response: responseText,
                ...(tokenInfo ? { ai_tokens: tokenInfo } : {}),
            };
            
            if (ms > 0) {
                newVarsToReturn._ai_timeout_at = Date.now() + ms;
                newVarsToReturn._ai_step_id = step.id;
            }
            
            return {
                action: 'pause',
                newVars: newVarsToReturn,
                message: `Follow-Up enviado, aguardando resposta... (Timeout: ${timeoutAmount} ${timeoutUnit})`,
            };
        }

        // ---- Intent Router (AI classification) ----
        case 'intent_router': {
            const intents = step.data.intents || [];
            if (intents.length === 0) return { sourceHandle: 'fallback', message: 'Intent: no intents configured' };

            const instruction = step.data.instruction || 'Classifique a intenção do usuário.';
            const model = step.data.model || 'gpt-4o-mini';
            const contextWindow = step.data.context_window || 1;

            let chatHistoryText = '';
            
            if (contextWindow > 1 && ctx.conversationId) {
                try {
                    const recentMessages = await db.select()
                        .from(messages)
                        .where(eq(messages.conversationId, ctx.conversationId))
                        .orderBy(desc(messages.sentAt))
                        .limit(contextWindow);
                    
                    const chronological = recentMessages.reverse();
                    for (const m of chronological) {
                        if (m.senderType === 'SYSTEM') continue;
                        const role = m.senderType === 'USER' || m.senderType === 'CONTACT' ? 'Cliente' : 'Atendente';
                        const content = ((m as any).aiTranscription || m.content || '').replace(/_+TOKENS:\d+/g, '').trim();
                        if (content) chatHistoryText += `${role}: ${content}\n`;
                    }
                } catch (e) {
                    console.warn('[FLOW-ENGINE] Failed to fetch chat history for intent_router:', e);
                }
            }
            
            if (!chatHistoryText) {
                const lastMessage = ctx.variables.last_response || ctx.variables.message_text || '';
                chatHistoryText = `Cliente: ${lastMessage}`;
            }

            const classificationPrompt = `
Você é um roteador de intenções.
Sua tarefa é analisar o histórico de conversa e classificar a ÚLTIMA mensagem do cliente em EXATAMENTE UMA destas categorias disponíveis:
[${intents.join(', ')}]

Instrução Customizada do Roteador:
"${instruction}"

Histórico da Conversa:
${chatHistoryText}

REGRAS RÍGIDAS:
1. Responda ÚNICA E EXCLUSIVAMENTE com o nome exato da categoria escolhida.
2. Não adicione pontuação, explicações ou texto extra.
3. Se a intenção do cliente não se encaixar claramente em nenhuma das categorias acima, responda EXATAMENTE a palavra "OUTRO".
`.trim();

            const resolvedKeys = await resolveAIKeys(ctx.companyId);
            const OPENAI_KEY = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '';
            const openai = new OpenAI({ apiKey: OPENAI_KEY });

            let classified = 'OUTRO';
            try {
                const result = await openai.chat.completions.create({
                    model: model,
                    messages: [{ role: 'user', content: classificationPrompt }],
                    temperature: 0,
                });
                classified = (result.choices[0]?.message?.content?.trim() || '').toUpperCase();
            } catch (e) {
                console.error('[FLOW-ENGINE] OpenAI error in intent_router:', e);
            }
            
            // Clean up possible hallucinations (e.g. removing quotes or periods)
            classified = classified.replace(/['"\.]/g, '');

            // 1. Tentar exact match
            let matchedIntent = intents.find((i: string) => classified === i.toUpperCase());
            
            // 2. Se não achar, tentar partial match robusto
            if (!matchedIntent) {
                 matchedIntent = intents.find((i: string) => classified.includes(i.toUpperCase()));
            }

            return {
                sourceHandle: matchedIntent || 'fallback',
                newVars: { classified_intent: matchedIntent || 'outro' },
                message: `Intent: ${matchedIntent || 'fallback'} `,
            };
        }

        // ---- Follow-up AI (V2: time-based + AI prompt) ----
        case 'follow_up_ai': {
            const timeoutMinutes = parseInt(step.data.response_timeout_minutes || '60');

            // Check if lead has responded recently (within the timeout window)
            let hasRespondedRecently = !!ctx.variables.last_response;

            // More accurate: check last message timestamp from DB
            if (ctx.contactId && ctx.companyId) {
                try {
                    const lastIncoming = await db.query.messages.findFirst({
                        where: and(
                            eq(messages.conversationId, ctx.conversationId || ''),
                            eq(messages.direction, 'incoming')
                        ),
                        orderBy: [desc(messages.createdAt)],
                    });

                    if (lastIncoming?.createdAt) {
                        const minutesSinceLastMsg = (Date.now() - new Date(lastIncoming.createdAt).getTime()) / 60000;
                        hasRespondedRecently = minutesSinceLastMsg < timeoutMinutes;
                    }
                } catch (e) {
                    console.error('[FLOW-ENGINE] Follow-up AI timestamp check error:', e);
                }
            }

            // If not responded and followup_prompt is configured, generate AI follow-up
            if (!hasRespondedRecently && step.data.followup_prompt) {
                try {
                    const resolvedKeys = await resolveAIKeys(ctx.companyId);
                    const OPENAI_KEY = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '';
                    const openai = new OpenAI({ apiKey: OPENAI_KEY });

                    const prompt = await interpolateTemplate(step.data.followup_prompt, ctx);
                    const result = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7,
                    });
                    const followUpMsg = result.choices[0]?.message?.content?.trim() || '';

                    if (followUpMsg) {
                        await sendUnifiedMessage({
                            provider: ctx.provider as any,
                            connectionId: ctx.connectionId,
                            to: ctx.contactPhone || ctx.contactId,
                            message: followUpMsg,
                        });
                    }
                } catch (e) {
                    console.error('[FLOW-ENGINE] Follow-up AI generation error:', e);
                }
            }

            return {
                sourceHandle: hasRespondedRecently ? 'responded' : 'not_responded',
                newVars: { followup_result: hasRespondedRecently ? 'responded' : 'not_responded' },
                message: `Follow-up: ${hasRespondedRecently ? 'responded' : 'not_responded'}`,
            };
        }

        // ---- Send AI Response ----
        case 'send_ai_response': {
            const aiResponse = ctx.variables.last_ai_response || '';
            if (aiResponse) {
                // Split by paragraphs if enabled
                const splits = step.data.split_enabled !== false
                    ? aiResponse.split('\n\n').filter((s: string) => s.trim())
                    : [aiResponse];

                const delaySec = step.data.delay_seconds || 2;
                for (let i = 0; i < splits.length; i++) {
                    if (i > 0) await new Promise(r => setTimeout(r, delaySec * 1000));
                    await sendUnifiedMessage({
                        provider: ctx.provider as any,
                        connectionId: ctx.connectionId,
                        to: ctx.contactPhone || ctx.contactId,
                        message: splits[i].trim(),
                    });
                }
            }
            return { message: `AI response sent(${aiResponse.length} chars)` };
        }

        // ---- HTTP Request (Full V2) ----
        case 'http_request': {
            const rawUrl = step.data.url;
            if (!rawUrl) return { message: 'HTTP: no URL' };

            const method = step.data.method || 'GET';
            const headers: Record<string, string> = {};
            const responseVarName = step.data.response_var || 'http_response';

            // 1. Custom headers from UI config
            if (Array.isArray(step.data.headers)) {
                for (const h of step.data.headers) {
                    if (h.key && h.value) {
                        headers[h.key] = await interpolateTemplate(h.value, ctx);
                    }
                }
            }

            // 2. Auth — bearer, api_key, basic
            const authType = step.data.auth_type || 'none';
            if (authType === 'bearer' && step.data.auth_token) {
                headers['Authorization'] = `Bearer ${step.data.auth_token}`;
            } else if (authType === 'api_key' && step.data.auth_header_name && step.data.auth_token) {
                headers[step.data.auth_header_name] = step.data.auth_token;
            } else if (authType === 'basic' && step.data.auth_user) {
                const credentials = Buffer.from(`${step.data.auth_user}:${step.data.auth_pass || ''}`).toString('base64');
                headers['Authorization'] = `Basic ${credentials}`;
            }

            // 3. URL interpolation + query params
            let finalUrl = await interpolateTemplate(rawUrl, ctx);
            if (Array.isArray(step.data.query_params) && step.data.query_params.length > 0) {
                const params = new URLSearchParams();
                for (const p of step.data.query_params) {
                    if (p.key) {
                        params.append(p.key, await interpolateTemplate(p.value || '', ctx));
                    }
                }
                const separator = finalUrl.includes('?') ? '&' : '?';
                finalUrl += separator + params.toString();
            }

            // 4. Body — based on body_type config
            const fetchOpts: RequestInit = { method, headers };
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
                const bodyType = step.data.body_type || 'json';

                if (bodyType === 'json' && step.data.body_json) {
                    // Custom JSON body from UI
                    const interpolatedJson = await interpolateTemplate(step.data.body_json, ctx);
                    try {
                        // Validate JSON then stringify (allows re-formatting)
                        const parsed = JSON.parse(interpolatedJson);
                        fetchOpts.body = JSON.stringify(parsed);
                    } catch {
                        // If JSON parse fails, send as-is
                        fetchOpts.body = interpolatedJson;
                    }
                    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
                } else if (bodyType === 'form' && Array.isArray(step.data.body_form)) {
                    // Form data
                    const formParams = new URLSearchParams();
                    for (const f of step.data.body_form) {
                        if (f.key) {
                            formParams.append(f.key, await interpolateTemplate(f.value || '', ctx));
                        }
                    }
                    fetchOpts.body = formParams.toString();
                    if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
                } else if (bodyType === 'text' && step.data.body_text) {
                    fetchOpts.body = await interpolateTemplate(step.data.body_text, ctx);
                    if (!headers['Content-Type']) headers['Content-Type'] = 'text/plain';
                } else if (bodyType !== 'none') {
                    // Fallback: auto-body with context variables (legacy behavior)
                    fetchOpts.body = JSON.stringify({
                        ...ctx.variables,
                        contact: { name: ctx.contactName, phone: ctx.contactPhone, email: ctx.contactEmail },
                    });
                    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
                }
            }

            try {
                const response = await fetch(finalUrl, fetchOpts);
                let result: any;
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    result = await response.json();
                } else {
                    result = await response.text();
                }
                return {
                    newVars: { [responseVarName]: result, http_status: response.status },
                    message: `HTTP ${method} ${response.status}`,
                };
            } catch (e) {
                if (step.data.continue_on_error) {
                    return {
                        newVars: { [responseVarName]: null, http_status: 0, http_error: String(e) },
                        message: `HTTP error (continued): ${e}`,
                    };
                }
                return { newVars: { http_error: String(e) }, message: `HTTP error: ${e}` };
            }
        }

        // ---- Code Execution ----
        case 'code': {
            const code = step.data.code;
            if (!code) return { message: 'Code: empty' };

            try {
                const fn = new Function('vars', 'contact', `try { ${code} } catch (e) { return { error: e.message }; } `);
                const result = fn(ctx.variables, {
                    name: ctx.contactName,
                    phone: ctx.contactPhone,
                    email: ctx.contactEmail,
                    tags: ctx.contactTags,
                });
                if (result && typeof result === 'object') {
                    return { newVars: result, message: `Code: executed, ${Object.keys(result).length} vars` };
                }
                return { message: 'Code: executed (no output)' };
            } catch (e) {
                return { message: `Code error: ${e} ` };
            }
        }

        // ---- Edit Fields ----
        case 'edit_fields': {
            const fields = step.data.fields || [];
            const mode = step.data.mode || 'pairs';
            const newVars: Record<string, any> = {};

            if (mode === 'pairs') {
                for (const field of fields) {
                    newVars[field.name] = await interpolateTemplate(field.value || '', ctx);
                }
            } else if (mode === 'json') {
                try {
                    const parsed = JSON.parse(step.data.json_value || '{}');
                    Object.assign(newVars, parsed);
                } catch (e) {
                    console.error('[FLOW-ENGINE] Edit fields JSON parse error:', e);
                }
            }

            // --- SAVE TO CRM DB ---
            if (ctx.contactId && Object.keys(newVars).length > 0) {
                try {
                    let updateData: any = {};
                    let hasCustomUpdate = false;
                    
                    for (const [key, val] of Object.entries(newVars)) {
                        const lKey = key.toLowerCase();
                        if (lKey === 'name' || lKey === 'nome') { updateData.name = val; }
                        else if (lKey === 'email') { updateData.email = val; }
                        else if (lKey === 'phone' || lKey === 'telefone' || lKey === 'celular') { updateData.phone = String(val).replace(/\D/g, ''); }
                        else { hasCustomUpdate = true; }
                    }
                    
                    if (hasCustomUpdate) {
                        const [contactData] = await db.select({ customFields: contacts.customFields }).from(contacts).where(eq(contacts.id, ctx.contactId)).limit(1);
                        const existingCustom = contactData?.customFields || {};
                        
                        const newCustom: Record<string, any> = { ...existingCustom };
                        for (const [key, val] of Object.entries(newVars)) {
                            const lKey = key.toLowerCase();
                            if (lKey !== 'name' && lKey !== 'nome' && lKey !== 'email' && lKey !== 'phone' && lKey !== 'telefone' && lKey !== 'celular') {
                                newCustom[key] = val;
                            }
                        }
                        updateData.customFields = newCustom;
                    }
                    
                    if (Object.keys(updateData).length > 0) {
                        await db.update(contacts).set(updateData).where(eq(contacts.id, ctx.contactId));
                    }
                } catch (e) {
                    console.error('[FLOW-ENGINE] Edit fields CRM save error:', e);
                }
            }

            return { newVars, message: `Edit: ${Object.keys(newVars).length} fields` };
        }

        // ---- System (legacy) ----
        case 'system': {
            if (step.data.systemType === 'webhook') {
                const url = step.data.webhookUrl;
                if (url) {
                    try {
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...ctx.variables, executionId: ctx.executionId }),
                        });
                        const result = await response.json();
                        return { newVars: { webhook_result: result }, message: `Webhook: ${response.status} ` };
                    } catch (e) {
                        return { message: `Webhook error: ${e} ` };
                    }
                }
            } else if (step.data.systemType === 'code') {
                const code = step.data.code;
                if (code) {
                    try {
                        const fn = new Function('vars', 'contact', `try { ${code} } catch (e) { return { error: e.message }; } `);
                        const result = fn(ctx.variables, { name: ctx.contactName, phone: ctx.contactPhone });
                        if (result && typeof result === 'object') return { newVars: result };
                    } catch (e) {
                        return { message: `Code error: ${e} ` };
                    }
                }
            } else if (step.data.systemType === 'pause') {
                return { newVars: { bot_enabled: false }, message: 'Bot paused (human)' };
            } else if (step.data.systemType === 'stop') {
                return { action: 'stop' };
            }
            return {};
        }

        // ---- Action (legacy) ----
        case 'action': {
            const actionType = step.data.actionType || step.data.action_type || 'add_tag';
            const tag = step.data.tag_id || step.data.tag || step.data.description;
            
            if (tag && ctx.contactId) {
                if (actionType === 'remove_tag') {
                    try {
                        const tagRecord = await db.query.tags.findFirst({
                            where: and(eq(tags.companyId, ctx.companyId), or(eq(tags.id, tag), eq(tags.name, tag)))
                        });
                        
                        if (tagRecord) {
                            await db.delete(contactsToTags).where(
                                and(
                                    eq(contactsToTags.contactId, ctx.contactId),
                                    eq(contactsToTags.tagId, tagRecord.id)
                                )
                            );
                            const index = ctx.contactTags.indexOf(tagRecord.name);
                            if (index !== -1) ctx.contactTags.splice(index, 1);
                        }
                    } catch (e) {
                        console.error('[FLOW-ENGINE] Remove Tag action error:', e);
                    }
                } else {
                    // Default: add_tag
                    try {
                        let tagRecord = await db.query.tags.findFirst({
                            where: and(eq(tags.companyId, ctx.companyId), or(eq(tags.id, tag), eq(tags.name, tag)))
                        });
                        if (!tagRecord) {
                            const inserted = await db.insert(tags).values({
                                companyId: ctx.companyId,
                                name: tag,
                            }).returning();
                            tagRecord = inserted[0];
                        }
                        await db.insert(contactsToTags).values({
                            contactId: ctx.contactId,
                            tagId: tagRecord.id,
                            companyId: ctx.companyId
                        }).onConflictDoNothing();
                        
                        if (!ctx.contactTags.includes(tagRecord.name)) {
                            ctx.contactTags.push(tagRecord.name);
                        }
                    } catch (e) {
                        console.error('[FLOW-ENGINE] Tag assignment action error:', e);
                    }
                }
            }
            return { message: `Action: ${actionType} ` };
        }

        // ---- Marketing (V2: real actions) ----
        case 'marketing': {
            const marketingType = step.data.marketingType || 'campaign';

            switch (marketingType) {
                case 'template': {
                    // Redirect to send_template logic — send a WhatsApp template
                    const templateName = step.data.template_name;
                    if (templateName && ctx.contactPhone) {
                        try {
                            await sendWhatsappTemplateMessage({
                                connectionId: step.data.connection_id || ctx.connectionId,
                                to: ctx.contactPhone,
                                templateName,
                                languageCode: step.data.template_language || 'pt_BR',
                                components: [],
                            });
                            return { message: `Marketing: template "${templateName}" sent` };
                        } catch (e) {
                            return { message: `Marketing template error: ${e}` };
                        }
                    }
                    return { message: 'Marketing: no template configured' };
                }
                case 'direct': {
                    // Send a direct marketing message
                    const msg = await interpolateTemplate(step.data.message || step.data.content || '', ctx);
                    if (msg && ctx.contactPhone) {
                        await sendUnifiedMessage({
                            provider: ctx.provider as any,
                            connectionId: ctx.connectionId,
                            to: ctx.contactPhone || ctx.contactId,
                            message: msg,
                        });
                        return { message: `Marketing: direct message sent` };
                    }
                    return { message: 'Marketing: no message' };
                }
                case 'link': {
                    // Generate a tracked link with UTM params
                    const baseUrl = step.data.link_url || '';
                    if (baseUrl) {
                        const utmSource = step.data.utm_source || 'masterai';
                        const utmMedium = step.data.utm_medium || 'whatsapp';
                        const utmCampaign = step.data.utm_campaign || 'automation';
                        const trackedUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}`;
                        return { newVars: { marketing_link: trackedUrl }, message: `Marketing: link generated` };
                    }
                    return { message: 'Marketing: no link URL' };
                }
                case 'campaign':
                default: {
                    // Campaign — envia mensagem + mídia para o contato
                    const campaignMsg = await interpolateTemplate(step.data.message || '', ctx);
                    const campMediaUrl = step.data.media_url || '';

                    if ((campaignMsg || campMediaUrl) && ctx.contactPhone) {
                        await sendUnifiedMessage({
                            provider: ctx.provider as any,
                            connectionId: ctx.connectionId,
                            to: ctx.contactPhone || ctx.contactId,
                            message: campaignMsg,
                            ...(campMediaUrl ? { mediaUrl: campMediaUrl, mediaType: 'image' as const } : {}),
                        });
                    }

                    return {
                        message: `Marketing: campaign ${(step.data.campaign_name || step.data.campaign_id || marketingType).slice(0, 40)} sent`,
                        newVars: {
                            campaign_sent: true,
                            campaign_id: step.data.campaign_id || '',
                            campaign_name: step.data.campaign_name || '',
                            marketing_type: marketingType,
                        },
                    };
                }
            }
        }

        // ---- Utility (V2: data transformations) ----
        case 'utility': {
            const utilityType = step.data.utilityType || 'format';
            const inputVar = step.data.input_variable || 'last_response';
            const inputValue = String(ctx.variables[inputVar] || '');
            const outputVar = step.data.output_variable || 'utility_result';

            switch (utilityType) {
                case 'format': {
                    // Apply format mask (currency, CPF, phone)
                    const format = step.data.format || '';
                    let formatted = inputValue;

                    if (format.includes('R$') || format.includes('#')) {
                        // Currency formatting
                        const num = parseFloat(inputValue.replace(/[^0-9.-]/g, ''));
                        if (!isNaN(num)) {
                            formatted = num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        }
                    } else if (format === 'cpf') {
                        const digits = inputValue.replace(/\D/g, '').slice(0, 11);
                        if (digits.length === 11) {
                            formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
                        }
                    } else if (format === 'phone') {
                        const digits = inputValue.replace(/\D/g, '');
                        if (digits.length >= 10) {
                            formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                        }
                    }

                    return { newVars: { [outputVar]: formatted }, message: `Utility: formatted ${inputVar}` };
                }
                case 'extract': {
                    // Extract using regex pattern
                    const pattern = step.data.regex_pattern || '';
                    let extracted = '';
                    if (pattern) {
                        try {
                            const regex = new RegExp(pattern);
                            const match = inputValue.match(regex);
                            extracted = match ? (match[1] || match[0]) : '';
                        } catch (e) {
                            extracted = `regex error: ${e}`;
                        }
                    }
                    return { newVars: { [outputVar]: extracted }, message: `Utility: extracted from ${inputVar}` };
                }
                case 'math': {
                    // Safe math evaluation
                    const expression = await interpolateTemplate(step.data.expression || '', ctx);
                    let mathResult = 0;
                    try {
                        // Only allow numbers, operators, parentheses, and spaces
                        const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
                        if (sanitized) {
                            mathResult = new Function(`return (${sanitized})`)();
                        }
                    } catch (e) {
                        return { newVars: { [outputVar]: 0, math_error: String(e) }, message: `Utility: math error` };
                    }
                    return { newVars: { [outputVar]: mathResult }, message: `Utility: math = ${mathResult}` };
                }
                case 'transform': {
                    // String transformations
                    const transformOp = step.data.transform_operation || 'trim';
                    let result = inputValue;
                    switch (transformOp) {
                        case 'trim': result = inputValue.trim(); break;
                        case 'uppercase': result = inputValue.toUpperCase(); break;
                        case 'lowercase': result = inputValue.toLowerCase(); break;
                        case 'capitalize': result = inputValue.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '); break;
                        case 'replace': {
                            const find = step.data.find_text || '';
                            const replaceWith = step.data.replace_text || '';
                            result = inputValue.split(find).join(replaceWith);
                            break;
                        }
                        case 'split': {
                            const delimiter = step.data.delimiter || ',';
                            const parts = inputValue.split(delimiter);
                            return {
                                newVars: { [outputVar]: parts, [`${outputVar}_count`]: parts.length },
                                message: `Utility: split into ${parts.length} parts`,
                            };
                        }
                        case 'json_parse': {
                            try {
                                result = JSON.parse(inputValue);
                            } catch {
                                result = inputValue;
                            }
                            break;
                        }
                    }
                    return { newVars: { [outputVar]: result }, message: `Utility: ${transformOp} applied` };
                }
                default:
                    return { message: `Utility: unknown type ${utilityType}` };
            }
        }


        // ---- Add Note (CRM) ----
        case 'add_note': {
            const noteText = await interpolateTemplate(step.data.note_text || '', ctx);
            if (!noteText.trim()) {
                return { message: 'Nota vazia, ignorada' };
            }
            const mode = step.data.append_mode || 'prepend';

            // Buscar notas atuais do contato
            const [contactData] = await db.select({ notes: contacts.notes })
                .from(contacts)
                .where(and(eq(contacts.id, ctx.contactId), eq(contacts.companyId, ctx.companyId)))
                .limit(1);

            const currentNotes = contactData?.notes || '';
            const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const formattedNote = `[${timestamp}] ${noteText} `;

            let updatedNotes: string;
            if (mode === 'replace') {
                updatedNotes = formattedNote;
            } else if (mode === 'append') {
                updatedNotes = currentNotes ? `${currentNotes} \n\n${formattedNote} ` : formattedNote;
            } else {
                // prepend (default)
                updatedNotes = currentNotes ? `${formattedNote} \n\n${currentNotes} ` : formattedNote;
            }

            await db.update(contacts)
                .set({ notes: updatedNotes })
                .where(and(eq(contacts.id, ctx.contactId), eq(contacts.companyId, ctx.companyId)));

            // Sync context so downstream nodes (e.g. AI agent) see the updated notes
            ctx.contactNotes = updatedNotes;

            return { message: `Nota salva: ${noteText.slice(0, 50)} ` };
        }

        default:
            console.warn(`[FLOW - ENGINE] Unknown node type: ${step.type} `);
            return {};
    }
}

// ==============================
// Resume paused flow for contact
// ==============================

/**
 * Called when a lead sends a message.
 * Checks for any paused execution for this contact and resumes it.
 * This enables the AI dialogue mode to work — when the lead replies,
 * the paused execution resumes from the current step.
 */
export async function resumeFlowForContact(contactId: string, messageText: string, companyId: string): Promise<boolean> {
    try {
        // 1. Look up the contact's phone so we can find paused executions
        //    across duplicate contact records (same phone, different IDs)
        const contact = await db.query.contacts.findFirst({
            where: eq(contacts.id, contactId),
        });

        // Build list of all possible contactIds for this phone
        const contactIds: string[] = [contactId];
        if (contact?.phone) {
            // Strip leading + and country code variations to find all contacts with same phone
            const phoneDigits = contact.phone.replace(/\D/g, '');
            const allContacts = await db
                .select({ id: contacts.id })
                .from(contacts)
                .where(and(
                    eq(contacts.companyId, companyId),
                    sql`regexp_replace(${contacts.phone}, '\\D', '', 'g') LIKE '%' || ${phoneDigits.slice(-10)} || '%'`
                ));
            for (const c of allContacts) {
                if (!contactIds.includes(c.id)) contactIds.push(c.id);
            }
        }

        console.log(`[FLOW-ENGINE] 🔎 Searching paused executions for contactIds: [${contactIds.join(', ')}]`);

        // 2. Find the LATEST paused execution across all contact IDs
        const pausedExecution = await db.query.automationFlowExecutions.findFirst({
            where: and(
                inArray(automationFlowExecutions.contactId, contactIds),
                eq(automationFlowExecutions.companyId, companyId),
                eq(automationFlowExecutions.status, 'paused')
            ),
            orderBy: desc(automationFlowExecutions.startedAt),
        });

        if (!pausedExecution) {
            console.log(`[FLOW-ENGINE] No paused execution found for contact ${contactId} (phone: ${contact?.phone || 'unknown'})`);
            return false;
        }

        console.log(`[FLOW-ENGINE] 🔄 Resuming paused execution ${pausedExecution.id} (step: ${pausedExecution.currentStepId}) for contact ${pausedExecution.contactId}`);

        // 3. Cancel ALL other paused executions for these contacts (stale cleanup)
        await db.update(automationFlowExecutions)
            .set({ status: 'failed', error: 'Cancelled: superseded by newer execution', finishedAt: new Date() })
            .where(and(
                inArray(automationFlowExecutions.contactId, contactIds),
                eq(automationFlowExecutions.companyId, companyId),
                eq(automationFlowExecutions.status, 'paused'),
                sql`${automationFlowExecutions.id} != ${pausedExecution.id}`
            ));

        // 4. Load the flow
        const flow = await db.query.automationFlows.findFirst({
            where: eq(automationFlows.id, pausedExecution.flowId),
        });

        if (flow && !flow.isActive) {
            console.log(`[FLOW-ENGINE] 🛑 A Automação ${flow.id} foi DESATIVADA! Cancelando a execução pausada ${pausedExecution.id}.`);
            await db.update(automationFlowExecutions)
                .set({ status: 'failed', error: 'Automação desativada pelo usuário', finishedAt: new Date() })
                .where(eq(automationFlowExecutions.id, pausedExecution.id));
            return false;
        }

        if (!flow || !flow.executionLogic) {
            console.error(`[FLOW-ENGINE] ❌ Flow not found for paused execution: ${pausedExecution.flowId}`);
            await db.update(automationFlowExecutions)
                .set({ status: 'failed', error: 'Flow not found', finishedAt: new Date() })
                .where(eq(automationFlowExecutions.id, pausedExecution.id));
            return false;
        }

        // 5. Update variables with the lead's response
        const currentVars = (pausedExecution.variables as any)?.vars || {};
        currentVars.last_response = messageText;
        currentVars.message_text = messageText;

        console.log(`[FLOW-ENGINE] 📝 Updating vars: last_response="${messageText.slice(0, 50)}"`);

        // 6. Set status back to running
        await db.update(automationFlowExecutions)
            .set({
                status: 'running',
                variables: { vars: currentVars },
            })
            .where(eq(automationFlowExecutions.id, pausedExecution.id));

        // 7. Resume processing the current step
        const resumeStepId = pausedExecution.currentStepId;
        if (resumeStepId) {
            console.log(`[FLOW-ENGINE] ▶️ Resuming from step: ${resumeStepId}`);
            await processFlowExecution(pausedExecution.id, flow.executionLogic as any, resumeStepId);
        } else {
            console.warn(`[FLOW-ENGINE] ⚠️ No currentStepId on paused execution, completing.`);
            await db.update(automationFlowExecutions)
                .set({ status: 'completed', finishedAt: new Date() })
                .where(eq(automationFlowExecutions.id, pausedExecution.id));
        }

        return true;
    } catch (error) {
        console.error(`[FLOW-ENGINE] ❌ resumeFlowForContact error:`, error);
        return false;
    }
}
