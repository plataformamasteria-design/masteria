/**
 * acoes.ts — Lógica de ações (decisões de tráfego) com avaliação automática.
 *
 * Fontes: ads_performance, ads_metadata, leads_crm, contratos.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

// ── Types ──

export type AcaoCategoria = "pausa" | "escala" | "reducao" | "novo_criativo" | "reativacao" | "realocacao" | "ajuste_publico";
export type AcaoStatus = "pending" | "positive" | "neutral" | "negative";
export type EntidadeTipo = "campanha" | "conjunto" | "anuncio";

export interface AcaoLog {
  id: string;
  data_acao: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  categoria: AcaoCategoria;
  descricao: string;
  motivo: string | null;
  entidade_tipo: EntidadeTipo | null;
  entidade_id: string | null;
  entidade_nome: string | null;
  valor_antes: Record<string, any> | null;
  valor_depois: Record<string, any> | null;
  metricas_pre_7d: MetricasPeriodo | null;
  metricas_pos_7d: MetricasPeriodo | null;
  status_avaliacao: AcaoStatus;
  avaliacao_motivo: string | null;
  account_id: string | null;
  origem: "manual" | "cron_deteccao" | "cron_bootstrap";
  created_at: string;
}

export interface MetricasPeriodo {
  cpl: number;
  leads: number;
  investimento: number;
  taxa_qual?: number;
}

export const CATEGORIA_CONFIG: Record<AcaoCategoria, { emoji: string; label: string; cor: string }> = {
  pausa: { emoji: "✂️", label: "Pausa", cor: "text-red-400" },
  escala: { emoji: "📈", label: "Escala", cor: "text-emerald-400" },
  reducao: { emoji: "📉", label: "Redução", cor: "text-yellow-400" },
  novo_criativo: { emoji: "✏️", label: "Novo criativo", cor: "text-blue-400" },
  reativacao: { emoji: "▶️", label: "Reativação", cor: "text-violet-400" },
  realocacao: { emoji: "🔄", label: "Realocação", cor: "text-amber-400" },
  ajuste_publico: { emoji: "🎯", label: "Ajuste de público", cor: "text-cyan-400" },
};

export const STATUS_CONFIG: Record<AcaoStatus, { emoji: string; label: string; cor: string; bg: string }> = {
  pending: { emoji: "⏳", label: "Em avaliação", cor: "text-muted-foreground", bg: "bg-muted" },
  positive: { emoji: "🟢", label: "Boa decisão", cor: "text-emerald-400", bg: "bg-emerald-500/10" },
  neutral: { emoji: "🟡", label: "Neutra", cor: "text-yellow-400", bg: "bg-yellow-500/10" },
  negative: { emoji: "🔴", label: "Reverter", cor: "text-red-400", bg: "bg-red-500/10" },
};

// ── Metric calculation ──

export async function calcMetricas7d(
  entidadeTipo: string,
  entidadeId: string,
  dataInicio: string,
  dataFim: string,
): Promise<MetricasPeriodo> {
  // Determine which column to filter by
  let adIds: string[] = [];

  if (entidadeTipo === "anuncio") {
    adIds = [entidadeId];
  } else if (entidadeTipo === "conjunto") {
    const { data } = await supabase
      .from("ads_metadata")
      .select("ad_id")
      .eq("adset_id", entidadeId);
    adIds = (data || []).map((r: any) => r.ad_id);
  } else if (entidadeTipo === "campanha") {
    const { data } = await supabase
      .from("ads_metadata")
      .select("ad_id")
      .eq("campaign_id", entidadeId);
    adIds = (data || []).map((r: any) => r.ad_id);
  }

  if (adIds.length === 0) {
    return { cpl: 0, leads: 0, investimento: 0 };
  }

  const { data } = await supabase
    .from("ads_performance")
    .select("spend, leads")
    .in("ad_id", adIds)
    .gte("data_ref", dataInicio)
    .lte("data_ref", dataFim);

  const rows = data || [];
  const investimento = rows.reduce((s: number, r: any) => s + Number(r.spend || 0), 0);
  const leads = rows.reduce((s: number, r: any) => s + Number(r.leads || 0), 0);
  const cpl = leads > 0 ? investimento / leads : 0;

  return { cpl: Math.round(cpl * 100) / 100, leads, investimento: Math.round(investimento * 100) / 100 };
}

// ── Evaluation logic ──

export function avaliarAcao(
  categoria: AcaoCategoria,
  pre: MetricasPeriodo,
  pos: MetricasPeriodo,
): { status: AcaoStatus; motivo: string } {
  const cplVariacao = pre.cpl > 0 ? ((pos.cpl - pre.cpl) / pre.cpl) * 100 : 0;
  const leadsVariacao = pre.leads > 0 ? ((pos.leads - pre.leads) / pre.leads) * 100 : 0;

  switch (categoria) {
    case "pausa":
      if (cplVariacao <= -5) return { status: "positive", motivo: `CPL geral caiu ${Math.abs(cplVariacao).toFixed(0)}% após pausar este anúncio` };
      if (cplVariacao > 5) return { status: "negative", motivo: `CPL subiu ${cplVariacao.toFixed(0)}% mesmo após pausar — anúncio podia estar contribuindo` };
      return { status: "neutral", motivo: "CPL manteve-se estável após a pausa" };

    case "escala":
      if (leadsVariacao > 20 && cplVariacao < 20) return { status: "positive", motivo: `Leads subiram ${leadsVariacao.toFixed(0)}% sem inflar CPL além do esperado` };
      if (cplVariacao > 30) return { status: "negative", motivo: `CPL subiu ${cplVariacao.toFixed(0)}% após o aumento — escala não compensou` };
      return { status: "neutral", motivo: "Resultados dentro do esperado após escala" };

    case "novo_criativo":
      if (pos.leads > 0 && pos.cpl < pre.cpl) return { status: "positive", motivo: `Criativo com CPL R$${pos.cpl.toFixed(2)} — melhor que média anterior` };
      if (pos.leads === 0) return { status: "negative", motivo: "Criativo não gerou leads nos primeiros 7 dias" };
      return { status: "neutral", motivo: "Criativo performando na média" };

    case "reducao":
      if (cplVariacao < 0) return { status: "positive", motivo: "Redução de budget melhorou eficiência geral" };
      return { status: "neutral", motivo: "Eficiência mantida após redução" };

    case "reativacao":
      if (pos.leads > 0 && pos.cpl <= pre.cpl * 1.2) return { status: "positive", motivo: `Reativação gerou ${pos.leads} leads com CPL aceitável` };
      if (pos.leads === 0) return { status: "negative", motivo: "Reativação não gerou resultados" };
      return { status: "neutral", motivo: "Resultados da reativação dentro do esperado" };

    case "realocacao":
    case "ajuste_publico":
      if (cplVariacao < -10) return { status: "positive", motivo: `CPL caiu ${Math.abs(cplVariacao).toFixed(0)}% após o ajuste` };
      if (cplVariacao > 10) return { status: "negative", motivo: `CPL subiu ${cplVariacao.toFixed(0)}% após o ajuste` };
      return { status: "neutral", motivo: "Impacto neutro do ajuste" };
  }
}

// ── Detect changes between days ──

export interface DetectedChange {
  categoria: AcaoCategoria;
  entidade_tipo: EntidadeTipo;
  entidade_id: string;
  entidade_nome: string;
  descricao: string;
  valor_antes: Record<string, any> | null;
  valor_depois: Record<string, any>;
  data_acao: string;
}

export async function detectChanges(dateStr: string): Promise<DetectedChange[]> {
  const prevDate = new Date(dateStr + "T12:00:00");
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().slice(0, 10);

  // Get performance snapshots for both days
  const [{ data: today }, { data: yesterday }] = await Promise.all([
    supabase
      .from("ads_performance")
      .select("ad_id, spend, leads, impressoes")
      .eq("data_ref", dateStr),
    supabase
      .from("ads_performance")
      .select("ad_id, spend, leads, impressoes")
      .eq("data_ref", prevDateStr),
  ]);

  // Get metadata for names and status
  const allAdIds = new Set([
    ...(today || []).map((r: any) => r.ad_id),
    ...(yesterday || []).map((r: any) => r.ad_id),
  ]);

  if (allAdIds.size === 0) return [];

  const { data: metadata } = await supabase
    .from("ads_metadata")
    .select("ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name, status")
    .in("ad_id", Array.from(allAdIds));

  const metaMap = new Map((metadata || []).map((m: any) => [m.ad_id, m]));
  const todaySet = new Set((today || []).map((r: any) => r.ad_id));
  const yesterdaySet = new Set((yesterday || []).map((r: any) => r.ad_id));

  const changes: DetectedChange[] = [];

  // New ads (appeared today, not yesterday)
  for (const adId of todaySet) {
    if (!yesterdaySet.has(adId)) {
      const meta = metaMap.get(adId);
      if (!meta) continue;
      changes.push({
        categoria: "novo_criativo",
        entidade_tipo: "anuncio",
        entidade_id: adId,
        entidade_nome: meta.ad_name || adId,
        descricao: `Novo anúncio "${meta.ad_name || adId}" detectado`,
        valor_antes: null,
        valor_depois: { name: meta.ad_name, status: meta.status },
        data_acao: dateStr,
      });
    }
  }

  return changes;
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
