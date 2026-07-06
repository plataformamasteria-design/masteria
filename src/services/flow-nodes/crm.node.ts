import { FlowStep } from '@/services/flow-triggers.service';
import { ExecutionContext, NodeResult, NodeHandler } from './types';
import { db } from '@/lib/db';
import { tags, contactsToTags, kanbanBoards, kanbanLeads, conversations } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { logContactEvent } from '@/lib/contact-events';

export class CRMNodeHandler implements NodeHandler {
    async execute(step: FlowStep, ctx: ExecutionContext, allSteps: FlowStep[]): Promise<NodeResult> {
        switch (step.type) {
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
                            color: '#e5e7eb',
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
                            // ALWAYS use multi-funnel logic as requested by user:
                            // "se o lead já pertencer ao funil apenas atualiza a etapa, e não pertencer então adiciona o lead aquele funil e etapa"
                            let existingLead = await db.query.kanbanLeads.findFirst({
                                where: and(
                                    eq(kanbanLeads.boardId, board.id),
                                    eq(kanbanLeads.contactId, ctx.contactId)
                                )
                            });

                            if (existingLead) {
                                // Move existing card
                                await db.update(kanbanLeads)
                                    .set({
                                        boardId: board.id, // Update boardId in case it's moving from another board
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

        // ---- Assign Connection ----
        case 'assign_connection': {
            if (!ctx.contactId) return { message: 'Assign Connection: no contact to assign' };

            const connectionId = step.data.connection_id;
            if (!connectionId) return { message: 'Assign Connection: no connection selected' };

            try {
                // Ensure the contact has at least one conversation to hold the assignment
                let conv = await db.query.conversations.findFirst({
                    where: and(eq(conversations.contactId, ctx.contactId), eq(conversations.companyId, ctx.companyId))
                });

                if (!conv) {
                    const [inserted] = await db.insert(conversations).values({
                        companyId: ctx.companyId,
                        contactId: ctx.contactId,
                        status: 'NEW',
                        connectionId: connectionId,
                        aiActive: false
                    }).returning();
                    conv = inserted;
                } else {
                    await db.update(conversations)
                        .set({ connectionId: connectionId })
                        .where(eq(conversations.id, conv.id));
                }

                try { await logContactEvent(ctx.companyId, ctx.contactId, 'SYSTEM_NOTE', `Conexão atribuída via automação`); } catch(e){}
                return { message: `Assign Connection: ${connectionId}` };
            } catch (err) {
                console.error('[AssignConnectionNode] Erro:', err);
                return { message: 'Assign Connection failed', error: String(err) };
            }
        }

        // ---- Assign User ----
        case 'assign_user': {
            if (!ctx.contactId) return { message: 'Assign: no contact to assign' };

            const assignType = step.data.assign_type || 'user';
            
            try {
                // Ensure the contact has at least one conversation to hold the assignment
                let conv = await db.query.conversations.findFirst({
                    where: and(eq(conversations.contactId, ctx.contactId), eq(conversations.companyId, ctx.companyId))
                });

                if (!conv) {
                    const [inserted] = await db.insert(conversations).values({
                        companyId: ctx.companyId,
                        contactId: ctx.contactId,
                        status: 'NEW',
                        aiActive: false
                    }).returning();
                    conv = inserted;
                }

                if (assignType === 'user') {
                    const userId = step.data.user_id;
                    if (userId) {
                        await db.update(conversations)
                            .set({ assignedTo: userId })
                            .where(eq(conversations.contactId, ctx.contactId));
                        try { await logContactEvent(ctx.companyId, ctx.contactId, 'ASSIGNMENT', `Atendimento repassado para atendente via automação`, { assignedUserId: userId }); } catch(e){}
                        return { message: `Assign: user ${userId}` };
                    }
                } else if (assignType === 'team') {
                    const teamId = step.data.team_id;
                    if (teamId) {
                        await db.update(conversations)
                            .set({ teamId: teamId })
                            .where(eq(conversations.contactId, ctx.contactId));
                        try { await logContactEvent(ctx.companyId, ctx.contactId, 'ASSIGNMENT', `Atendimento repassado para equipe via automação`, { teamId }); } catch(e){}
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
                                try { await logContactEvent(ctx.companyId, ctx.contactId, 'ASSIGNMENT', `Atendimento repassado (aleatório na equipe) via automação`, { assignedUserId: selectedUserId, teamId }); } catch(e){}
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
                    try { await logContactEvent(ctx.companyId, ctx.contactId, 'TAG', `Etiqueta adicionada via automação: ${tag.name}`); } catch(e){}
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
                    try { await logContactEvent(ctx.companyId, ctx.contactId, 'TAG', `Etiqueta removida via automação: ${tag.name}`); } catch(e){}
                    return { message: `Remove Tag: ${tag.name}` };
                }
            } catch (e) {
                console.error('[FLOW-ENGINE] Remove Tag error:', e);
            }
            return { message: 'Remove Tag: not found or failed' };
        }

        // ---- Bot Toggle ----
            default:
                return { message: 'Unknown CRM node type' };
        }
    }
}
