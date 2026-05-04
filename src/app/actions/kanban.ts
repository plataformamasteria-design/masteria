'use server';

import { db } from '@/lib/db';
import { eq, and, asc } from 'drizzle-orm';
import { requireAuthOr401 } from '@/lib/api-auth-helper';
import { funnels, funnelStages, chatFunnelStage, conversations, users, contacts } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';

export async function getKanbanFunnels() {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");
    const { companyId } = auth;

    return await db.select().from(funnels).where(eq(funnels.companyId, companyId)).orderBy(asc(funnels.createdAt));
}

export async function getKanbanStages(funnelId: string) {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");

    const stages = await db
        .select()
        .from(funnelStages)
        .where(eq(funnelStages.funnelId, funnelId))
        .orderBy(asc(funnelStages.position));

    // Get mappings
    const mappings = await db
        .select({
            chatId: chatFunnelStage.chatId,
            stageId: chatFunnelStage.stageId,
            chat: {
                id: conversations.id,
                phone: contacts.phone,
                contactName: contacts.name,
                profilePictureUrl: contacts.avatarUrl,
                assignedTo: conversations.assignedTo,
                teamId: conversations.teamId
            }
        })
        .from(chatFunnelStage)
        .innerJoin(conversations, eq(conversations.id, chatFunnelStage.chatId))
        .innerJoin(contacts, eq(conversations.contactId, contacts.id))
        .where(eq(chatFunnelStage.funnelId, funnelId));

    // Also get users to map names dynamically if assignedTo is set
    const companyUsers = await db.select().from(users).where(eq(users.companyId, auth.companyId));
    const userMap = new Map(companyUsers.map(u => [u.id, u.name]));

    return stages.map(stage => {
        return {
            ...stage,
            leads: mappings
                .filter(m => m.stageId === stage.id)
                .map(m => ({
                    ...m.chat,
                    assignedToName: m.chat.assignedTo ? userMap.get(m.chat.assignedTo) : null
                }))
        };
    });
}

export async function moveLeadDrop(chatId: string, funnelId: string, newStageId: string) {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");

    // Check if exists
    const existing = await db
        .select()
        .from(chatFunnelStage)
        .where(and(eq(chatFunnelStage.chatId, chatId), eq(chatFunnelStage.funnelId, funnelId)))
        .limit(1);

    if (existing.length > 0) {
        await db
            .update(chatFunnelStage)
            .set({ stageId: newStageId })
            .where(and(eq(chatFunnelStage.chatId, chatId), eq(chatFunnelStage.funnelId, funnelId)));
    } else {
        await db.insert(chatFunnelStage).values({
            chatId,
            funnelId,
            stageId: newStageId
        });
    }

    revalidatePath('/pipeline');
    return { success: true };
}

export async function createFunnel(name: string) {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");

    const [created] = await db.insert(funnels).values({
        companyId: auth.companyId,
        name
    }).returning();

    return created;
}

export async function createFunnelStage(funnelId: string, name: string, color: string, position: number) {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");

    const [created] = await db.insert(funnelStages).values({
        funnelId,
        name,
        color,
        position
    }).returning();

    return created;
}
