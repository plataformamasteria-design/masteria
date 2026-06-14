'use server';

import { db } from '@/lib/db';
import { conversations, users, teams, usersToTeams, tags, kanbanBoards } from '@/lib/db/schema';
import { requireAuthOr401 } from '@/lib/api-auth-helper';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { createSystemMessage } from '@/services/system-message.service';
import { logContactEvent } from '@/lib/contact-events';
import { emitInboxUpdate } from '@/lib/socket';
import { evaluateLeadAssignedTriggers } from '@/lib/flow-engine';

export async function getOrganizationUsers() {
    try {
        const auth = await requireAuthOr401();
        if (auth instanceof NextResponse) throw new Error('Não autorizado');
        const { companyId } = auth;

        const orgUsers = await db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            avatarUrl: users.avatarUrl
        }).from(users).where(eq(users.companyId, companyId));

        return { success: true, data: orgUsers };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getOrganizationTeams() {
    try {
        const auth = await requireAuthOr401();
        if (auth instanceof NextResponse) throw new Error('Não autorizado');
        const { companyId } = auth;

        const orgTeams = await db.select({
            id: teams.id,
            name: teams.name
        }).from(teams).where(eq(teams.companyId, companyId));

        return { success: true, data: orgTeams };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function assignChatToUser(conversationId: string, userId: string) {
    try {
        const auth = await requireAuthOr401();
        if (auth instanceof NextResponse) throw new Error('Não autorizado');
        const { companyId } = auth;

        // ✅ v2: Auto-disable AI when assigning to user
        await db.update(conversations)
            .set({ assignedTo: userId, teamId: null, status: 'OPEN', aiActive: false })
            .where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));

        const [assignedUser] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
        const userName = assignedUser?.name || 'Agente';
        await createSystemMessage({ conversationId, companyId, content: `🔒 Conversa atribuída a ${userName}` });

        const [conv] = await db.select({ contactId: conversations.contactId }).from(conversations).where(eq(conversations.id, conversationId));
        if (conv?.contactId) {
            await logContactEvent(companyId, conv.contactId, 'ASSIGNMENT', `Atendimento assumido por ${userName}`, { assignedUserId: userId });
            
            // Trigger flow engine for lead_assigned
            await evaluateLeadAssignedTriggers(companyId, conv.contactId, 'user', userId).catch(e => {
                console.error('[FlowEngine] Erro ao processar gatilho lead_assigned (user):', e);
            });
        }

        emitInboxUpdate(companyId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function assignChatToTeam(conversationId: string, teamId: string) {
    try {
        const auth = await requireAuthOr401();
        if (auth instanceof NextResponse) throw new Error('Não autorizado');
        const { companyId } = auth;

        await db.update(conversations)
            .set({ teamId: teamId, assignedTo: null, status: 'OPEN' })
            .where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));

        const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId));
        const teamName = team?.name || 'Equipe';
        await createSystemMessage({ conversationId, companyId, content: `👥 Conversa transferida para equipe ${teamName}` });

        const [conv] = await db.select({ contactId: conversations.contactId }).from(conversations).where(eq(conversations.id, conversationId));
        if (conv?.contactId) {
            await logContactEvent(companyId, conv.contactId, 'ASSIGNMENT', `Transferido para equipe ${teamName}`, { teamId: teamId });
            
            // Trigger flow engine for lead_assigned
            await evaluateLeadAssignedTriggers(companyId, conv.contactId, 'team', teamId).catch(e => {
                console.error('[FlowEngine] Erro ao processar gatilho lead_assigned (team):', e);
            });
        }

        emitInboxUpdate(companyId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function unassignChat(conversationId: string) {
    try {
        const auth = await requireAuthOr401();
        if (auth instanceof NextResponse) throw new Error('Não autorizado');
        const { companyId } = auth;

        // ✅ v2: Auto-re-enable AI when unassigning
        await db.update(conversations)
            .set({ teamId: null, assignedTo: null, status: 'NEW', aiActive: true })
            .where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));

        await createSystemMessage({ conversationId, companyId, content: '🔓 Atribuição removida — IA reativada' });

        const [conv] = await db.select({ contactId: conversations.contactId }).from(conversations).where(eq(conversations.id, conversationId));
        if (conv?.contactId) {
            await logContactEvent(companyId, conv.contactId, 'ASSIGNMENT', `Atendimento removido de agente/equipe`, { assignedUserId: null });
        }

        emitInboxUpdate(companyId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getOrganizationTags() {
    try {
        const auth = await requireAuthOr401();
        if (auth instanceof NextResponse) throw new Error('Não autorizado');
        const { companyId } = auth;

        const orgTags = await db.select({
            id: tags.id,
            name: tags.name,
            color: tags.color
        }).from(tags).where(eq(tags.companyId, companyId));

        return { success: true, data: orgTags };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getOrganizationKanbanBoards() {
    try {
        const auth = await requireAuthOr401();
        if (auth instanceof NextResponse) throw new Error('Não autorizado');
        const { companyId } = auth;

        const orgBoards = await db.select({
            id: kanbanBoards.id,
            name: kanbanBoards.name
        }).from(kanbanBoards).where(eq(kanbanBoards.companyId, companyId));

        return { success: true, data: orgBoards };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
