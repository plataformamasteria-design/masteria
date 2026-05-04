import { db } from '@/lib/db';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { createHash } from 'crypto';
import { randomBytes } from 'crypto';

const generateResetToken = () => {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
};

async function sendResetEmailViaReplit(
  email: string,
  name: string,
  resetLink: string
): Promise<boolean> {
  try {
    const response = await fetch('https://api.replit.com/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REPLIT_MAIL_TOKEN || ''}`,
      },
      body: JSON.stringify({
        to: email,
        subject: 'Reset de Senha - Master IA Oficial',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
              <h2 style="color: #333;">Olá ${name},</h2>
              
              <p style="color: #666; line-height: 1.6;">
                Recebemos uma solicitação para resetar sua senha no <strong>Master IA Oficial</strong>.
              </p>
              
              <p style="color: #666; line-height: 1.6;">
                Para redefinir sua senha, clique no botão abaixo:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" 
                   style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 4px; display: inline-block;
                          font-weight: bold;">
                  Redefinir Senha
                </a>
              </div>
              
              <p style="color: #999; font-size: 12px; line-height: 1.6;">
                Se o botão não funcionar, copie e cole este link no seu navegador:<br>
                <code style="background-color: #f0f0f0; padding: 5px 10px; border-radius: 3px;">
                  ${resetLink}
                </code>
              </p>
              
              <p style="color: #999; font-size: 12px; line-height: 1.6;">
                ⏰ <strong>Este link expira em 24 horas.</strong>
              </p>
              
              <p style="color: #999; font-size: 12px; line-height: 1.6;">
                Se você não solicitou este reset, ignore este email.
              </p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              
              <p style="color: #999; font-size: 11px;">
                Equipe Master IA Oficial<br>
                Sistema de Suporte ao Usuário
              </p>
            </div>
          </div>
        `,
        from: 'noreply@masteriaoficial.com',
      }),
    });

    return response.ok;
  } catch (error) {
    console.error(`Erro ao enviar para ${email}:`, error);
    return false;
  }
}

async function main() {
  console.log('🔄 Iniciando reset em massa de senhas...\n');
  
  try {
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
          id: crypto.randomUUID(),
          userId: user.id,
          tokenHash,
          expiresAt,
          createdAt: new Date(),
        });

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:8080';
        const resetLink = `${baseUrl}/reset-password?token=${token}`;

        // Enviar email
        const emailSent = await sendResetEmailViaReplit(
          user.email,
          user.name,
          resetLink
        );

        if (emailSent) {
          console.log(`✅ ${user.name} (${user.email})`);
          successCount++;
          results.push({
            name: user.name,
            email: user.email,
            status: 'enviado',
          });
        } else {
          console.log(`⚠️  ${user.name} (${user.email}) - Falha no envio`);
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
      }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 RESULTADO FINAL:`);
    console.log(`✅ Enviados com sucesso: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📧 Total de usuários: ${allUsers.length}`);
    console.log(`${'═'.repeat(60)}\n`);

    return results;
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

// Executar
main().then(() => {
  console.log('✨ Processo finalizado!');
  process.exit(0);
});
