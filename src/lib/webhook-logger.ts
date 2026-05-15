/**
 * Utilitário para registrar chamadas de webhook na tabela webhook_activity_log.
 * Importar e chamar nos handlers de webhook para tracking de atividade.
 */
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function logWebhookActivity(
  endpoint: string,
  statusCode: number,
  payloadSize: number
) {
  try {
    await supabaseAdmin.from("webhook_activity_log").insert({
      endpoint,
      recebido_em: new Date().toISOString(),
      status_code: statusCode,
      payload_size: payloadSize,
    });
  } catch {
    // Não travar o webhook se o log falhar
  }
}
