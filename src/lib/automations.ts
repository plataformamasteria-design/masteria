// src/lib/automations.ts
'use server';

import { db } from './db';
import { automationFlows } from './db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const FlowVisualSchema = z.object({
    nodes: z.array(z.object({
        id: z.string(),
        type: z.string().optional(),
        position: z.object({ x: z.number(), y: z.number() }).optional(),
        data: z.any()
    })).min(1, 'Automação precisa de pelo menos 1 nó (Trigger).'),
    edges: z.array(z.object({
        id: z.string(),
        source: z.string(),
        target: z.string()
    })).optional().default([]),
});

export async function saveFlow(id: string, name: string, companyId: string, visualData: any, steps: any = []) {
    console.log('[saveFlow] Payload:', { id, name, companyId, stepsProvided: !!steps });

    if (!companyId || companyId === 'current-company') {
        throw new Error('Company ID inválido ou não fornecido.');
    }

    try {
        // Zod Integrity Validation
        const parsedVisualData = FlowVisualSchema.parse(visualData);

        let triggerType = 'message_received';
        let triggerConfig = null;
        let webhookToken = null;
        let scheduleConfig = null;
        if (steps && steps.length > 0 && steps[0].type === 'trigger') {
            triggerType = steps[0].data?.triggerType || 'message_received';
            triggerConfig = steps[0].data || null;
            if (triggerConfig) {
                webhookToken = triggerConfig.webhook_token || null;
                scheduleConfig = triggerConfig.schedule_config || null;
            }
        }

        let isNew = id === 'new';

        if (!isNew) {
            const existingFlow = await db.query.automationFlows.findFirst({
                where: and(eq(automationFlows.id, id), eq(automationFlows.companyId, companyId))
            });
            if (!existingFlow) {
                isNew = true;
            } else {
                // Preservar learning_notes se a UI enviar vazio, mas o DB tiver dados (Evita o overwrite por stale state do Editor)
                if (existingFlow.visualData && parsedVisualData?.nodes) {
                    const dbVisual = typeof existingFlow.visualData === 'string' ? JSON.parse(existingFlow.visualData as string) : existingFlow.visualData as any;
                    if (dbVisual?.nodes) {
                        parsedVisualData.nodes.forEach((incomingNode: any) => {
                            if (incomingNode.type === 'ai_agent') {
                                const dbNode = dbVisual.nodes.find((n: any) => n.id === incomingNode.id);
                                if (dbNode) {
                                    const dbNotes = dbNode.data?.learning_notes || dbNode.data?.config?.learning_notes;
                                    const incomingNotes = incomingNode.data?.learning_notes || incomingNode.data?.config?.learning_notes;
                                    
                                    if (!incomingNotes && dbNotes) {
                                        incomingNode.data = incomingNode.data || {};
                                        incomingNode.data.config = incomingNode.data.config || {};
                                        incomingNode.data.learning_notes = dbNotes;
                                        incomingNode.data.config.learning_notes = dbNotes;
                                        
                                        // Update the original visualData object since parsedVisualData is what we just parsed, but visualData is saved
                                        const origNode = visualData.nodes.find((n: any) => n.id === incomingNode.id);
                                        if (origNode) {
                                            origNode.data = origNode.data || {};
                                            origNode.data.config = origNode.data.config || {};
                                            origNode.data.learning_notes = dbNotes;
                                            origNode.data.config.learning_notes = dbNotes;
                                        }

                                        // Update steps
                                        if (steps && Array.isArray(steps)) {
                                            const incomingStep = steps.find((s: any) => s.id === incomingNode.id);
                                            if (incomingStep) {
                                                incomingStep.data = incomingStep.data || {};
                                                incomingStep.data.config = incomingStep.data.config || {};
                                                incomingStep.data.learning_notes = dbNotes;
                                                incomingStep.data.config.learning_notes = dbNotes;
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }
                }
            }
        }

        if (isNew) {
            const flowIdToInsert = id === 'new' ? undefined : id;
            const [newFlow] = await db.insert(automationFlows).values({
                ...(flowIdToInsert ? { id: flowIdToInsert } : {}),
                name,
                companyId,
                visualData,
                executionLogic: steps,
                triggerType,
                webhookToken,
                scheduleConfig,
                isActive: true,
            }).returning();
            revalidatePath('/management');
            revalidatePath('/settings');
            revalidatePath('/automacoes');
            revalidatePath('/automations');
            return { success: true, flow: newFlow };
        }

        const [updatedFlow] = await db.update(automationFlows)
            .set({
                name,
                visualData,
                executionLogic: steps,
                triggerType,
                webhookToken,
                scheduleConfig,
                updatedAt: new Date()
            })
            .where(and(
                eq(automationFlows.id, id),
                eq(automationFlows.companyId, companyId)
            ))
            .returning();

        if (!updatedFlow) {
            throw new Error('Fluxo não encontrado ou sem permissão para atualizar.');
        }

        revalidatePath('/management');
        revalidatePath('/settings');
        revalidatePath('/automacoes');
        revalidatePath('/automations');
        return { success: true, flow: updatedFlow };
    } catch (error: any) {
        console.error('[saveFlow Error]:', error);
        return { success: false, error: error.message || 'Erro interno ao salvar automação.' };
    }
}

export async function listFlows(companyId: string) {
    if (!companyId || companyId === 'current-company') {
        throw new Error('Company ID inválido ou não fornecido para listFlows.');
    }
    try {
        const flows = await db.select().from(automationFlows)
            .where(eq(automationFlows.companyId, companyId))
            .orderBy(sql`${automationFlows.updatedAt} DESC`);
        return flows;
    } catch (error) {
        console.error('[listFlows Error]:', error);
        throw error;
    }
}

export async function getFlow(id: string, companyId?: string) {
    try {
        const whereClause = (companyId && companyId !== 'current-company')
            ? and(eq(automationFlows.id, id), eq(automationFlows.companyId, companyId))
            : eq(automationFlows.id, id);
        const flow = await db.query.automationFlows.findFirst({ where: whereClause });
        return flow;
    } catch (error) {
        console.error('[getFlow Error]:', error);
        throw error;
    }
}

export async function deleteFlow(id: string, companyId: string) {
    console.log(`[deleteFlow] Attempting delete: ID=${id}, Company=${companyId}`);
    if (!companyId || companyId === 'current-company') throw new Error('Company ID é obrigatório.');

    try {
        const result = await db.delete(automationFlows)
            .where(and(
                eq(automationFlows.id, id),
                eq(automationFlows.companyId, companyId)
            )).returning();

        console.log(`[deleteFlow] Deleted rows:`, result.length);

        if (result.length === 0) {
            console.warn(`[deleteFlow] No rows matched for delete. ID=${id}`);
        }

        revalidatePath('/management');
        revalidatePath('/settings');
        return { success: true, count: result.length };
    } catch (error) {
        console.error('[deleteFlow Error]:', error);
        throw error;
    }
}

export async function renameFlow(id: string, newName: string, companyId: string) {
    console.log(`[renameFlow] Attempting rename: ID=${id}, Name=${newName}, Company=${companyId}`);
    if (!companyId || companyId === 'current-company') throw new Error('Company ID é obrigatório.');

    try {
        const [updated] = await db.update(automationFlows)
            .set({ name: newName, updatedAt: new Date() })
            .where(and(
                eq(automationFlows.id, id),
                eq(automationFlows.companyId, companyId)
            ))
            .returning();

        if (!updated) {
            console.warn(`[renameFlow] No rows matched for update. ID=${id}`);
            throw new Error('Automação não encontrada ou permissão negada.');
        }

        console.log(`[renameFlow] Success:`, updated.id);

        revalidatePath('/management');
        revalidatePath('/settings');
        return { success: true, flow: updated };
    } catch (error) {
        console.error('[renameFlow Error]:', error);
        throw error;
    }
}

export async function toggleFlowStatus(id: string, isActive: boolean, companyId: string) {
    console.log(`[toggleFlowStatus] id=${id}, isActive=${isActive}, companyId=${companyId}`);
    if (!companyId || companyId === 'current-company') throw new Error('Company ID é obrigatório.');

    try {
        const [updated] = await db.update(automationFlows)
            .set({ isActive, updatedAt: new Date() })
            .where(and(
                eq(automationFlows.id, id),
                eq(automationFlows.companyId, companyId)
            ))
            .returning();

        if (!updated) throw new Error('Automação não encontrada ou permissão negada.');

        revalidatePath('/management');
        revalidatePath('/settings');
        return { success: true, flow: updated };
    } catch (error) {
        console.error('[toggleFlowStatus Error]:', error);
        throw error;
    }
}

export async function cloneFlow(id: string, companyId: string) {
    console.log(`[cloneFlow] id=${id}, companyId=${companyId}`);
    if (!companyId || companyId === 'current-company') throw new Error('Company ID é obrigatório.');

    try {
        // 1. Buscar o fluxo original
        const original = await db.query.automationFlows.findFirst({
            where: and(
                eq(automationFlows.id, id),
                eq(automationFlows.companyId, companyId)
            )
        });

        if (!original) throw new Error('Fluxo original não encontrado.');

        // 2. Criar a cópia
        const [cloned] = await db.insert(automationFlows).values({
            name: `${original.name} (Cópia)`,
            companyId: companyId, // Sempre associa à empresa atual
            visualData: original.visualData,
            executionLogic: original.executionLogic,
            isActive: false, // Começa desativado por segurança
        }).returning();

        revalidatePath('/management');
        revalidatePath('/settings');
        return { success: true, flow: cloned };
    } catch (error) {
        console.error('[cloneFlow Error]:', error);
        throw error;
    }
}
