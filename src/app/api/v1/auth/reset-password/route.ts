

// src/app/api/v1/auth/reset-password/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { eq, gte, and } from 'drizzle-orm';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { createHash } from 'crypto';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = resetPasswordSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }

        const { token, password } = parsed.data;
        const tokenHash = createHash('sha256').update(token).digest('hex');
        
        const [resetTokenRecord] = await db
            .select()
            .from(passwordResetTokens)
            .where(and(
                eq(passwordResetTokens.tokenHash, tokenHash),
                gte(passwordResetTokens.expiresAt, new Date())
            ));

        if (!resetTokenRecord) {
            return NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 400 });
        }
        
        // Invalida o token imediatamente, mesmo antes de alterar a senha.
        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetTokenRecord.id));
        
        const passwordHash = await hash(password, 10);
        
        await db.update(users)
            .set({ password: passwordHash })
            .where(eq(users.id, resetTokenRecord.userId));

        return NextResponse.json({ success: true, message: 'Senha redefinida com sucesso.' });

    } catch (error) {
        console.error('Erro no endpoint de reset-password:', error);
        return NextResponse.json({ error: 'Erro interno do servidor.', details: (error as Error).message }, { status: 500 });
    }
}
