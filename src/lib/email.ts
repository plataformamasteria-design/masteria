
// src/lib/email.ts
'use server';

import { 
  sendVerificationEmail, 
  sendPasswordResetEmail as sendPasswordResetEmailViaResend,
  sendWelcomeEmail as sendWelcomeEmailViaResend 
} from '@/utils/email-sender';
import { getBaseUrl } from '@/utils/get-base-url';

const getWelcomeEmailTemplate = (name: string): string => {
    const baseUrl = getBaseUrl();
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
              .container { width: 90%; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #ffffff; }
              .header { font-size: 24px; font-weight: bold; color: #10B981; text-align: center; }
              .content { margin-top: 20px; }
              .step-section { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
              .step { margin-bottom: 20px; }
              .step h3 { margin: 0 0 5px 0; color: #333; }
              .step p { margin: 0 0 10px 0; font-size: 14px; color: #666;}
              .button { display: inline-block; padding: 10px 20px; background-color: #10B981; color: #fff; text-decoration: none; border-radius: 5px; }
              .footer { margin-top: 30px; font-size: 12px; color: #888; text-align: center; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">Bem-vindo(a) ao Master IA!</div>
              <div class="content">
                  <p>Olá ${name},</p>
                  <p>Estamos muito felizes por ter você connosco! A sua conta foi criada com sucesso e você está pronto para transformar a sua comunicação no WhatsApp.</p>
              </div>
              <div class="step-section">
                  <h2 style="text-align: center; color: #333;">Comece a Usar em 3 Passos:</h2>
                  <div class="step">
                      <h3>1. Conecte seu WhatsApp</h3>
                      <p>O primeiro passo é adicionar a sua conexão com a API da Meta para poder enviar e receber mensagens.</p>
                      <a href="${baseUrl}/connections" class="button">Configurar Conexão</a>
                  </div>
                   <div class="step">
                      <h3>2. Importe Seus Contatos</h3>
                      <p>Suba a sua lista de contatos para começar a criar as suas campanhas de marketing ou atendimento.</p>
                      <a href="${baseUrl}/contacts" class="button">Gerenciar Contatos</a>
                  </div>
                   <div class="step">
                      <h3>3. Crie sua Primeira Campanha</h3>
                      <p>Com tudo configurado, crie e agende a sua primeira campanha para engajar os seus clientes.</p>
                      <a href="${baseUrl}/campaigns" class="button">Ir para Campanhas</a>
                  </div>
              </div>
              <div class="footer">
                  <p>Equipe Master IA &copy; ${new Date().getFullYear()}</p>
              </div>
          </div>
      </body>
      </html>
    `;
};

const getPasswordResetTemplate = (name: string, resetLink: string): string => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { width: 90%; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
            .highlight { font-size: 24px; font-weight: bold; color: #10B981; text-align: center; margin: 20px 0; }
            .content { margin-top: 20px; line-height: 1.8; }
            .button { display: inline-block; padding: 12px 30px; margin-top: 20px; background-color: #10B981; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; }
            .link-section { margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
            .footer { margin-top: 30px; font-size: 12px; color: #888; text-align: center; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="highlight">🔐 Redefinição de Senha</div>
            <div class="content">
                <p>Olá <strong>${name}</strong>,</p>
                <p>Recebemos uma solicitação para redefinir a sua senha na plataforma Master IA. Se você não fez esta solicitação, por favor, ignore este e-mail.</p>
                <p>Para criar uma nova senha, clique no botão abaixo. Este link é válido por 15 minutos.</p>
                <p style="text-align: center;">
                    <a href="${resetLink}" class="button">Redefinir Senha</a>
                </p>
                <div class="link-section">
                    <p style="margin-top: 0; margin-bottom: 10px;">Caso deseje ir mais rápido, toque no link a seguir:</p>
                    <p><a href="${resetLink}" style="color: #10B981; text-decoration: underline; word-break: break-all;">${resetLink}</a></p>
                    <p style="margin-top: 10px; font-size: 12px; color: #666;">(Ou pressione/clique no link acima para copiar e colar no seu navegador)</p>
                </div>
            </div>
            <div class="footer">
                <p>Master IA @ 2026</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

const getEmailVerificationTemplate = (name: string, verificationLink: string): string => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { width: 90%; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
              .highlight { font-size: 28px; font-weight: bold; color: #10B981; text-align: center; margin: 20px 0; }
              .content { margin-top: 20px; line-height: 1.8; }
              .button { display: inline-block; padding: 12px 30px; margin-top: 20px; background-color: #10B981; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; }
              .link-section { margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
              .validity { margin-top: 15px; padding: 10px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 3px; font-size: 13px; color: #856404; }
              .footer { margin-top: 30px; font-size: 12px; color: #888; text-align: center; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="highlight">🎉 Parabéns! Bem-vindo(a) à MasterIA!</div>
              <div class="content">
                  <p>Olá <strong>${name}</strong>,</p>
                  <p>Confirme seu acesso no Link a seguir para receber a experiencia completa do HUB MASTER de Agentes de IA para Comunicar, Relacionar de verdade com seus clientes e Multiplicar o Lucro da sua empresa.</p>
                  <p style="text-align: center;">
                      <a href="${verificationLink}" class="button">Verificar E-mail</a>
                  </p>
                  <div class="link-section">
                      <p style="margin-top: 0; margin-bottom: 10px;">Caso deseje ir mais rápido, toque no link a seguir:</p>
                      <p><a href="${verificationLink}" style="color: #10B981; text-decoration: underline; word-break: break-all;">${verificationLink}</a></p>
                      <p style="margin-top: 10px; font-size: 12px; color: #666;">(Ou pressione/clique no link acima para copiar e colar no seu navegador)</p>
                  </div>
                  <div class="validity">
                      <p style="margin: 0; font-weight: bold;">⏰ Atenção:</p>
                      <p style="margin: 5px 0 0 0;">Este link de verificação é válido por <strong>24 horas</strong>. Após esse período, você precisará solicitar um novo link de verificação.</p>
                  </div>
              </div>
              <div class="footer">
                  <p>Master IA @ 2026</p>
              </div>
          </div>
      </body>
      </html>
    `;
};

export const sendWelcomeEmail = async (to: string, name: string): Promise<void> => {
    try {
        const html = getWelcomeEmailTemplate(name);
        const success = await sendWelcomeEmailViaResend(to, name, html);
        
        if (!success) {
            throw new Error('Falha ao enviar email de boas-vindas via Resend');
        }
    } catch (error) {
        console.error(`❌ Erro ao enviar email de boas-vindas:`, error);
        throw error;
    }
};

export const sendPasswordResetEmail = async (to: string, name: string, resetLink: string): Promise<void> => {
    try {
        const html = getPasswordResetTemplate(name, resetLink);
        const success = await sendPasswordResetEmailViaResend(to, name, resetLink, html);
        
        if (!success) {
            throw new Error('Falha ao enviar email de recuperação via Resend');
        }
    } catch (error) {
        console.error(`❌ Erro ao enviar email de recuperação de senha:`, error);
        throw error;
    }
};

export const sendEmailVerificationLink = async (to: string, name: string, verificationLink: string): Promise<void> => {
    try {
        const html = getEmailVerificationTemplate(name, verificationLink);
        const success = await sendVerificationEmail(to, name, verificationLink, html);
        
        if (!success) {
            throw new Error('Falha ao enviar email de verificação via Resend');
        }
    } catch (error) {
        console.error(`❌ Erro ao enviar email de verificação:`, error);
        throw error;
    }
};
