/**
 * Cliente mínimo para Evolution API (WhatsApp).
 * Usado por jobs de alerta para notificar analistas/gestores.
 *
 * Envs obrigatórias (vistas em /config/integracoes):
 *  - EVOLUTION_API_URL
 *  - EVOLUTION_API_KEY
 *  - EVOLUTION_INSTANCE
 */

interface SendResult {
  success: boolean;
  error?: string;
}

function normalizePhone(raw: string): string {
  // Aceita "+55 (11) 98888-7777", "11988887777", "5511988887777", etc.
  // Evolution espera só dígitos, com código do país.
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return "";
  // Se já tem código país (55) na frente, mantém. Senão adiciona.
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return "55" + digits;
}

export async function sendWhatsAppGroup(groupJid: string, message: string): Promise<SendResult> {
  const url = process.env.EVOLUTION_API_URL;
  const key = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;

  if (!url || !key || !instance) {
    return { success: false, error: "EVOLUTION_API_URL/KEY/INSTANCE não configurados" };
  }

  if (!groupJid) return { success: false, error: "Group JID vazio" };

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ number: groupJid, text: message }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { success: false, error: `Evolution API ${res.status}: ${err.slice(0, 200)}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function sendWhatsAppText(phone: string, message: string): Promise<SendResult> {
  const url = process.env.EVOLUTION_API_URL;
  const key = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;

  if (!url || !key || !instance) {
    return { success: false, error: "EVOLUTION_API_URL/KEY/INSTANCE não configurados" };
  }

  const number = normalizePhone(phone);
  if (!number) return { success: false, error: "Telefone inválido" };

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/message/sendText/${instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
      },
      body: JSON.stringify({ number, text: message }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { success: false, error: `Evolution API ${res.status}: ${err.slice(0, 200)}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
