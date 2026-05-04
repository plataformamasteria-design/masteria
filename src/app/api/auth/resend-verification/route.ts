// src/app/api/auth/resend-verification/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users, emailVerificationTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes, createHash, randomUUID } from 'crypto';
import { sendEmailVerificationLink } from '@/lib/email';
import { getBaseUrl } from '@/utils/get-base-url';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';

const resendSchema = z.object({
  userId: z.string().uuid(),
});

const createExpirationDate = (hours: number): Date => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
};

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const requestId = randomUUID().slice(0, 8);
    console.log(`[RESEND:${requestId}] Iniciando reenvio de verificação...`);
    
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = resendSchema.safeParse(body);

        if (!parsed.success) {
            console.log(`[RESEND:${requestId}] Validação falhou:`, parsed.error.flatten());
            return NextResponse.json({ error: 'ID de utilizador inválido.' }, { status: 400 });
        }

        const { userId } = parsed.data;
        console.log(`[RESEND:${requestId}] Processando para userId: ${userId}`);

        const [user] = await db.select({ 
            id: users.id, 
            email: users.email, 
            name: users.name, 
            companyId: users.companyId 
        }).from(users).where(eq(users.id, userId));

        if (!user || user.companyId !== companyId) {
            console.log(`[RESEND:${requestId}] Usuário não encontrado ou não pertence à empresa`);
            return NextResponse.json({ error: 'Utilizador não encontrado ou não pertence a esta empresa.' }, { status: 404 });
        }
        
        const verificationToken = randomBytes(20).toString('hex');
        const tokenHash = createHash('sha256').update(verificationToken).digest('hex');
        const baseUrl = getBaseUrl();
        const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}`;
        
        console.log(`[RESEND:${requestId}] Token gerado: ${verificationToken.slice(0, 8)}...`);
        console.log(`[RESEND:${requestId}] Token hash: ${tokenHash.slice(0, 16)}...`);
        console.log(`[RESEND:${requestId}] Base URL: ${baseUrl}`);
        
        const _tokenRecord = await db.transaction(async (tx) => {
            await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, user.id));
            console.log(`[RESEND:${requestId}] Tokens antigos removidos`);
            
            const [newToken] = await tx.insert(emailVerificationTokens).values({
                userId: user.id,
                tokenHash: tokenHash,
                expiresAt: createExpirationDate(24)
            }).returning({ id: emailVerificationTokens.id, tokenHash: emailVerificationTokens.tokenHash });
            
            if (!newToken) {
                throw new Error("Falha ao criar novo token de verificação.");
            }
            
            if (newToken.tokenHash !== tokenHash) {
                console.error(`[RESEND:${requestId}] ERRO CRÍTICO: Token hash não confere!`);
                throw new Error("Inconsistência no token de verificação.");
            }
            
            console.log(`[RESEND:${requestId}] Novo token salvo: ${newToken.id}`);
            console.log(`[RESEND:${requestId}] Verificação de integridade OK`);
            
            return newToken;
        });

        console.log(`[RESEND:${requestId}] Transação concluída com sucesso`);
        console.log(`[RESEND:${requestId}] Enviando email para: ${user.email}`);
        
        try {
            await sendEmailVerificationLink(user.email, user.name, verificationLink);
            console.log(`[RESEND:${requestId}] ✅ Email enviado com sucesso`);
        } catch (emailError) {
            console.error(`[RESEND:${requestId}] ❌ Erro ao enviar email:`, emailError);
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Um novo link de verificação foi enviado.',
            requestId
        });

    } catch (error) {
        console.error(`[RESEND:${requestId}] Erro ao reenviar e-mail de verificação:`, error);
        if (error instanceof Error && error.message.includes("Não autorizado")) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
    }
}
