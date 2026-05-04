// src/app/api/admin/resend-verification-direct/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users, emailVerificationTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes, createHash, randomUUID } from 'crypto';
import { sendEmailVerificationLink } from '@/lib/email';
import { getBaseUrl } from '@/utils/get-base-url';

const createExpirationDate = (hours: number): Date => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
};

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = randomUUID().slice(0, 8);
  console.log(`\n[ADMIN-RESEND:${requestId}] ===== INICIANDO REENVIO DIRETO =====`);
  
  try {
    // Validação simples (sem requer company ID)
    const body = await request.json();
    const { userId, email, name } = body;

    console.log(`[ADMIN-RESEND:${requestId}] Email: ${email}`);
    console.log(`[ADMIN-RESEND:${requestId}] UserID: ${userId}`);

    if (!userId || !email || !name) {
      return NextResponse.json({ 
        error: 'Dados incompletos: userId, email e name são obrigatórios.' 
      }, { status: 400 });
    }

    // Buscar usuário
    const [user] = await db.select({ 
      id: users.id, 
      email: users.email, 
      name: users.name 
    }).from(users).where(eq(users.id, userId));

    if (!user) {
      console.log(`[ADMIN-RESEND:${requestId}] ❌ Usuário não encontrado`);
      return NextResponse.json({ 
        error: 'Utilizador não encontrado.' 
      }, { status: 404 });
    }

    console.log(`[ADMIN-RESEND:${requestId}] Usuário encontrado: ${user.email}`);

    // Gerar token
    const verificationToken = randomBytes(20).toString('hex');
    const tokenHash = createHash('sha256').update(verificationToken).digest('hex');
    const baseUrl = getBaseUrl();
    const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}`;

    console.log(`[ADMIN-RESEND:${requestId}] Token: ${verificationToken.slice(0, 8)}...`);

    // Deletar tokens antigos e criar novo
    await db.transaction(async (tx) => {
      await tx.delete(emailVerificationTokens).where(
        eq(emailVerificationTokens.userId, user.id)
      );
      console.log(`[ADMIN-RESEND:${requestId}] Tokens antigos removidos`);

      const [newToken] = await tx.insert(emailVerificationTokens).values({
        userId: user.id,
        tokenHash: tokenHash,
        expiresAt: createExpirationDate(24)
      }).returning({ id: emailVerificationTokens.id });

      console.log(`[ADMIN-RESEND:${requestId}] ✅ Novo token salvo (ID: ${newToken?.id})`);
    });

    // Enviar email
    console.log(`[ADMIN-RESEND:${requestId}] Enviando email para: ${user.email}`);
    try {
      await sendEmailVerificationLink(user.email, user.name, verificationLink);
      console.log(`[ADMIN-RESEND:${requestId}] ✅ EMAIL ENVIADO COM SUCESSO`);
    } catch (emailError) {
      console.error(`[ADMIN-RESEND:${requestId}] ❌ Erro ao enviar email:`, emailError);
      throw emailError;
    }

    console.log(`[ADMIN-RESEND:${requestId}] ===== REENVIO CONCLUÍDO =====\n`);

    return NextResponse.json({
      success: true,
      message: `Email de verificação reenviado com sucesso para ${user.email}.`,
      verificationLink,
      token: verificationToken,
      requestId
    });

  } catch (error) {
    console.error(`[ADMIN-RESEND:${requestId}] ❌ ERRO:`, error);
    return NextResponse.json({ 
      error: 'Erro ao reenviar email de verificação.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
