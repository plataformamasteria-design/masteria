/**
 * Chat Classifier — determines message type from JID.
 * Ported from old-session-manager.ts classifyChat().
 */

export interface ChatClassification {
  type: 'individual' | 'group' | 'broadcast' | 'newsletter' | 'community' | 'status' | 'unknown';
  reason: string;
  shouldBlockAI: boolean;
}

export function classifyChat(remoteJid: string, msg?: any): ChatClassification {
  if (!remoteJid) {
    return { type: 'unknown', reason: 'No remoteJid provided', shouldBlockAI: true };
  }

  const jid = remoteJid.toLowerCase();

  if (jid.includes('@g.us'))
    return { type: 'group', reason: 'JID suffix @g.us', shouldBlockAI: true };
  if (jid.includes('@newsletter'))
    return { type: 'newsletter', reason: 'JID suffix @newsletter', shouldBlockAI: true };
  if (jid.includes('@broadcast'))
    return { type: 'broadcast', reason: 'JID suffix @broadcast', shouldBlockAI: true };
  if (jid.includes('@status'))
    return { type: 'status', reason: 'JID suffix @status', shouldBlockAI: true };
  if (jid.includes('@community'))
    return { type: 'community', reason: 'JID suffix @community', shouldBlockAI: true };

  if (msg?.key?.participant || msg?.participant)
    return { type: 'group', reason: 'Has participant field', shouldBlockAI: true };

  const phoneNumber = remoteJid.split('@')[0] || '';
  const digitsOnly = phoneNumber.replace(/\D/g, '');

  if (digitsOnly.length > 15)
    return { type: 'unknown', reason: `Number too long (${digitsOnly.length} digits)`, shouldBlockAI: true };

  if (jid.includes('@s.whatsapp.net') && digitsOnly.length >= 10 && digitsOnly.length <= 15)
    return { type: 'individual', reason: 'Valid individual chat', shouldBlockAI: false };

  if (digitsOnly.length >= 10 && digitsOnly.length <= 15)
    return { type: 'individual', reason: `Valid phone number (${digitsOnly.length} digits)`, shouldBlockAI: false };

  return { type: 'unknown', reason: 'Could not classify', shouldBlockAI: true };
}
