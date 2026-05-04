// src/app/api/v1/ai-credentials/[credentialId]/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { aiCredentials } from '@/lib/db/schema';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { encrypt } from '@/lib/crypto';

const credentialUpdateSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.').optional(),
  provider: z.enum(['OPENROUTER', 'GEMINI']).optional(),
  apiKey: z.string().optional(),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ credentialId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { credentialId } = await params;
        const body = await request.json();
        const parsed = credentialUpdateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }
        
        const dataToUpdate: Partial<typeof aiCredentials.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (parsed.data.name) dataToUpdate.name = parsed.data.name;
        if (parsed.data.provider) dataToUpdate.provider = parsed.data.provider;
        
        // Salva a chave em texto plano se for fornecida
        if (parsed.data.apiKey) {
            dataToUpdate.apiKey = encrypt(parsed.data.apiKey);
        }

        const [updated] = await db.update(aiCredentials)
            .set(dataToUpdate)
            .where(and(eq(aiCredentials.id, credentialId), eq(aiCredentials.companyId, companyId)))
            .returning();
            
        if (!updated) {
            return NextResponse.json({ error: 'Credencial não encontrada ou não pertence à sua empresa.' }, { status: 404 });
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Erro ao atualizar credencial:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ credentialId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { credentialId } = await params;

        await db.delete(aiCredentials)
            .where(and(eq(aiCredentials.id, credentialId), eq(aiCredentials.companyId, companyId)));
            
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Erro ao excluir credencial:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
