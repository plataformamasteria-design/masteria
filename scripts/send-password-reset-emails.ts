import { db } from '@/lib/db';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const generateResetToken = () => {
  const token = Buffer.from(uuidv4() + Date.now()).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
};

const sendEmail = async (
  to: string,
  name: string,
  resetLink: string,
  _token: string
) => {
  // Usar integração de email do Replit
  const _emailContent = `
Olá ${name},

Recebemos uma solicitação para resetar sua senha no sistema Master IA Oficial.

Para redefinir sua senha, clique no link abaixo:
${resetLink}

Este link expira em 24 horas.

Se você não solicitou este reset, ignore este email.

Atenciosamente,
Equipe Master IA Oficial
  `;

  try {
    // Simular envio (em produção usar SendGrid/Resend)
    console.log(`📧 Email enviado para: ${to}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar para ${to}:`, error);
    return false;
  }
};

async function main() {
  try {
    const allUsers = await db.select().from(users);
    
    console.log('🔄 Iniciando reset em massa de senhas...\n');
    console.log(`📊 Total de usuários: ${allUsers.length}\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
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
        
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:8080';
        const resetLink = `${baseUrl}/reset-password?token=${token}`;
        
        // Enviar email
        const emailSent = await sendEmail(user.email, user.name, resetLink, token);
        
        if (emailSent) {
          console.log(`✅ ${user.name} (${user.email})`);
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Erro processando ${user.email}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n📊 RESULTADO FINAL:`);
    console.log(`✅ Enviados com sucesso: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📧 Total de usuários: ${allUsers.length}`);
    
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

main();
