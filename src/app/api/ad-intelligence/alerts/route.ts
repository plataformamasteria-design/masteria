/**
 * GET  /api/ad-intelligence/alerts — Gera alertas em tempo real a partir da Meta API
 * POST /api/ad-intelligence/alerts — Persistir estado (resolve/dismiss) em memória de sessão
 *
 * Como as tabelas ai_* podem não existir, esta versão gera alertas
 * dinamicamente analisando os insights da Meta API em tempo real.
 * Alertas descartados/resolvidos nesta sessão são mantidos em cache in-memory.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
const BASE  = "https://graph.facebook.com/v21.0";

// Cache em memória de alertas resolvidos/descartados (reseta com restart do servidor)
// Formato: Set<"account_id::alert_key">
const dismissedAlerts = new Set<string>();

async function metaFetch(url: string): Promise<unknown> {
  const res = await fetch(url);
  return res.json();
}

function extractLeads(actions: Array<{ action_type: string; value: string }>): number {
  return (actions || [])
    .filter(a => a.action_type === "lead" || a.action_type === "offsite_conversion.fb_pixel_lead")
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0);
}

interface GeneratedAlert {
  id: string;
  account_id: string;
  alert_type: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  reason: string;
  entity_level: string;
  entity_name: string;
  entity_id: string;
  metric_value: number | null;
  metric_baseline: number | null;
  delta_pct: number | null;
  status: "active";
  created_at: string;
}

function generateAlertsForEntity(
  entityId: string,
  entityName: string,
  entityLevel: string,
  accountId: string,
  spend: number,
  leads: number,
  ctr: number,
  frequency: number,
  cpl: number | null
): GeneratedAlert[] {
  const alerts: GeneratedAlert[] = [];
  const now = new Date().toISOString();

  // CPL alto (> R$80)
  if (cpl !== null && cpl > 80 && leads >= 2) {
    const key = `${accountId}::cpl_high::${entityId}`;
    if (!dismissedAlerts.has(key)) {
      alerts.push({
        id: key,
        account_id: accountId,
        alert_type: "cpl_high",
        severity: cpl > 150 ? "critical" : "high",
        title: "CPL Elevado",
        reason: `CPL de R$${cpl.toFixed(2)} está acima do limite de R$80,00`,
        entity_level: entityLevel,
        entity_name: entityName,
        entity_id: entityId,
        metric_value: cpl,
        metric_baseline: 80,
        delta_pct: ((cpl - 80) / 80) * 100,
        status: "active",
        created_at: now,
      });
    }
  }

  // CTR baixo (< 0.8%)
  if (ctr < 0.8 && spend > 50) {
    const key = `${accountId}::low_ctr::${entityId}`;
    if (!dismissedAlerts.has(key)) {
      alerts.push({
        id: key,
        account_id: accountId,
        alert_type: "low_ctr",
        severity: ctr < 0.4 ? "high" : "medium",
        title: "CTR Abaixo do Esperado",
        reason: `CTR de ${ctr.toFixed(2)}% está abaixo do mínimo saudável (~1%)`,
        entity_level: entityLevel,
        entity_name: entityName,
        entity_id: entityId,
        metric_value: ctr,
        metric_baseline: 1.0,
        delta_pct: ((ctr - 1.0) / 1.0) * 100,
        status: "active",
        created_at: now,
      });
    }
  }

  // Frequência alta (> 3.5)
  if (frequency > 3.5 && spend > 100) {
    const key = `${accountId}::high_frequency::${entityId}`;
    if (!dismissedAlerts.has(key)) {
      alerts.push({
        id: key,
        account_id: accountId,
        alert_type: "high_frequency",
        severity: frequency > 5 ? "high" : "medium",
        title: "Frequência Alta — Fadiga de Criativo",
        reason: `Frequência de ${frequency.toFixed(1)}x pode estar causando fadiga de audiência`,
        entity_level: entityLevel,
        entity_name: entityName,
        entity_id: entityId,
        metric_value: frequency,
        metric_baseline: 3.5,
        delta_pct: ((frequency - 3.5) / 3.5) * 100,
        status: "active",
        created_at: now,
      });
    }
  }

  // Gasto alto sem leads
  if (spend > 200 && leads === 0) {
    const key = `${accountId}::zero_leads::${entityId}`;
    if (!dismissedAlerts.has(key)) {
      alerts.push({
        id: key,
        account_id: accountId,
        alert_type: "zero_leads",
        severity: spend > 500 ? "critical" : "high",
        title: "Gasto Sem Conversão",
        reason: `R$${spend.toFixed(0)} investidos sem nenhum lead gerado no período`,
        entity_level: entityLevel,
        entity_name: entityName,
        entity_id: entityId,
        metric_value: spend,
        metric_baseline: 0,
        delta_pct: null,
        status: "active",
        created_at: now,
      });
    }
  }

  return alerts;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const token = TOKEN();
  if (!token) return NextResponse.json({ error: "META_ADS_ACCESS_TOKEN não configurado" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const account_id_raw = searchParams.get("account_id") || "";
  const severity       = searchParams.get("severity");
  const limit          = parseInt(searchParams.get("limit") || "50");
  const since          = searchParams.get("since") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const until          = searchParams.get("until") || new Date().toISOString().slice(0, 10);

  if (!account_id_raw) return NextResponse.json({ data: [], totals: {}, count: 0 });

  const accountId = account_id_raw.startsWith("act_") ? account_id_raw : `act_${account_id_raw}`;
  const timeRange = JSON.stringify({ since, until });

  try {
    // Buscar insights de campanhas + adsets em paralelo
    const fields = "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,ctr,frequency,actions";
    const [campRes, adsetRes] = await Promise.all([
      metaFetch(`${BASE}/${accountId}/insights?level=campaign&fields=campaign_id,campaign_name,spend,impressions,ctr,frequency,actions&time_range=${encodeURIComponent(timeRange)}&limit=25&access_token=${token}`),
      metaFetch(`${BASE}/${accountId}/insights?level=adset&fields=adset_id,adset_name,campaign_id,spend,impressions,ctr,frequency,actions&time_range=${encodeURIComponent(timeRange)}&limit=25&access_token=${token}`),
    ]) as [{ data?: unknown[] }, { data?: unknown[] }];

    const allAlerts: GeneratedAlert[] = [];

    // Alertas de campanhas
    for (const row of ((campRes.data || []) as Record<string, unknown>[])) {
      const spend     = parseFloat((row.spend as string) || "0");
      const ctr       = parseFloat((row.ctr as string) || "0");
      const frequency = parseFloat((row.frequency as string) || "0");
      const leads     = extractLeads((row.actions as Array<{ action_type: string; value: string }>) || []);
      const cpl       = leads > 0 ? spend / leads : null;
      const alerts    = generateAlertsForEntity(
        row.campaign_id as string,
        row.campaign_name as string,
        "campaign",
        accountId, spend, leads, ctr, frequency, cpl
      );
      allAlerts.push(...alerts);
    }

    // Alertas de adsets
    for (const row of ((adsetRes.data || []) as Record<string, unknown>[])) {
      const spend     = parseFloat((row.spend as string) || "0");
      const ctr       = parseFloat((row.ctr as string) || "0");
      const frequency = parseFloat((row.frequency as string) || "0");
      const leads     = extractLeads((row.actions as Array<{ action_type: string; value: string }>) || []);
      const cpl       = leads > 0 ? spend / leads : null;
      const alerts    = generateAlertsForEntity(
        row.adset_id as string,
        row.adset_name as string,
        "adset",
        accountId, spend, leads, ctr, frequency, cpl
      );
      allAlerts.push(...alerts);
    }

    // Filtrar e limitar
    let filtered = allAlerts;
    if (severity) filtered = filtered.filter(a => a.severity === severity);

    // Ordenar por severidade
    const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
    filtered.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    filtered = filtered.slice(0, limit);

    // Totais por severidade
    const totals = allAlerts.reduce((acc, a) => {
      acc[a.severity] = (acc[a.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      data: filtered,
      totals,
      count: filtered.length,
      total_generated: allAlerts.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ad-intelligence/alerts]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as { id: string; action: "resolve" | "dismiss" };
  const { id, action } = body;

  if (!id || !["resolve", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "id e action (resolve|dismiss) são obrigatórios" }, { status: 400 });
  }

  // Persiste no Set em memória — o alerta não será mais gerado nesta sessão
  dismissedAlerts.add(id);

  return NextResponse.json({ data: { id, status: action === "resolve" ? "resolved" : "dismissed" } });
}
