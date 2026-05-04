

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { contactLists } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';


const listUpdateSchema = z.object({
  name: z.string().min(1, 'Nome da lista é obrigatório').optional(),
  description: z.string().optional().nullable(),
});


// PUT /api/v1/lists/[listId] - Update a contact list

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ listId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { listId } = await params;
        const body = await request.json();
        const parsedData = listUpdateSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsedData.error.flatten() }, { status: 400 });
        }

        const [result] = await db.select({ companyId: contactLists.companyId }).from(contactLists).where(eq(contactLists.id, listId)).limit(1);
        if (!result || result.companyId !== companyId) {
             return NextResponse.json({ error: 'Lista não encontrada ou não pertence à sua empresa.' }, { status: 404 });
        }

        // SECURITY: Validar tenant ao atualizar lista (já validado acima, mas garantindo segurança)
        const [updatedList] = await db.update(contactLists)
            .set(parsedData.data)
            .where(and(
                eq(contactLists.id, listId),
                eq(contactLists.companyId, companyId)
            ))
            .returning();
            
        return NextResponse.json(updatedList);
    } catch (error) {
        console.error('Erro ao atualizar lista:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

// DELETE /api/v1/lists/[listId] - Delete a contact list
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ listId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { listId } = await params;
        
        const result = await db.delete(contactLists)
            .where(and(eq(contactLists.id, listId), eq(contactLists.companyId, companyId)))
            .returning();

        if (result.length === 0) {
            return NextResponse.json({ error: 'Lista não encontrada ou não pertence à sua empresa.' }, { status: 404 });
        }

        return new NextResponse(null, { status: 204 }); // No Content

    } catch (error) {
        console.error('Erro ao excluir lista:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
