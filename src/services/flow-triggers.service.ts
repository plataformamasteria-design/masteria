// src/services/flow-triggers.service.ts
import { db } from '@/lib/db';
import { automationFlows, automationFlowExecutions, kanbanLeads, contacts, contactsToTags, tags, conversations } from '@/lib/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { logContactEvent } from '@/lib/contact-events';
import { createSystemMessage } from '@/services/system-message.service';
import { processFlowExecution } from '@/lib/flow-engine';

export interface FlowStep {
    id: string;
    type: string;
    data: any;
    nextSteps: string[];
    connections: { target: string; sourceHandle: string | null }[];
}

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

    logger.debug(`[FLOW - ENGINE] 📝 Execution created: ${execution.id} `);

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
