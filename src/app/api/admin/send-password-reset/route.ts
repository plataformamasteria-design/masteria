import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getBaseUrl } from '@/utils/get-base-url';
import { sendPasswordResetEmail } from '@/lib/email';

const generateResetToken = () => {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
};

// DEPRECATED: Replit Mail Service removed.
// async function sendResetEmailViaReplit(...)


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verificar se é uma requisição autorizada (apenas para admin)
    const authHeader = request.headers.get('authorization');
    const adminToken = process.env.ADMIN_RESET_TOKEN;

    if (!authHeader || authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    console.log('🔄 Iniciando reset em massa de senhas...\n');

    const allUsers = await db.select().from(users);
    console.log(`📊 Total de usuários: ${allUsers.length}\n`);

    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    for (const user of allUsers) {
      try {
        const { token, tokenHash } = generateResetToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Inserir token no banco
        await db.insert(passwordResetTokens).values({
          id: uuidv4(),
          userId: user.id,
          tokenHash,
          expiresAt,
          createdAt: new Date(),
        });

        const baseUrl = getBaseUrl();
        const resetLink = `${baseUrl}/reset-password?token=${token}`;

        // Enviar email
        // Enviar email via Resend (Centralizado)
        try {
          await sendPasswordResetEmail(user.email, user.name, resetLink);
          console.log(`✅ ${user.name} (${user.email})`);
          successCount++;
          results.push({
            name: user.name,
            email: user.email,
            status: 'enviado',
          });
        } catch (emailError) {
          console.log(`⚠️  ${user.name} (${user.email}) - Falha no envio:`, emailError);
          errorCount++;
          results.push({
            name: user.name,
            email: user.email,
            status: 'erro',
          });
        }
      } catch (error) {
        console.error(`❌ Erro processando ${user.email}:`, error);
        errorCount++;
        results.push({
          name: user.name,
          email: user.email,
          status: 'erro',
        });
      }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 RESULTADO FINAL:`);
    console.log(`✅ Enviados com sucesso: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📧 Total de usuários: ${allUsers.length}`);
    console.log(`${'═'.repeat(60)}\n`);

    return NextResponse.json({
      success: true,
      message: `Reset de senha enviado para ${successCount} usuários`,
      stats: {
        total: allUsers.length,
        sent: successCount,
        errors: errorCount,
      },
      results,
    });
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    return NextResponse.json(
      { error: 'Erro ao processar reset de senhas em massa' },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  // Endpoint para listar todos os usuários
  try {
    const allUsers = await db.select().from(users);

    return NextResponse.json({
      total: allUsers.length,
      users: allUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao listar usuários' },
      { status: 500 }
    );
  }
}
