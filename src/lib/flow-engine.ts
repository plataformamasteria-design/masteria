// src/lib/flow-engine.ts
'use server';

import { db } from './db';
import { automationFlows, automationFlowExecutions, automationExecutionLogs, contacts, connections, messages, conversations, messageTemplates, mediaAssets, kanbanBoards, kanbanLeads, contactsToTags, tags, agentMediaLibrary, tasks } from './db/schema';
import { eq, and, or, desc, sql, isNull, inArray } from 'drizzle-orm';
import { sendUnifiedMessage } from '@/services/unified-message-sender.service';
import { sendWhatsappTemplateMessage, sendWhatsappTextMessage } from '@/lib/facebookApiService';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { createSystemMessage } from '@/services/system-message.service';
import { resolveAIKeys } from './ai-keys-resolver';
import { logContactEvent } from './contact-events';
import { logger } from '@/lib/logger';
import { emitToCompany } from '@/lib/socket';
import { executeCopilotCommand } from './copilot-engine';

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
    flowId: string;
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
    conversationId?: string;
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
export async function interpolateTemplate(content: string, ctx: ExecutionContext): Promise<string> {
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
            // New robust full path resolution first
            const fullPathVal = path.split('.').reduce((obj: any, k: string) => obj?.[k], ctx.variables);
            if (fullPathVal !== undefined) return String(fullPathVal);

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
        logger.error('[FLOW-ENGINE] Log insert failed:', e);
    }
}

// Analytics Helpers
export async function incrementNodeReached(automationId: string, companyId: string, nodeId: string) {
    try {
        await db.execute(sql`
            INSERT INTO automation_node_stats (id, node_id, automation_id, company_id, total_reached, updated_at)
            VALUES (gen_random_uuid(), ${nodeId}, ${automationId}, ${companyId}, 1, now())
            ON CONFLICT (node_id)
            DO UPDATE SET total_reached = automation_node_stats.total_reached + 1, updated_at = now()
        `);
    } catch (e) {
        logger.error('[FLOW-ENGINE] incrementNodeReached failed:', e);
    }
}

export async function incrementNodeResponded(automationId: string, companyId: string, nodeId: string, routeId?: string) {
    try {
        if (!routeId) {
            await db.execute(sql`
                INSERT INTO automation_node_stats (id, node_id, automation_id, company_id, total_responded, updated_at)
                VALUES (gen_random_uuid(), ${nodeId}, ${automationId}, ${companyId}, 1, now())
                ON CONFLICT (node_id)
                DO UPDATE SET total_responded = automation_node_stats.total_responded + 1, updated_at = now()
            `);
        } else {
            await db.execute(sql`
                INSERT INTO automation_node_stats (id, node_id, automation_id, company_id, total_responded, responses, updated_at)
                VALUES (gen_random_uuid(), ${nodeId}, ${automationId}, ${companyId}, 1, jsonb_build_object(${routeId}::text, 1::int), now())
                ON CONFLICT (node_id)
                DO UPDATE SET 
                    total_responded = automation_node_stats.total_responded + 1,
                    responses = jsonb_set(
                        COALESCE(automation_node_stats.responses, '{}'::jsonb),
                        string_to_array(${routeId}, ','),
                        (COALESCE((automation_node_stats.responses->>${routeId})::int, 0) + 1)::text::jsonb
                    ),
                    updated_at = now()
            `);
        }
    } catch (e) {
        logger.error('[FLOW-ENGINE] incrementNodeResponded failed:', e);
    }
}

// Resolve todos os próximos nós baseados no handle de saída
function resolveNextNodes(step: FlowStep, sourceHandleId?: string): string[] {
    if (sourceHandleId) {
        const normalizedHandleIds = [sourceHandleId];
        // Handle UI vs Engine discrepancies for router node
        if (sourceHandleId === 'fallback') normalizedHandleIds.push('default');
        else if (sourceHandleId === 'default') normalizedHandleIds.push('fallback');
        else if (sourceHandleId.startsWith('route-')) normalizedHandleIds.push(sourceHandleId.replace('-', '_'));
        else if (sourceHandleId.startsWith('route_')) normalizedHandleIds.push(sourceHandleId.replace('_', '-'));
        
        // Handle UI vs Engine discrepancies for filter node
        if (sourceHandleId === 'block') normalizedHandleIds.push('fail');
        else if (sourceHandleId === 'fail') normalizedHandleIds.push('block');

        const conns = step.connections?.filter(c => normalizedHandleIds.includes(c.sourceHandle as string));
        if (conns && conns.length > 0) return conns.map(c => c.target);
        return [];
    }
    
    if (step.connections && step.connections.length > 0) {
        return step.connections.map(c => c.target);
    }
    
    if (step.nextSteps && step.nextSteps.length > 0) {
        return step.nextSteps;
    }
    
    return [];
}

