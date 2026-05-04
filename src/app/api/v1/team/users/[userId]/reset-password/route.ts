// src/app/api/v1/team/users/[userId]/reset-password/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db, users } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';
import { hash } from 'bcryptjs';

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres.'),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { userId: userIdToUpdate } = await params;

        const body = await request.json();
        const parsed = resetPasswordSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }

        const { password } = parsed.data;

        // Verify the user being updated belongs to the admin's company
        const [userToUpdate] = await db.select({ id: users.id })
            .from(users)
            .where(and(eq(users.id, userIdToUpdate), eq(users.companyId, companyId)));
        
        if (!userToUpdate) {
            return NextResponse.json({ error: 'Utilizador não encontrado ou não pertence à sua empresa.' }, { status: 404 });
        }

        const passwordHash = await hash(password, 10);

        await db.update(users)
            .set({ password: passwordHash })
            .where(eq(users.id, userIdToUpdate));

        return NextResponse.json({ success: true, message: 'Senha do utilizador atualizada com sucesso.' });

    } catch (error) {
        console.error('Erro ao redefinir senha do utilizador:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
