'use server';

import { db } from '@/lib/db';
import { superadminBoards } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getUserSession } from '@/app/actions';

const requireSuperadmin = async () => {
    const session = await getUserSession();
    if (session.error || !session.user) throw new Error("Acesso negado: Sessão inválida.");
    if (session.user.role !== 'superadmin') throw new Error("Acesso negado: Perfil insuficiente.");
    return session.user;
};

export async function getSuperadminBoards() {
    try {
        await requireSuperadmin();
        const boards = await db.select().from(superadminBoards).orderBy(desc(superadminBoards.createdAt));
        return { success: true, data: boards };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function createSuperadminBoard(name: string) {
    try {
        await requireSuperadmin();
        const [newBoard] = await db.insert(superadminBoards).values({
            name,
            columns: [
                { id: `col_${Date.now()}_1`, title: 'Empresa', type: 'text' },
                { id: `col_${Date.now()}_2`, title: 'Status', type: 'status', options: ['Pendente', 'Em Andamento', 'Concluído'] }
            ],
            rows: []
        }).returning();
        
        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true, data: newBoard };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateSuperadminBoard(boardId: string, name: string, columns: any[], rows: any[]) {
    try {
        await requireSuperadmin();
        await db.update(superadminBoards)
            .set({ name, columns, rows, updatedAt: new Date() })
            .where(eq(superadminBoards.id, boardId));
        
        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteSuperadminBoard(boardId: string) {
    try {
        await requireSuperadmin();
        await db.delete(superadminBoards).where(eq(superadminBoards.id, boardId));
        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