function resolveMultipleHandles(step: FlowStep, handleIds: string[]): string[] {
    const targets: string[] = [];
    for (const sourceHandleId of handleIds) {
        const normalizedHandleIds = [sourceHandleId];
        if (sourceHandleId === 'fallback') normalizedHandleIds.push('default');
        else if (sourceHandleId === 'default') normalizedHandleIds.push('fallback');
        else if (sourceHandleId.startsWith('route-')) normalizedHandleIds.push(sourceHandleId.replace('-', '_'));
        else if (sourceHandleId.startsWith('route_')) normalizedHandleIds.push(sourceHandleId.replace('_', '-'));
        
        // Handle UI vs Engine discrepancies for filter node
        if (sourceHandleId === 'block') normalizedHandleIds.push('fail');
        else if (sourceHandleId === 'fail') normalizedHandleIds.push('block');

        const conn = step.connections?.find(c => normalizedHandleIds.includes(c.sourceHandle as string));
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
            eq(automationFlows.companyId, companyId)
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
    const contactTagsQuery = await db.select({ tagName: tags.name, tagId: tags.id })
        .from(contactsToTags)
        .innerJoin(tags, eq(contactsToTags.tagId, tags.id))
        .where(eq(contactsToTags.contactId, contactId));
    const contactTagNames = contactTagsQuery.map(t => (t.tagName || '').toLowerCase()); const contactTagIds = contactTagsQuery.map(t => t.tagId);

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

        // Strip invisible unicode characters (e.g. U+2060 WORD JOINER) that may appear in copy-pasted text
        const keyword = (trigger.data?.keyword || '').replace(/[\u2060\u200B\u200C\u200D\uFEFF\u00A0]/g, '').trim();
        const matchMode = trigger.data?.match_mode || 'contains';
        // ✅ Extrair texto do BD (message.content) que contém a transcrição de áudios ou texto puro
        const messageText = (message?.content || message?.body || message?.text || '').replace(/[\u2060\u200B\u200C\u200D\uFEFF]/g, '').trim();
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
                logger.debug(`[FLOW-ENGINE] Evaluating advanced filters for trigger category: ${category}`);
                logger.debug(`[FLOW-ENGINE] Data state -> ConversationConnectionId: ${conversationData?.connectionId}, FilterConnection: ${trigger.data.filter_connection}`);
                logger.debug(`[FLOW-ENGINE] Data state -> ContactTags: ${JSON.stringify(contactTags)}, FilterTag: ${trigger.data.filter_tag}`);
                logger.debug(`[FLOW-ENGINE] Data state -> LeadBoardId: ${leadData?.boardId}, FilterFunnel: ${trigger.data.filter_funnel}, LeadStageId: ${leadData?.stageId}, FilterStage: ${trigger.data.filter_stage}`);
                
                if (category === 'connection' && trigger.data.filter_connection) {
                    if (String(conversationData?.connectionId) !== String(trigger.data.filter_connection)) {
                        shouldTrigger = false;
                    }
                }
                else if (category === 'tag' && trigger.data.filter_tag) {
                    if (!contactTagNames.includes(String(trigger.data.filter_tag).toLowerCase()) && !contactTagIds.includes(String(trigger.data.filter_tag))) {
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
                // BUG FIX: Se a execução está parada há mais de 5 minutos, ela está travada.
                // Marcar como completed e permitir que um novo disparo ocorra.
                const execAge = Date.now() - new Date(existingExec.finishedAt || existingExec.startedAt).getTime();
                const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos
                if (execAge > STALE_THRESHOLD_MS) {
                    logger.debug(`[FLOW-ENGINE] 🔓 Execução ${existingExec.id} travada há ${Math.floor(execAge/1000)}s — limpando e re-disparando fluxo ${flow.id}`);
                    await db.update(automationFlowExecutions)
                        .set({ status: 'completed', finishedAt: new Date() })
                        .where(eq(automationFlowExecutions.id, existingExec.id));
                    // Prossegue para triggerFlow abaixo
                } else {
                    logger.debug(`[FLOW - ENGINE] ⏩ Skipping trigger for flow ${flow.id} — existing ${existingExec.status} execution ${existingExec.id} for contact ${contactId} (age: ${Math.floor(execAge/1000)}s)`);
                    continue;
                }
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
            eq(automationFlows.companyId, companyId)
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
            eq(automationFlows.companyId, companyId)
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

        logger.debug(`[FLOW-ENGINE] 👤 Contact created trigger: flow ${flow.id} for contact ${contactId}`);
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
            eq(automationFlows.companyId, companyId)
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

        logger.debug(`[FLOW-ENGINE] 🏷️ Tag added trigger: flow ${flow.id}, tag="${addedTag}", contact ${contactId}`);
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
    // Use local timezone to match user's expected schedule
    const nowHour = String(now.getHours()).padStart(2, '0');
    const nowMinute = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${nowHour}:${nowMinute}`;
    const dayOfWeek = now.getDay(); // 0=Sunday
    const dayOfMonth = now.getDate();
    
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    const todayDateString = `${localYear}-${localMonth}-${localDay}`;

    for (const flow of flows) {
        const logic = flow.executionLogic as any;
        const steps = Array.isArray(logic) ? logic : logic?.steps;
        if (!steps?.length) continue;

        const trigger = steps.find((s: FlowStep) => s.type === 'trigger');
        if (!trigger) continue;
        if (trigger.data?.triggerType !== 'schedule') continue;

        const freq = trigger.data?.schedule_freq || 'daily';
        const scheduleTime = trigger.data?.schedule_time || '09:00';
        let shouldRun = false;

        switch (freq) {
            case 'daily':
                shouldRun = currentTime === scheduleTime;
                break;
            case 'weekly':
                const targetDayOfWeek = parseInt(trigger.data?.schedule_day_of_week || '1');
                shouldRun = dayOfWeek === targetDayOfWeek && currentTime === scheduleTime;
                break;
            case 'monthly':
                const targetDayOfMonth = parseInt(trigger.data?.schedule_day_of_month || '1');
                shouldRun = dayOfMonth === targetDayOfMonth && currentTime === scheduleTime;
                break;
            case 'specific_date':
                const targetDate = trigger.data?.schedule_date;
                if (targetDate) {
                    shouldRun = targetDate === todayDateString && currentTime === scheduleTime;
                }
                break;
        }

        if (!shouldRun) continue;

        logger.debug(`[FLOW-ENGINE] ⏰ Schedule trigger: flow ${flow.id} (freq=${freq}, time=${scheduleTime})`);

        // Trigger without a specific contact — flow should use lookup_lead or run company-wide
        await triggerFlow(flow.id, flow.companyId, null, {
            trigger_type: 'schedule',
            schedule_freq: freq,
            schedule_time: scheduleTime,
        });
    }
}

/**
 * Evaluates triggers when a lead is moved to a specific Kanban stage.
 * Called from kanban/move-lead-to-stage.
 */
export async function evaluateStageChangedTriggers(companyId: string, contactId: string, boardId: string, stageId: string) {
    const flows = await db.query.automationFlows.findMany({
        where: and(
            eq(automationFlows.isActive, true),
            eq(automationFlows.companyId, companyId)
        )
    });

    for (const flow of flows) {
        const logic = flow.executionLogic as any;
        const steps = Array.isArray(logic) ? logic : logic?.steps;
        if (!steps?.length) continue;

        const trigger = steps.find((s: FlowStep) => s.type === 'trigger');
        if (!trigger) continue;

        const triggerType = trigger.data?.triggerType;
        if (triggerType !== 'stage_changed') continue;

        const filterFunnel = trigger.data?.filter_funnel;
        const filterStage = trigger.data?.filter_stage;

        if (filterFunnel && filterFunnel !== boardId) continue;
        if (filterStage && filterStage !== stageId) continue;

        // Skip duplicate executions
        const existingExec = await db.query.automationFlowExecutions.findFirst({
            where: and(
                eq(automationFlowExecutions.contactId, contactId),
                eq(automationFlowExecutions.flowId, flow.id),
                inArray(automationFlowExecutions.status, ['paused', 'running'])
            ),
        });
        if (existingExec) continue;

        logger.debug(`[FLOW-ENGINE] 🔄 Stage changed trigger: flow ${flow.id}, board=${boardId}, stage=${stageId}, contact ${contactId}`);
        await triggerFlow(flow.id, companyId, contactId, {
            trigger_type: 'stage_changed',
            board_id: boardId,
            stage_id: stageId,
        });
    }
}

/**
 * Evaluates triggers when a lead is assigned to a user or team.
 * Called from chat-assignment actions.
 */
export async function evaluateLeadAssignedTriggers(companyId: string, contactId: string, assigneeType: 'user' | 'team', assigneeId: string) {
    const flows = await db.query.automationFlows.findMany({
        where: and(
            eq(automationFlows.isActive, true),
            eq(automationFlows.companyId, companyId)
        )
    });

    for (const flow of flows) {
        const logic = flow.executionLogic as any;
        const steps = Array.isArray(logic) ? logic : logic?.steps;
        if (!steps?.length) continue;

        const trigger = steps.find((s: FlowStep) => s.type === 'trigger');
        if (!trigger) continue;

        const triggerType = trigger.data?.triggerType;
        if (triggerType !== 'lead_assigned') continue;

        const filterAssigneeType = trigger.data?.assignee_type;
        const filterAssigneeId = trigger.data?.assignee_id;

        if (filterAssigneeType && filterAssigneeType !== assigneeType) continue;
        if (filterAssigneeId && filterAssigneeId !== assigneeId) continue;

        // Skip duplicate executions
        const existingExec = await db.query.automationFlowExecutions.findFirst({
            where: and(
                eq(automationFlowExecutions.contactId, contactId),
                eq(automationFlowExecutions.flowId, flow.id),
                inArray(automationFlowExecutions.status, ['paused', 'running'])
            ),
        });
        if (existingExec) continue;

        logger.debug(`[FLOW-ENGINE] 👤 Lead assigned trigger: flow ${flow.id}, assigneeType=${assigneeType}, assigneeId=${assigneeId}, contact ${contactId}`);
        await triggerFlow(flow.id, companyId, contactId, {
            trigger_type: 'lead_assigned',
            assignee_type: assigneeType,
            assignee_id: assigneeId,
        });
    }
}

// ==============================
// Flow trigger (creates execution)
// ==============================

export async function triggerFlow(flowId: string, companyId: string, contactId: string | null, initialVars: any = {}): Promise<string | null> {
    logger.debug(`[FLOW - ENGINE] 🔥 Triggering flow: ${flowId} for contact: ${contactId} `);

    const flow = await db.query.automationFlows.findFirst({
        where: and(
            eq(automationFlows.id, flowId),
            eq(automationFlows.companyId, companyId)
        )
    });

    if (!flow) {
        logger.error(`[FLOW - ENGINE] ❌ Flow not found: ${flowId} (companyId: ${companyId})`);
        return null;
    }

    if (!flow.isActive) {
        logger.warn(`[FLOW - ENGINE] ⚠️ Flow is inactive: ${flowId} `);
        // Para test-real, permitir execução mesmo inativo
    }

    const [execution] = await db.insert(automationFlowExecutions).values({
        flowId,
        companyId,
        contactId,
        status: 'running',
        variables: { vars: initialVars },
    }).returning();

    logger.debug(`[FLOW - ENGINE] 📝 Execution created: ${execution.id} `);

    if (contactId) {
        try {
            await logContactEvent(companyId, contactId, 'AUTOMATION', `Automação Iniciada: ${flow.name}`, { flowId });
        } catch (e) {
            logger.warn('[logContactEvent] Falha ao logar automação', e);
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
        logger.error(`[FLOW - ENGINE] ❌ processFlowExecution error: `, err);
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
    let activeConv: Awaited<ReturnType<typeof db.query.conversations.findFirst>> | undefined = undefined;
    
    // ✅ FIX: Prioritize explicitly bound connectionId from execution variables (e.g., from Campaign Dispatch)
    const boundConnectionId = (execution.variables as any)?.connectionId;
    if (boundConnectionId) {
        connection = await db.query.connections.findFirst({
            where: eq(connections.id, boundConnectionId)
        }) ?? undefined;
        logger.debug(`[FLOW-ENGINE] 🔗 Resolved connection from bound execution variables: ${boundConnectionId} (type: ${connection?.connectionType})`);
    }

    if (!connection && execution.contactId) {
        activeConv = await db.query.conversations.findFirst({
            where: and(
                eq(conversations.contactId, execution.contactId),
                eq(conversations.companyId, execution.companyId),
            ),
            orderBy: desc(conversations.lastMessageAt),
        }) ?? undefined;
        if (activeConv?.connectionId) {
            connection = await db.query.connections.findFirst({
                where: eq(connections.id, activeConv.connectionId)
            }) ?? undefined;
            logger.debug(`[FLOW-ENGINE] 🔗 Resolved connection from conversation: ${activeConv.connectionId} (type: ${connection?.connectionType})`);
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
        logger.debug(`[FLOW-ENGINE] 🔗 Fallback connection: ${connection?.id} (type: ${connection?.connectionType})`);
    }

    // Build execution context
    // Derive provider from connectionType (no 'provider' column exists)
    let derivedProvider = 'evolution';
    if (connection?.connectionType === 'meta_api' || connection?.connectionType === 'apicloud') {
        derivedProvider = 'apicloud';
    } else if (['baileys', 'evolution'].includes(connection?.connectionType || '')) {
        derivedProvider = 'evolution';
    }

    let realContactTags: string[] = [];
    if (execution.contactId) {
        const contactTagsQuery = await db.select({ tagName: tags.name, tagId: tags.id })
            .from(contactsToTags)
            .innerJoin(tags, eq(contactsToTags.tagId, tags.id))
            .where(eq(contactsToTags.contactId, execution.contactId));
        realContactTags = contactTagsQuery.map(t => t.tagName);
    }

    // Pre-load dynamic context variables
    const vars = (execution.variables as any)?.vars || {};
    
    if (activeConv) {
        vars['conversation.ai_active'] = activeConv.aiActive === false ? 'false' : 'true';
    }

    if (execution.contactId) {
        try {
            const kanbanLead = await db.query.kanbanLeads.findFirst({
                where: eq(kanbanLeads.contactId, execution.contactId)
            });
            if (kanbanLead) {
                const board = await db.query.kanbanBoards.findFirst({ where: eq(kanbanBoards.id, kanbanLead.boardId) });
                vars['contact.kanban_board'] = board?.name || kanbanLead.boardId;
                if (board) {
                    const stages = (board.stages || []) as any[];
                    const stage = stages.find(s => s.id === kanbanLead.stageId);
                    vars['contact.kanban_stage'] = stage?.title || stage?.name || kanbanLead.stageId;
                }
            }
        } catch(e) {
            logger.error('[FLOW-ENGINE] Error fetching kanban context', e);
        }
    }

    const ctx: ExecutionContext = {
        executionId,
        flowId: execution.flowId,
        companyId: execution.companyId,
        contactId: execution.contactId || '',
        contactPhone: contact?.phone || '',
        contactName: contact?.name || 'Cliente',
        contactEmail: contact?.email || '',
        contactTags: realContactTags,
        contactNotes: (contact as any)?.notes || '',
        variables: vars,
        connectionId: connection?.id || 'default',
        provider: derivedProvider,
        conversationId: activeConv?.id,
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
            logger.debug(`[FLOW - ENGINE] 🚀 Executing: ${step.type} (${step.id})`);

            // --- TIMEOUT BYPASS ---
            if (ctx.variables._timeout_triggered_for_step === step.id) {
                logger.debug(`[FLOW - ENGINE] ⏱️ Timeout forced bypass for step ${step.id}`);
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
                const timeoutConn = step.connections?.find(c => c.sourceHandle === 'timeout' || c.sourceHandle === 'not_responded' || c.sourceHandle === 'no_response');
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
                logger.debug(`[FLOW - ENGINE] ⏸️ Paused at ${step.id} `);
                return;
            }

            if (result.action === 'delay') {
                const delayMs = result.delayMs || 60000;
                const nextNodes = resolveNextNodes(step);
                
                await db.update(automationFlowExecutions)
                    .set({
                        status: 'delayed',
                        currentStepId: nextNodes[0] || step.id,
                        variables: { vars: ctx.variables, _resumeAt: Date.now() + delayMs }
                    })
                    .where(eq(automationFlowExecutions.id, executionId));
                logger.debug(`[FLOW - ENGINE] ⏳ Delayed ${delayMs}ms at ${step.id} `);
                setTimeout(() => {
                    processFlowExecution(executionId, logic, nextNodes[0]);
                }, delayMs);
                return;
            }

            if (result.action === 'stop') {
                await db.update(automationFlowExecutions)
                    .set({ status: 'completed', finishedAt: new Date() })
                    .where(eq(automationFlowExecutions.id, executionId));
                logger.debug(`[FLOW - ENGINE] 🛑 Stopped at ${step.id} `);
                return;
            }

            // Enqueue next nodes
            if (result.nextNodeIds && result.nextNodeIds.length > 0) {
                // Multi-branch: enqueue all targets
                for (const nid of result.nextNodeIds) {
                    if (!visited.has(nid)) queue.push(nid);
                }
            } else {
                // Single/Multiple next
                const nextNodes = resolveNextNodes(step, result.sourceHandle);
                for (const next of nextNodes) {
                    if (!visited.has(next)) queue.push(next);
                }
            }

        } catch (error) {
            const elapsed = Date.now() - (Date.now()); // fallback
            logger.error(`[FLOW - ENGINE] ❌ Failed at ${step.type} (${step.id}): `, error);
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
    logger.debug(`[FLOW - ENGINE] ✅ Execution ${executionId} completed(${nodeCount} nodes).`);

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
    logger.debug(`[FLOW-ENGINE] ⚙️ Executing node ${step.type} (${step.id})`);

    // --- Sprint 1: Fatiamento Arquitetural (Node Registry) ---
    const { NodeRegistry } = await import('@/services/flow-nodes/registry');
    const handler = NodeRegistry.getHandler(step.type);
    if (handler) {
        return await handler.execute(step, ctx as any, allSteps);
    }
    // ---------------------------------------------------------

    
    // 🔥 Gravar estatística de visualização (Reached)
    await incrementNodeReached(ctx.flowId, ctx.companyId, step.id);
    
    switch (step.type) {
        // ---- System ----
        // ---- System ----
        case 'trigger': {
            if (step.data?.triggerType === 'campaign_dispatched') {
                if (ctx.variables.last_response && ctx.variables._ask_step_id === step.id) {
                    const answer = ctx.variables.last_response;
                    delete ctx.variables._ask_step_id;
                    return {
                        action: 'continue',
                        sourceHandle: 'respondeu',
                        message: `Respondeu: ${answer}`
                    };
                }

                const questionVars: Record<string, any> = {
                    _ask_step_id: step.id,
                };
                
                let timeoutMinutes = parseInt(step.data?.timeout_minutes);
                if (isNaN(timeoutMinutes)) {
                    timeoutMinutes = 60; // legacy default
                }
                
                if (timeoutMinutes > 0) {
                    questionVars._wait_timeout_at = Date.now() + (timeoutMinutes * 60 * 1000);
                }
                questionVars._wait_step_id = step.id;

                return { action: 'pause', newVars: questionVars, message: 'Paused waiting for reply to campaign' };
            }
            return { message: 'Trigger activated' };
        }

        // ---- Interactive Message (Buttons) ----
        case 'interactive_message': {
            if (ctx.variables.last_response && ctx.variables._wait_step_id === step.id) {
                const answer = String(ctx.variables.last_response).trim();
                delete ctx.variables._wait_step_id;
                delete ctx.variables._wait_timeout_at;
                
                let buttons = [];
                if (step.data.buttons && Array.isArray(step.data.buttons)) {
                    buttons = step.data.buttons.map((b: any, i: number) => ({
                        id: typeof b === 'string' ? `btn_${i}` : (b.id || `btn_${i}`),
                        title: typeof b === 'string' ? b : (b.text || b.label || `Opção ${i+1}`)
                    }));
                }

                let sourceHandle = 'other_response';
                for (const btn of buttons) {
                    if (btn.title.toLowerCase().trim() === answer.toLowerCase() ||
                        btn.id.toLowerCase() === answer.toLowerCase()) {
                        sourceHandle = btn.id;
                        break;
                    }
                }

                await incrementNodeResponded(ctx.flowId, ctx.companyId, step.id, sourceHandle);

                return {
                    action: 'continue',
                    sourceHandle,
                    message: `User clicked/replied: ${answer}`
                };
            }

            const text = await interpolateTemplate(step.data.message || step.data.content || step.data.text || '', ctx);
            const overrideConnectionId = step.data.connection_id || ctx.connectionId;
            
            let buttons;
            if (step.data.buttons && Array.isArray(step.data.buttons)) {
                buttons = step.data.buttons.map((b: any, i: number) => ({
                    id: typeof b === 'string' ? `btn_${i}` : (b.id || `btn_${i}`),
                    title: typeof b === 'string' ? b : (b.text || b.label || `Opção ${i+1}`),
                    type: typeof b === 'object' && b.type ? b.type : 'reply',
                    url: typeof b === 'object' && b.url ? b.url : undefined
                }));
            }

            const sendResult = await sendUnifiedMessage({
                provider: ctx.provider as any,
                connectionId: overrideConnectionId,
                to: ctx.contactPhone || ctx.contactId,
                message: text,
                buttons
            });

            if (!sendResult.success) {
                return {
                    action: 'continue',
                    sourceHandle: 'error',
                    message: `Falha ao enviar mensagem: ${sendResult.error}`
                };
            }
            
            if (ctx.contactId) {
                try {
                    const { eq, and, desc } = await import('drizzle-orm');
                    let activeConv = await db.query.conversations.findFirst({
                        where: and(eq(conversations.contactId, ctx.contactId), eq(conversations.companyId, ctx.companyId)),
                        orderBy: desc(conversations.lastMessageAt)
                    });
                    
                    if (!activeConv && overrideConnectionId) {
                        const [newConv] = await db.insert(conversations).values({
                            companyId: ctx.companyId,
                            contactId: ctx.contactId,
                            connectionId: overrideConnectionId,
                            status: 'IN_PROGRESS',
                        }).returning();
                        activeConv = newConv;
                    }
                    
                    if (activeConv) {
                        const [savedMessage] = await db.insert(messages).values({
                            companyId: ctx.companyId,
                            conversationId: activeConv.id,
                            connectionId: overrideConnectionId || activeConv.connectionId,
                            senderType: 'AI',
                            senderId: 'automation_node',
                            content: text,
                            contentType: 'TEXT',
                            providerMessageId: sendResult.messageId || `auto-${Date.now()}`,
                            status: sendResult.success ? 'SENT' : 'FAILED',
                        }).returning();

                        if (savedMessage) {
                            emitToCompany(ctx.companyId, 'chat:new-message', {
                                conversationId: activeConv.id,
                                messageId: savedMessage.id,
                                connectionId: overrideConnectionId || activeConv.connectionId,
                                contactPhone: ctx.contactPhone || '',
                                contactName: ctx.contactName || '',
                                content: savedMessage.content,
                                contentType: savedMessage.contentType,
                                mediaUrl: savedMessage.mediaUrl,
                                isFromMe: true,
                                senderType: 'AGENT',
                                timestamp: new Date().toISOString(),
                            });
                            emitToCompany(ctx.companyId, 'inbox:update', { timestamp: Date.now() });
                        }
                    }
                } catch (saveErr: any) {
                    logger.error('[FLOW-ENGINE] Failed to save interactive_message:', saveErr.message);
                }
                
                try {
                    await logContactEvent(ctx.companyId, ctx.contactId, 'AUTOMATION', `Mensagem interativa enviada via automação:\n"${text}"`);
                } catch (e) {}
            }

            const timeoutAmount = parseInt(step.data.timeout_amount || '60');
            const timeoutUnit = step.data.timeout_unit || 'minutes';
            const multipliers: Record<string, number> = {
                seconds: 1000,
                minutes: 60 * 1000,
                hours: 60 * 60 * 1000,
                days: 24 * 60 * 60 * 1000,
            };
            const timeoutMs = timeoutAmount * (multipliers[timeoutUnit] || 60000);

            return {
                action: 'pause',
                newVars: {
                    _wait_step_id: step.id,
                    _wait_timeout_at: Date.now() + timeoutMs,
                },
                message: `Sent interactive message: ${text.slice(0, 50)}. Paused for reply.`
            };
        }

        // ---- Messages ----
        case 'send_message':
        case 'message': {
            const text = await interpolateTemplate(step.data.message || step.data.content || step.data.text || '', ctx);
            const overrideConnectionId = step.data.connection_id || ctx.connectionId;
            
            // Extrai botões para mensagem interativa
            let buttons;
            if (step.type === 'interactive_message' && step.data.buttons && Array.isArray(step.data.buttons)) {
                buttons = step.data.buttons.map((b: any, i: number) => ({
                    id: typeof b === 'string' ? `btn_${i}` : (b.id || `btn_${i}`),
                    title: typeof b === 'string' ? b : (b.text || b.label || `Opção ${i+1}`),
                    type: typeof b === 'object' && b.type ? b.type : 'reply',
                    url: typeof b === 'object' && b.url ? b.url : undefined
                }));
            }

            const sendResult = await sendUnifiedMessage({
                provider: ctx.provider as any,
                connectionId: overrideConnectionId,
                to: ctx.contactPhone || ctx.contactId,
                message: text,
                buttons
            });

            if (!sendResult.success) {
                throw new Error(sendResult.error || 'Falha ao enviar mensagem');
            }
            
            if (ctx.contactId) {
                try {
                    const { eq, and, desc } = await import('drizzle-orm');
                    let activeConv = await db.query.conversations.findFirst({
                        where: and(eq(conversations.contactId, ctx.contactId), eq(conversations.companyId, ctx.companyId)),
                        orderBy: desc(conversations.lastMessageAt)
                    });
                    
                    if (!activeConv && overrideConnectionId) {
                        const [newConv] = await db.insert(conversations).values({
                            companyId: ctx.companyId,
                            contactId: ctx.contactId,
                            connectionId: overrideConnectionId,
                            status: 'IN_PROGRESS',
                        }).returning();
                        activeConv = newConv;
                    }
                    
                    if (activeConv) {
                        const [savedMessage] = await db.insert(messages).values({
                            companyId: ctx.companyId,
                            conversationId: activeConv.id,
                            connectionId: overrideConnectionId || activeConv.connectionId,
                            senderType: 'AI',
                            senderId: 'automation_node',
                            content: text,
                            contentType: 'TEXT',
                            providerMessageId: sendResult.messageId || `auto-${Date.now()}`,
                            status: sendResult.success ? 'SENT' : 'FAILED',
                        }).returning();

                        if (savedMessage) {
                            emitToCompany(ctx.companyId, 'chat:new-message', {
                                conversationId: activeConv.id,
                                messageId: savedMessage.id,
                                connectionId: overrideConnectionId || activeConv.connectionId,
                                contactPhone: ctx.contactPhone || '',
                                contactName: ctx.contactName || '',
                                content: savedMessage.content,
                                contentType: savedMessage.contentType,
                                mediaUrl: savedMessage.mediaUrl,
                                isFromMe: true,
                                senderType: 'AGENT',
                                timestamp: new Date().toISOString(),
                            });
                            emitToCompany(ctx.companyId, 'inbox:update', { timestamp: Date.now() });
                        }
                    }
                } catch (saveErr: any) {
                    logger.error('[FLOW-ENGINE] Failed to save send_message message:', saveErr.message);
                }
                
                try {
                    await logContactEvent(ctx.companyId, ctx.contactId, 'AUTOMATION', `Mensagem enviada via automação:\n"${text}"`);
                } catch (e) {}
            }
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
            const overrideConnectionId = step.data.connection_id || ctx.connectionId;
            const sendResult = await sendUnifiedMessage({
                provider: ctx.provider as any,
                connectionId: overrideConnectionId,
                to: ctx.contactPhone || ctx.contactId,
                message: caption,
                mediaUrl: step.data.file_url || step.data.url,
                mediaType,
            });

            if (!sendResult.success) {
                throw new Error(sendResult.error || `Falha ao enviar mídia (${mediaType})`);
            }

            if (ctx.contactId) {
                try {
                    const { eq, and, desc } = await import('drizzle-orm');
                    let activeConv = await db.query.conversations.findFirst({
                        where: and(eq(conversations.contactId, ctx.contactId), eq(conversations.companyId, ctx.companyId)),
                        orderBy: desc(conversations.lastMessageAt)
                    });
                    
                    if (!activeConv && overrideConnectionId) {
                        const [newConv] = await db.insert(conversations).values({
                            companyId: ctx.companyId,
                            contactId: ctx.contactId,
                            connectionId: overrideConnectionId,
                            status: 'IN_PROGRESS',
                        }).returning();
                        activeConv = newConv;
                    }
                    
                    if (activeConv) {
                        const [savedMessage] = await db.insert(messages).values({
                            companyId: ctx.companyId,
                            conversationId: activeConv.id,
                            connectionId: overrideConnectionId || activeConv.connectionId,
                            senderType: 'AI',
                            senderId: 'automation_node',
                            content: caption || `[Mídia enviada: ${mediaType}]`,
                            contentType: mediaType.toUpperCase(),
                            mediaUrl: step.data.file_url || step.data.url,
                            providerMessageId: sendResult.messageId || `auto-${Date.now()}`,
                            status: sendResult.success ? 'SENT' : 'FAILED',
                        }).returning();

                        if (savedMessage) {
                            emitToCompany(ctx.companyId, 'chat:new-message', {
                                conversationId: activeConv.id,
                                messageId: savedMessage.id,
                                connectionId: overrideConnectionId || activeConv.connectionId,
                                contactPhone: ctx.contactPhone || '',
                                contactName: ctx.contactName || '',
                                content: savedMessage.content,
                                contentType: savedMessage.contentType,
                                mediaUrl: savedMessage.mediaUrl,
                                isFromMe: true,
                                senderType: 'AGENT',
                                timestamp: new Date().toISOString(),
                            });
                            emitToCompany(ctx.companyId, 'inbox:update', { timestamp: Date.now() });
                        }
                    }
                } catch (saveErr: any) {
                    logger.error('[FLOW-ENGINE] Failed to save media message:', saveErr.message);
                }

                try {
                    await logContactEvent(ctx.companyId, ctx.contactId, 'AUTOMATION', `Mídia enviada via automação (${mediaType})${caption ? `:\n"${caption}"` : ''}`);
                } catch (e) {}
            }

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

            const overrideConnectionId = step.data.connection_id || ctx.connectionId;
            const sendResult = await sendUnifiedMessage({
                provider: ctx.provider as any,
                connectionId: overrideConnectionId,
                to: ctx.contactPhone || ctx.contactId,
                message: fullMessage,
            });

            if (!sendResult.success) {
                throw new Error(sendResult.error || 'Falha ao enviar pergunta');
            }

            if (ctx.contactId) {
                try {
                    const { eq, and, desc } = await import('drizzle-orm');
                    let activeConv = await db.query.conversations.findFirst({
                        where: and(eq(conversations.contactId, ctx.contactId), eq(conversations.companyId, ctx.companyId)),
                        orderBy: desc(conversations.lastMessageAt)
                    });
                    
                    if (!activeConv && overrideConnectionId) {
                        const [newConv] = await db.insert(conversations).values({
                            companyId: ctx.companyId,
                            contactId: ctx.contactId,
                            connectionId: overrideConnectionId,
                            status: 'IN_PROGRESS',
                        }).returning();
                        activeConv = newConv;
                    }
                    
                    if (activeConv) {
                        const [savedMessage] = await db.insert(messages).values({
                            companyId: ctx.companyId,
                            conversationId: activeConv.id,
                            connectionId: overrideConnectionId || activeConv.connectionId,
                            senderType: 'AI',
                            senderId: 'automation_node',
                            content: fullMessage,
                            contentType: 'TEXT',
                            providerMessageId: sendResult.messageId || `auto-${Date.now()}`,
                            status: sendResult.success ? 'SENT' : 'FAILED',
                        }).returning();

                        if (savedMessage) {
                            emitToCompany(ctx.companyId, 'chat:new-message', {
                                conversationId: activeConv.id,
                                messageId: savedMessage.id,
                                connectionId: overrideConnectionId || activeConv.connectionId,
                                contactPhone: ctx.contactPhone || '',
                                contactName: ctx.contactName || '',
                                content: savedMessage.content,
                                contentType: savedMessage.contentType,
                                mediaUrl: savedMessage.mediaUrl,
                                isFromMe: true,
                                senderType: 'AGENT',
                                timestamp: new Date().toISOString(),
                            });
                            emitToCompany(ctx.companyId, 'inbox:update', { timestamp: Date.now() });
                        }
                    }
                } catch (saveErr: any) {
                    logger.error('[FLOW-ENGINE] Failed to save ask_question message:', saveErr.message);
                }
            }
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
                    const overrideConnectionId = step.data.connection_id || ctx.connectionId;
                    await sendUnifiedMessage({
                        provider: ctx.provider as any,
                        connectionId: overrideConnectionId,
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
                        
                        await logContactEvent(ctx.companyId, ctx.contactId, 'AUTOMATION', `Dado coletado via automação: ${fieldKey} = ${answer}`);
                    } catch (e) {
                        logger.error('[FLOW-ENGINE] Capture CRM save error:', e);
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
                const overrideConnectionId = step.data.connection_id || ctx.connectionId;
                const sendResult = await sendUnifiedMessage({
                    provider: ctx.provider as any,
                    connectionId: overrideConnectionId,
                    to: ctx.contactPhone || ctx.contactId,
                    message: prompt,
                });

                if (!sendResult.success) {
                    throw new Error(sendResult.error || 'Falha ao enviar captura de info');
                }

                if (ctx.contactId) {
                    try {
                        const { eq, and, desc } = await import('drizzle-orm');
                        let activeConv = await db.query.conversations.findFirst({
                            where: and(eq(conversations.contactId, ctx.contactId), eq(conversations.companyId, ctx.companyId)),
                            orderBy: desc(conversations.lastMessageAt)
                        });
                        
                        if (!activeConv && overrideConnectionId) {
                            const [newConv] = await db.insert(conversations).values({
                                companyId: ctx.companyId,
                                contactId: ctx.contactId,
                                connectionId: overrideConnectionId,
                                status: 'IN_PROGRESS',
                            }).returning();
                            activeConv = newConv;
                        }
                        
                        if (activeConv) {
                            const [savedMessage] = await db.insert(messages).values({
                                companyId: ctx.companyId,
                                conversationId: activeConv.id,
                                connectionId: overrideConnectionId || activeConv.connectionId,
                                senderType: 'AI',
                                senderId: 'automation_node',
                                content: prompt,
                                contentType: 'TEXT',
                                providerMessageId: sendResult.messageId || `auto-${Date.now()}`,
                                status: sendResult.success ? 'SENT' : 'FAILED',
                            }).returning();

                            if (savedMessage) {
                                emitToCompany(ctx.companyId, 'chat:new-message', {
                                    conversationId: activeConv.id,
                                    messageId: savedMessage.id,
                                    connectionId: overrideConnectionId || activeConv.connectionId,
                                    contactPhone: ctx.contactPhone || '',
                                    contactName: ctx.contactName || '',
                                    content: savedMessage.content,
                                    contentType: savedMessage.contentType,
                                    mediaUrl: savedMessage.mediaUrl,
                                    isFromMe: true,
                                    senderType: 'AGENT',
                                    timestamp: new Date().toISOString(),
                                });
                                emitToCompany(ctx.companyId, 'inbox:update', { timestamp: Date.now() });
                            }
                        }
                    } catch (saveErr: any) {
                        logger.error('[FLOW-ENGINE] Failed to save capture_info message:', saveErr.message);
                    }
                }
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

        case 'campaign_wait_response':
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

            if (step.data?.interactionType === 'wait_response' || step.type === 'wait_response' || step.type === 'campaign_wait_response') {
                const timeoutAmount = parseInt(step.data?.maxWaitTime || step.data?.timeout_amount || step.data?.timeout_minutes || '0');
                const timeoutUnit = step.data?.unit || step.data?.timeout_unit || 'minutes';

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
        case 'delay': {
            const unit = step.data.unit || 'minutes';
            
            // Specific time mode: wait until HH:mm today (or tomorrow if past)
            if (unit === 'specific_time') {
                const targetTime = step.data.specific_time || '12:00'; // HH:mm
                const [targetH, targetM] = targetTime.split(':').map(Number);
                
                // Pega a hora atual do Brasil de forma confiável
                const now = new Date();
                const brtFormatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'America/Sao_Paulo',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    hour12: false
                });
                
                const parts = brtFormatter.formatToParts(now);
                // Handle 24h format quirk where midnight can be '24' in some node versions
                let brtH = Number(parts.find(p => p.type === 'hour')?.value || 0);
                if (brtH === 24) brtH = 0;
                const brtM = Number(parts.find(p => p.type === 'minute')?.value || 0);
                const brtS = Number(parts.find(p => p.type === 'second')?.value || 0);
                
                const nowMsInDay = (brtH * 3600 + brtM * 60 + brtS) * 1000;
                const targetMsInDay = (targetH * 3600 + targetM * 60) * 1000;
                
                let ms = targetMsInDay - nowMsInDay;
                if (ms <= 0) {
                    // Já passou do horário hoje, agenda para o mesmo horário de amanhã
                    ms += 24 * 60 * 60 * 1000;
                }
                
                return { action: 'delay', delayMs: ms, message: `Delay until ${targetTime} BRT (${Math.round(ms / 60000)} min)` };
            }

            const amount = parseInt(step.data.amount || '5');
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

        // ---- Edit Fields / Update Contact ----
        case 'update_contact':
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
                    logger.error('[FLOW-ENGINE] Edit fields JSON parse error:', e);
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
                    logger.error('[FLOW-ENGINE] Edit fields CRM save error:', e);
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
                        logger.error('[FLOW-ENGINE] Remove Tag action error:', e);
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
                        logger.error('[FLOW-ENGINE] Tag assignment action error:', e);
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

        // ---- Internal Message ----
        case 'internal_message': {
            const msgContent = await interpolateTemplate(step.data.message || step.data.note || '', ctx);
            if (!msgContent.trim()) {
                return { message: 'Mensagem interna vazia, ignorada' };
            }
            
            // Need a conversationId to insert internal message
            if (ctx.executionId && ctx.contactId) {
                const activeConv = await db.query.conversations.findFirst({
                    where: and(
                        eq(conversations.contactId, ctx.contactId),
                        eq(conversations.companyId, ctx.companyId),
                    ),
                    orderBy: desc(conversations.lastMessageAt),
                });
                
                if (activeConv) {
                    await db.insert(messages).values({
                        companyId: ctx.companyId,
                        conversationId: activeConv.id,
                        senderType: 'system',
                        content: msgContent,
                        contentType: 'INTERNAL',
                        status: 'sent',
                    });
                    return { message: `Internal message sent: ${msgContent.slice(0, 30)}...` };
                }
            }
            return { message: 'Mensagem interna falhou: sem conversação ativa' };
        }

        // ---- Add Task ----
        case 'add_task': {
            const taskText = await interpolateTemplate(step.data.task_text || step.data.text || '', ctx);
            if (!taskText.trim()) {
                return { message: 'Tarefa vazia, ignorada' };
            }
            
            await db.insert(tasks).values({
                companyId: ctx.companyId,
                title: taskText,
                description: 'Tarefa criada automaticamente pela Automação',
                contactId: ctx.contactId,
                priority: 'Média',
            });
            return { message: `Task created: ${taskText.slice(0, 30)}...` };
        }

        default:
            logger.warn(`[FLOW - ENGINE] Unknown node type: ${step.type} `);
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

        logger.debug(`[FLOW-ENGINE] 🔎 Searching paused executions for contactIds: [${contactIds.join(', ')}]`);

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
            logger.debug(`[FLOW-ENGINE] No paused execution found for contact ${contactId} (phone: ${contact?.phone || 'unknown'})`);
            return false;
        }

        logger.debug(`[FLOW-ENGINE] 🔄 Resuming paused execution ${pausedExecution.id} (step: ${pausedExecution.currentStepId}) for contact ${pausedExecution.contactId}`);

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
            logger.debug(`[FLOW-ENGINE] 🛑 A Automação ${flow.id} foi DESATIVADA! Cancelando a execução pausada ${pausedExecution.id}.`);
            await db.update(automationFlowExecutions)
                .set({ status: 'failed', error: 'Automação desativada pelo usuário', finishedAt: new Date() })
                .where(eq(automationFlowExecutions.id, pausedExecution.id));
            return false;
        }

        if (!flow || !flow.executionLogic) {
            logger.error(`[FLOW-ENGINE] ❌ Flow not found for paused execution: ${pausedExecution.flowId}`);
            await db.update(automationFlowExecutions)
                .set({ status: 'failed', error: 'Flow not found', finishedAt: new Date() })
                .where(eq(automationFlowExecutions.id, pausedExecution.id));
            return false;
        }

        // 5. Update variables with the lead's response
        const currentVars = (pausedExecution.variables as any)?.vars || {};
        currentVars.last_response = messageText;
        currentVars.message_text = messageText;

        logger.debug(`[FLOW-ENGINE] 📝 Updating vars: last_response="${messageText.slice(0, 50)}"`);

        // 6. Set status back to running with Atomic Lock
        const [lockedExecution] = await db.update(automationFlowExecutions)
            .set({
                status: 'running',
                variables: { vars: currentVars },
            })
            .where(and(
                eq(automationFlowExecutions.id, pausedExecution.id),
                eq(automationFlowExecutions.status, 'paused')
            ))
            .returning({ id: automationFlowExecutions.id });

        if (!lockedExecution) {
            logger.debug(`[FLOW-ENGINE] 🛑 Execution ${pausedExecution.id} was already resumed by another process. Avoiding race condition.`);
            return false;
        }

        // 7. Resume processing the current step
        const resumeStepId = pausedExecution.currentStepId;
        if (resumeStepId) {
            logger.debug(`[FLOW-ENGINE] ▶️ Resuming from step: ${resumeStepId}`);
            await processFlowExecution(pausedExecution.id, flow.executionLogic as any, resumeStepId);
        } else {
            logger.warn(`[FLOW-ENGINE] ⚠️ No currentStepId on paused execution, completing.`);
            await db.update(automationFlowExecutions)
                .set({ status: 'completed', finishedAt: new Date() })
                .where(eq(automationFlowExecutions.id, pausedExecution.id));
        }

        return true;
    } catch (error) {
        logger.error(`[FLOW-ENGINE] ❌ resumeFlowForContact error:`, error);
        return false;
    }
}
