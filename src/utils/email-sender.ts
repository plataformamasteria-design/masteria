// src/utils/email-sender.ts
// Envia email de verificação DIRETAMENTE para o usuário usando Resend
// Suporta: domínios verificados ou fallback para email de teste

import { Resend } from 'resend';

const TEST_EMAIL = 'diegoabneroficial@gmail.com'; // Email verificado no Resend para testes

// Lazy initialization to prevent build-time errors
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendVerificationEmail(
  userEmail: string,
  userName: string,
  verificationLink: string,
  htmlTemplate: string
): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY não configurado');
      return false;
    }

    const resend = getResendClient();
    if (!resend) {
      console.warn('⚠️ Resend client not available');
      return false;
    }

    // Domínio masteria.app está verificado - usar em produção
    // Em desenvolvimento: usar email de teste para evitar spam
    const toEmail = userEmail;
    const fromEmail = 'noreply@masteria.app';

    const result = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Verifique seu acesso Master IA',
      html: htmlTemplate,
      text: `Olá ${userName}, clique no link para verificar seu email: ${verificationLink}`,
    });

    if (result.error) {
      console.error('❌ Erro ao enviar email via Resend:', result.error);
      return false;
    }

    console.log(`✅ Email de verificação enviado com sucesso para: ${toEmail}`);
    console.log(`📧 Message ID: ${result.data?.id}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar email via Resend:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  userEmail: string,
  userName: string,
  resetLink: string,
  htmlTemplate: string
): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY não configurado');
      return false;
    }

    const resend = getResendClient();
    if (!resend) {
      console.warn('⚠️ Resend client not available');
      return false;
    }

    const toEmail = userEmail;
    const fromEmail = 'noreply@masteria.app';

    const result = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Recupere sua senha do Master IA',
      html: htmlTemplate,
      text: `Olá ${userName}, clique no link para redefinir sua senha: ${resetLink}`,
    });

    if (result.error) {
      console.error('❌ Erro ao enviar email via Resend:', result.error);
      return false;
    }

    console.log(`✅ Email de recuperação enviado com sucesso para: ${toEmail}`);
    console.log(`📧 Message ID: ${result.data?.id}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar email via Resend:', error);
    return false;
  }
}

export async function sendWelcomeEmail(
  userEmail: string,
  userName: string,
  htmlTemplate: string
): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY não configurado');
      return false;
    }

    const resend = getResendClient();
    if (!resend) {
      console.warn('⚠️ Resend client not available');
      return false;
    }

    const toEmail = userEmail;
    const fromEmail = 'noreply@masteria.app';

    const result = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Bem-vindo(a) ao Master IA, ${userName}!`,
      html: htmlTemplate,
      text: `Bem-vindo ao Master IA, ${userName}! Sua conta foi criada com sucesso.`,
    });

    if (result.error) {
      console.error('❌ Erro ao enviar email via Resend:', result.error);
      return false;
    }

    console.log(`✅ Email de boas-vindas enviado com sucesso para: ${toEmail}`);
    console.log(`📧 Message ID: ${result.data?.id}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar email via Resend:', error);
    return false;
  }
}
