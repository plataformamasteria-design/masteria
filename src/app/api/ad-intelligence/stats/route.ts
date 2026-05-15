/**
 * GET /api/ad-intelligence/stats
 * Retorna estatísticas de saúde do cluster via Meta API (sem dependência das tabelas ai_*)
 * Agrega dados de todas as contas conectadas no Supabase
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
const BASE  = "https://graph.facebook.com/v21.0";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

async function metaFetch(url: string): Promise<unknown> {
  const res = await fetch(url);
  return res.json();
}

function extractLeads(actions: Array<{ action_type: string; value: string }>): number {
  return (actions || [])
    .filter(a => a.action_type === "lead" || a.action_type === "offsite_conversion.fb_pixel_lead")
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const token = TOKEN();

  try {
    // 1. Buscar todas as contas ativas no Supabase
    const { data: clients } = await supabase
      .from("trafego_clients")
      .select("id, client_name, meta_account_id")
      .not("meta_account_id", "is", null)
      .eq("status", "active");

    const contas_total = (clients || []).length;

    // 2. Se não há token Meta, retornar só contagem de contas
    if (!token || contas_total === 0) {
      return NextResponse.json({
        total_alerts: 0,
        critical: 0, high: 0, medium: 0, low: 0,
        accounts_with_alerts: 0,
        contas_total,
        contas_em_risco: 0,
        contas_estaveis: contas_total,
        contas_escala: 0,
        last_sync_at: null,
      });
    }

    // 3. Para cada conta, verificar saúde via Meta API (em paralelo, max 5)
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    const timeRange = JSON.stringify({ since, until });

    const CPL_THRESHOLD = 80; // R$80 — limite para considerar conta em risco
    const FREQ_THRESHOLD = 3.5;

    // Processar em lotes de 5 para não sobrecarregar a Meta API
    const BATCH_SIZE = 5;
    let contas_em_risco = 0;
    let total_alerts = 0;
    let critical = 0, high = 0, medium = 0, low = 0;

    for (let i = 0; i < (clients || []).length; i += BATCH_SIZE) {
      const batch = (clients || []).slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (client) => {
        const accountId = client.meta_account_id.startsWith("act_")
          ? client.meta_account_id
          : `act_${client.meta_account_id}`;
        try {
          const res = await metaFetch(
            `${BASE}/${accountId}/insights?level=account&fields=spend,impressions,ctr,frequency,actions&time_range=${encodeURIComponent(timeRange)}&access_token=${token}`
          ) as { data?: Array<Record<string, unknown>> };

          const row = res.data?.[0];
          if (!row) return;

          const spend     = parseFloat((row.spend as string) || "0");
          const ctr       = parseFloat((row.ctr as string) || "0");
          const frequency = parseFloat((row.frequency as string) || "0");
          const leads     = extractLeads((row.actions as Array<{ action_type: string; value: string }>) || []);
          const cpl       = leads > 0 ? spend / leads : null;

          // Verificar se a conta está em risco
          let accountAtRisk = false;

          if (cpl !== null && cpl > CPL_THRESHOLD && leads >= 2) {
            const severity = cpl > 150 ? "critical" : "high";
            if (severity === "critical") critical++; else high++;
            total_alerts++;
            accountAtRisk = true;
          }
          if (ctr < 0.8 && spend > 50) {
            const severity = ctr < 0.4 ? "high" : "medium";
            if (severity === "high") high++; else medium++;
            total_alerts++;
            accountAtRisk = true;
          }
          if (frequency > FREQ_THRESHOLD && spend > 100) {
            medium++;
            total_alerts++;
            accountAtRisk = true;
          }
          if (spend > 200 && leads === 0) {
            const severity = spend > 500 ? "critical" : "high";
            if (severity === "critical") critical++; else high++;
            total_alerts++;
            accountAtRisk = true;
          }

          if (accountAtRisk) contas_em_risco++;
        } catch {
          // Ignorar erros individuais de conta
        }
      }));
    }

    const contas_estaveis = contas_total - contas_em_risco;
    const contas_escala   = Math.max(0, contas_estaveis - Math.floor(contas_total * 0.2));

    return NextResponse.json({
      total_alerts,
      critical, high, medium, low,
      accounts_with_alerts: contas_em_risco,
      contas_total,
      contas_em_risco,
      contas_estaveis: Math.max(0, contas_estaveis),
      contas_escala,
      last_sync_at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ad-intelligence/stats]", msg);
    // Retornar dados vazios sem erro 500 para não quebrar o HUD
    return NextResponse.json({
      total_alerts: 0,
      critical: 0, high: 0, medium: 0, low: 0,
      accounts_with_alerts: 0,
      contas_total: 0,
      contas_em_risco: 0,
      contas_estaveis: 0,
      contas_escala: 0,
      last_sync_at: null,
    });
  }
}
