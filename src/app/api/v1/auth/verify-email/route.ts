// src/app/api/v1/auth/verify-email/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db, users, emailVerificationTokens } from '@/lib/db';
import { eq, and, gte } from 'drizzle-orm';
import { z } from 'zod';
import { createHash, randomUUID } from 'crypto';
import { SignJWT } from 'jose';

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório.'),
});

const getJwtSecretKey = () => {
    const secret = process.env.JWT_SECRET_KEY_CALL;
    if (!secret) {
        throw new Error('JWT_SECRET_KEY_CALL não está definida nas variáveis de ambiente.');
    }
    return new TextEncoder().encode(secret);
};

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const requestId = randomUUID().slice(0, 8);
    console.log(`[VERIFY-V1:${requestId}] Iniciando verificação de email...`);
    
    try {
        const body = await request.json();
        const parsed = verifyEmailSchema.safeParse(body);

        if (!parsed.success) {
            console.log(`[VERIFY-V1:${requestId}] Validação falhou:`, parsed.error.flatten());
            return NextResponse.json({ error: 'Token inválido.', details: parsed.error.flatten() }, { status: 400 });
        }

        const { token } = parsed.data;
        const tokenHash = createHash('sha256').update(token).digest('hex');
        
        console.log(`[VERIFY-V1:${requestId}] Token recebido: ${token.slice(0, 8)}...`);
        console.log(`[VERIFY-V1:${requestId}] Token hash calculado: ${tokenHash.slice(0, 16)}...`);

        const [tokenRecord] = await db
            .select()
            .from(emailVerificationTokens)
            .where(and(
                eq(emailVerificationTokens.tokenHash, tokenHash),
                gte(emailVerificationTokens.expiresAt, new Date())
            ));

        if (!tokenRecord) {
            console.log(`[VERIFY-V1:${requestId}] Token não encontrado ou expirado`);
            
            const [expiredToken] = await db
                .select()
                .from(emailVerificationTokens)
                .where(eq(emailVerificationTokens.tokenHash, tokenHash));
            
            if (expiredToken) {
                console.log(`[VERIFY-V1:${requestId}] Token existe mas expirou em: ${expiredToken.expiresAt}`);
            } else {
                console.log(`[VERIFY-V1:${requestId}] Token não existe na base de dados`);
            }
            
            return NextResponse.json({ error: 'Token inválido ou expirado. Por favor, solicite um novo convite.' }, { status: 400 });
        }
        
        console.log(`[VERIFY-V1:${requestId}] Token encontrado para userId: ${tokenRecord.userId}`);
        console.log(`[VERIFY-V1:${requestId}] Token hash na DB: ${tokenRecord.tokenHash.slice(0, 16)}...`);
        
        await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, tokenRecord.id));
        console.log(`[VERIFY-V1:${requestId}] Token invalidado (removido da DB)`);
        
        await db.update(users)
            .set({ emailVerified: new Date() })
            .where(eq(users.id, tokenRecord.userId));
        console.log(`[VERIFY-V1:${requestId}] Email marcado como verificado`);

        const [user] = await db
            .select({
                id: users.id,
                companyId: users.companyId,
                email: users.email,
                role: users.role,
            })
            .from(users)
            .where(eq(users.id, tokenRecord.userId))
            .limit(1);

        if (!user) {
            console.warn(`[VERIFY-V1:${requestId}] Usuário não encontrado após verificação - email verificado mas sem auto-login`);
            return NextResponse.json({ 
                success: true, 
                message: 'E-mail verificado com sucesso. Por favor, faça login.',
                redirectTo: '/login',
                requestId
            });
        }

        console.log(`[VERIFY-V1:${requestId}] Criando sessão JWT para usuário: ${user.email}`);

        const jwtToken = await new SignJWT({
            userId: user.id,
            companyId: user.companyId,
            email: user.email,
            role: user.role,
        })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1d')
        .sign(getJwtSecretKey());

        console.log(`[VERIFY-V1:${requestId}] ✅ Verificação e auto-login concluídos com sucesso`);

        const response = NextResponse.json({ 
            success: true, 
            message: 'E-mail verificado com sucesso. Redirecionando para o painel.',
            redirectTo: '/dashboard',
            requestId
        });

        response.cookies.set({
            name: '__session',
            value: jwtToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24,
        });
        response.cookies.set({
            name: 'session_token',
            value: jwtToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24,
        });

        return response;

    } catch (error) {
        console.error(`[VERIFY-V1:${requestId}] Erro no endpoint de verify-email:`, error);
        return NextResponse.json({ error: 'Erro interno do servidor.', details: (error as Error).message }, { status: 500 });
    }
}
