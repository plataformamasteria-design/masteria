// src/app/api/v1/team/invite/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db, users, emailVerificationTokens } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { sendEmailVerificationLink } from '@/lib/email';
import { getBaseUrl } from '@/utils/get-base-url';
import { getCompanyIdFromSession } from '@/app/actions';

const inviteSchema = z.object({
  name: z.string().min(2, 'O nome é obrigatório.'),
  email: z.string().email('Email inválido.'),
  role: z.enum(['admin', 'atendente']),
});

const createExpirationDate = (hours: number): Date => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
};

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const requestId = randomUUID().slice(0, 8);
    console.log(`[INVITE:${requestId}] Iniciando convite de usuário...`);
    
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        
        const parsed = inviteSchema.safeParse(body);
        if (!parsed.success) {
            console.log(`[INVITE:${requestId}] Validação falhou:`, parsed.error.flatten());
            return NextResponse.json({ error: 'Dados de convite inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }
        const { name, email, role } = parsed.data;
        console.log(`[INVITE:${requestId}] Processando convite para: ${email}`);
        
        const [existingUser] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
        if (existingUser && existingUser.companyId === companyId) {
            console.log(`[INVITE:${requestId}] Usuário já pertence à equipa`);
            return NextResponse.json({ error: 'Este utilizador já pertence à sua equipa.' }, { status: 409 });
        }
        if (existingUser) {
            console.log(`[INVITE:${requestId}] Email já em uso por outra conta`);
            return NextResponse.json({ error: 'Este endereço de e-mail já está em uso por outra conta.' }, { status: 409 });
        }

        const temporaryPassword = randomBytes(16).toString('hex');
        const passwordHash = await hash(temporaryPassword, 10);
        
        const verificationToken = randomBytes(20).toString('hex');
        const tokenHash = createHash('sha256').update(verificationToken).digest('hex');
        const baseUrl = getBaseUrl();
        const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}`;
        
        console.log(`[INVITE:${requestId}] Token gerado: ${verificationToken.slice(0, 8)}...`);
        console.log(`[INVITE:${requestId}] Token hash: ${tokenHash.slice(0, 16)}...`);
        console.log(`[INVITE:${requestId}] Base URL: ${baseUrl}`);

        const result = await db.transaction(async (tx) => {
            const [invitedUser] = await tx.insert(users).values({
                email: email.toLowerCase(),
                name: name,
                password: passwordHash,
                firebaseUid: `native_${randomUUID()}`,
                role: role,
                companyId: companyId,
                emailVerified: null,
            }).returning({ id: users.id, name: users.name, email: users.email });

            if (!invitedUser) {
                throw new Error("Falha ao criar o utilizador convidado no banco de dados.");
            }
            console.log(`[INVITE:${requestId}] Usuário criado: ${invitedUser.id}`);

            const [tokenRecord] = await tx.insert(emailVerificationTokens).values({
                userId: invitedUser.id,
                tokenHash,
                expiresAt: createExpirationDate(24)
            }).returning({ id: emailVerificationTokens.id, tokenHash: emailVerificationTokens.tokenHash });
            
            if (!tokenRecord) {
                throw new Error("Falha ao criar token de verificação.");
            }
            console.log(`[INVITE:${requestId}] Token salvo na DB: ${tokenRecord.id}`);
            
            if (tokenRecord.tokenHash !== tokenHash) {
                console.error(`[INVITE:${requestId}] ERRO CRÍTICO: Token hash não confere!`);
                throw new Error("Inconsistência no token de verificação.");
            }
            console.log(`[INVITE:${requestId}] Verificação de integridade OK`);
            
            return { user: invitedUser, tokenId: tokenRecord.id };
        });

        console.log(`[INVITE:${requestId}] Transação concluída com sucesso`);
        console.log(`[INVITE:${requestId}] Enviando email para: ${result.user.email}`);
        
        try {
            await sendEmailVerificationLink(result.user.email, result.user.name, verificationLink);
            console.log(`[INVITE:${requestId}] ✅ Email enviado com sucesso`);
        } catch (emailError) {
            console.error(`[INVITE:${requestId}] ❌ Erro ao enviar email:`, emailError);
        }
        
        return NextResponse.json({ 
            success: true, 
            message: 'Utilizador convidado com sucesso.',
            requestId
        }, { status: 201 });

    } catch (error) {
        console.error(`[INVITE:${requestId}] Erro no endpoint de convite:`, error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
