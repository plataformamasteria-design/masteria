/**
 * 🔥 Corrigir e padronizar geração de JID (CRÍTICO)
 */
export function formatJid(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 10) {
    throw new Error('Número inválido para WhatsApp: muito curto');
  }

  // Se já tiver @, não mexe
  if (phone.includes('@')) return phone;

  return `${digits}@s.whatsapp.net`;
}
