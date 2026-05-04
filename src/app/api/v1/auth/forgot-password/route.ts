import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendPasswordResetEmail } from '@/lib/email';
import { getBaseUrl } from '@/utils/get-base-url';
import crypto from 'crypto';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { 
          success: true, 
          message: 'Se o email estiver cadastrado, você receberá um link de recuperação.' 
        },
        { status: 200 }
      );
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000);

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const resetUrl = `${getBaseUrl()}/reset-password?token=${resetToken}`;

    await sendPasswordResetEmail(email, user.name, resetUrl);

    return NextResponse.json(
      { 
        success: true, 
        message: 'Email de recuperação enviado com sucesso!' 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Erro ao processar recuperação de senha:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao processar solicitação de recuperação de senha',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
