'use server';

import { db } from '@/lib/db';
import { requireAuthOr401 } from '@/lib/api-auth-helper';
import {
    funnels,
    funnelStages,
    tags,
    users,
    aiCredentials,
    aiPersonas,
    automationFlows,
    automationNodes,
    automationEdges,
    contacts,
    conversations
} from '@/lib/db/schema';
import { eq, desc, and, ilike, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// Tipos para exportação
export type AutomationNodeData = {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: any;
};

export type AutomationEdgeData = {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    label?: string;
    data?: any;
};

// -------------------------------------------------------------
// CORE AUTOMATION EDITOR SAVE/LOAD
// -------------------------------------------------------------

export async function loadAutomationGraph(automationId: string) {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");

    const automationData = await db.select().from(automationFlows).where(eq(automationFlows.id, automationId));
    if (automationData.length === 0) return null;

    const rawNodes = await db.select().from(automationNodes).where(eq(automationNodes.automationId, automationId));
    const rawEdges = await db.select().from(automationEdges).where(eq(automationEdges.automationId, automationId));

    const parsedNodes = rawNodes.map((n) => ({
        id: n.id,
        type: n.nodeType,
        position: { x: n.positionX, y: n.positionY },
        data: { label: n.label, config: n.config }
    }));

    const parsedEdges = rawEdges.map((e) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        sourceHandle: e.sourceHandleId || undefined,
        label: e.conditionLabel || undefined,
        type: "deletable",
        data: { conditionValue: e.conditionValue }
    }));

    return {
        automation: automationData[0],
        nodes: parsedNodes,
        edges: parsedEdges
    };
}

export async function saveAutomationGraph(automationId: string, payload: { name: string, triggerConfig: any, nodes: any[], edges: any[] }) {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");
    const { companyId } = auth;

    // 1. Atualizar config raiz
    await db.update(automationFlows).set({
        name: payload.name,
        triggerType: payload.triggerConfig?.trigger_type || 'stage_entry',
        webhookToken: payload.triggerConfig?.webhook_token,
        scheduleConfig: payload.triggerConfig?.schedule_config,
        updatedAt: new Date()
    }).where(eq(automationFlows.id, automationId));

    // 2. Transação para recriar grapho (mais seguro do que dar UPSERT pontual em fluxo de blocos deletados)
    await db.transaction(async (tx) => {
        // Delete os grafos antigos deste fluxo
        await tx.delete(automationNodes).where(eq(automationNodes.automationId, automationId));
        await tx.delete(automationEdges).where(eq(automationEdges.automationId, automationId));

        // Inserir Nodes (lote)
        if (payload.nodes.length > 0) {
            await tx.insert(automationNodes).values(
                payload.nodes.map(n => ({
                    id: n.id,
                    automationId,
                    companyId,
                    nodeType: n.type,
                    positionX: Math.round(n.position.x),
                    positionY: Math.round(n.position.y),
                    label: n.data?.label || '',
                    config: n.data?.config || {}
                }))
            );
        }

        // Inserir Edges (lote)
        if (payload.edges.length > 0) {
            await tx.insert(automationEdges).values(
                payload.edges.map(e => ({
                    id: e.id,
                    automationId,
                    companyId,
                    sourceNodeId: e.source,
                    targetNodeId: e.target,
                    sourceHandleId: e.sourceHandle || null,
                    conditionLabel: e.label || null,
                    conditionValue: e.data?.conditionValue || null
                }))
            );
        }
    });

    revalidatePath(`/automacoes/${automationId}`);
    return { success: true };
}

// -------------------------------------------------------------
// DYNAMIC DROPDOWNS FETCHERS PARA OS NODES ESPECÍFICOS
// -------------------------------------------------------------

export async function getFunnelsForDropdown() {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");
    return db.select({ id: funnels.id, name: funnels.name }).from(funnels).where(eq(funnels.companyId, auth.companyId));
}

export async function getFunnelStagesForDropdown() {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");
    // Ordenando id, name, color, funnelId
    return db.select({ id: funnelStages.id, name: funnelStages.name, color: funnelStages.color, funnel_id: funnelStages.funnelId }).from(funnelStages).where(eq(funnelStages.companyId, auth.companyId));
}

export async function getAiCredentialsForDropdown() {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");
    return db.select({ id: aiCredentials.id, name: aiCredentials.name, provider: aiCredentials.provider }).from(aiCredentials).where(eq(aiCredentials.companyId, auth.companyId));
}

export async function getPersonasForDropdown() {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");
    return db.select({ id: aiPersonas.id, name: aiPersonas.name }).from(aiPersonas).where(eq(aiPersonas.companyId, auth.companyId));
}

export async function getTagsForDropdown() {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");
    return db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).where(eq(tags.companyId, auth.companyId));
}

export async function getUsersForDropdown() {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");
    return db.select({ id: users.id, full_name: users.name }).from(users).where(eq(users.companyId, auth.companyId));
}

export async function getCustomFieldsForDropdown() {
    // const auth = await requireAuthOr401();
    // if ('status' in auth) throw new Error("Unauthorized");
    // return db.select(...).from(chatCustomFields)...
    return [];
}

export async function getTestLeadsForSelector(q?: string) {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");

    let conditions = [eq(conversations.companyId, auth.companyId)];
    if (q && q.length >= 2) {
        conditions.push(or(
            ilike(contacts.name, `%${q}%`),
            ilike(contacts.phone, `%${q}%`)
        )!);
    }

    return db.select({
        id: conversations.id,
        contact_name: contacts.name,
        phone: contacts.phone,
        avatar_url: contacts.avatarUrl,
    })
        .from(conversations)
        .innerJoin(contacts, eq(conversations.contactId, contacts.id))
        .where(and(...conditions))
        .limit(8)
        .orderBy(desc(conversations.id));
}
