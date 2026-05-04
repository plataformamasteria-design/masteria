

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tags } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';


const tagUpdateSchema = z.object({
  name: z.string().min(1, 'Nome da tag é obrigatório').optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida. Use o formato hexadecimal (ex: #RRGGBB).').optional(),
});

// PUT /api/v1/tags/[tagId] - Update a tag

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { tagId } = await params;
        const body = await request.json();
        const parsedData = tagUpdateSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsedData.error.flatten() }, { status: 400 });
        }

        const [result] = await db.select({ companyId: tags.companyId }).from(tags).where(eq(tags.id, tagId)).limit(1);
        if (!result || result.companyId !== companyId) {
             return NextResponse.json({ error: 'Tag não encontrada ou não pertence à sua empresa.' }, { status: 404 });
        }

        // SECURITY: Validar tenant ao atualizar tag (já validado acima, mas garantindo segurança)
        const [updatedTag] = await db.update(tags)
            .set(parsedData.data)
            .where(and(
                eq(tags.id, tagId),
                eq(tags.companyId, companyId)
            ))
            .returning();
            
        return NextResponse.json(updatedTag);
    } catch (error) {
        console.error('Erro ao atualizar tag:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

// DELETE /api/v1/tags/[tagId] - Delete a tag
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { tagId } = await params;
        const result = await db.delete(tags)
            .where(and(eq(tags.id, tagId), eq(tags.companyId, companyId)))
            .returning();

        if (result.length === 0) {
            return NextResponse.json({ error: 'Tag não encontrada ou não pertence à sua empresa.' }, { status: 404 });
        }

        return new NextResponse(null, { status: 204 }); // No Content

    } catch (error) {
        console.error('Erro ao excluir tag:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
