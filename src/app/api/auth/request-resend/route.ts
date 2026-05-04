// src/app/api/auth/request-resend/route.ts
// Endpoint público para reenviar email de verificação (rate limited)
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users, emailVerificationTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes, createHash, randomUUID } from 'crypto';
import { sendEmailVerificationLink } from '@/lib/email';
import { getBaseUrl } from '@/utils/get-base-url';
import { z } from 'zod';

const requestResendSchema = z.object({
  email: z.string().email('Email inválido.'),
});

const createExpirationDate = (hours: number): Date => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
};

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = randomUUID().slice(0, 8);
  console.log(`[REQUEST_RESEND:${requestId}] Iniciando reenvio de verificação...`);

  try {
    const body = await request.json();
    const parsed = requestResendSchema.safeParse(body);

    if (!parsed.success) {
      console.log(`[REQUEST_RESEND:${requestId}] Validação falhou:`, parsed.error.flatten());
      return NextResponse.json(
        { error: 'Email inválido.' },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    console.log(`[REQUEST_RESEND:${requestId}] Processando para email: ${email}`);

    // 1. Encontrar usuário
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      console.log(`[REQUEST_RESEND:${requestId}] Usuário não encontrado`);
      return NextResponse.json(
        { error: 'Utilizador não encontrado.' },
        { status: 404 }
      );
    }

    // 2. Verificar se já está verificado
    if (user.emailVerified) {
      console.log(`[REQUEST_RESEND:${requestId}] Email já está verificado`);
      return NextResponse.json(
        { error: 'Este email já está verificado.' },
        { status: 400 }
      );
    }

    // 3. Verificar rate limit (5 min entre tentativas, max 5/dia)
    const [lastToken] = await db
      .select({
        lastResendAt: emailVerificationTokens.lastResendAt,
        createdAt: emailVerificationTokens.id, // usar id como createdAt aproximado
      })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id))
      .orderBy((t) => t.lastResendAt || new Date(0));

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    if (lastToken?.lastResendAt && lastToken.lastResendAt > fiveMinutesAgo) {
      console.log(`[REQUEST_RESEND:${requestId}] Rate limit: reenvio muito frequente`);
      return NextResponse.json(
        { error: 'Aguarde 5 minutos antes de solicitar um novo link.' },
        { status: 429 }
      );
    }

    // Contar reenvios nas últimas 24h
    const resendsToday = await db
      .select({ count: emailVerificationTokens.id })
      .from(emailVerificationTokens)
      .where(
        eq(emailVerificationTokens.userId, user.id)
      );

    if (resendsToday.length >= 5) {
      console.log(`[REQUEST_RESEND:${requestId}] Limite de 5 reenvios por dia atingido`);
      return NextResponse.json(
        { error: 'Limite de reenvios diários atingido. Tente novamente amanhã.' },
        { status: 429 }
      );
    }

    // 4. Gerar novo token
    const verificationToken = randomBytes(20).toString('hex');
    const tokenHash = createHash('sha256').update(verificationToken).digest('hex');
    const baseUrl = getBaseUrl();
    const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}`;

    console.log(`[REQUEST_RESEND:${requestId}] Novo token gerado`);

    // 5. Atualizar ou criar token com lastResendAt
    await db.transaction(async (tx) => {
      // Remover tokens antigos
      await tx
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, user.id));

      // Inserir novo token com lastResendAt
      await tx.insert(emailVerificationTokens).values({
        userId: user.id,
        tokenHash: tokenHash,
        expiresAt: createExpirationDate(24),
        lastResendAt: now, // Registrar quando foi reenviado
      });

      console.log(`[REQUEST_RESEND:${requestId}] Novo token salvo com lastResendAt`);
    });

    // 6. Enviar email
    try {
      await sendEmailVerificationLink(user.email, user.name, verificationLink);
      console.log(`[REQUEST_RESEND:${requestId}] ✅ Email reenviado com sucesso`);
    } catch (emailError) {
      console.error(`[REQUEST_RESEND:${requestId}] ❌ Erro ao enviar email:`, emailError);
      throw emailError;
    }

    return NextResponse.json({
      success: true,
      message: 'Um novo link de verificação foi enviado para seu email.',
      requestId,
    });
  } catch (error) {
    console.error(`[REQUEST_RESEND:${requestId}] Erro:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
