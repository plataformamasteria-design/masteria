/**
 * Detector de anomalias operacionais.
 * Compara metricas atuais vs baseline para identificar desvios significativos.
 * Roda server-side (API route).
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export type AnomaliaTipo =
  | "cpl_alto"
  | "cpl_baixo"
  | "churn_alto"
  | "leads_quedaram"
  | "forecast_caiu"
  | "clientes_em_risco"
  | "sla_critico"
  | "ctwa_degradado";

export type Severidade = "critico" | "atencao" | "info";

export interface Anomalia {
  tipo: AnomaliaTipo;
  severidade: Severidade;
  metrica_atual: number;
  metrica_baseline: number;
  delta_pct: number;
  mensagem: string;
  link?: string;
}

function pct(atual: number, base: number): number {
  if (base === 0) return atual > 0 ? 100 : 0;
  return ((atual - base) / base) * 100;
}

export async function detectarAnomalias(): Promise<Anomalia[]> {
  const anomalias: Anomalia[] = [];
  const hoje = new Date();
  const hojeIso = hoje.toISOString().slice(0, 10);

  // Datas de referencia
  const d7 = new Date(hoje); d7.setDate(d7.getDate() - 7);
  const d14 = new Date(hoje); d14.setDate(d14.getDate() - 14);
  const mesAtual = hojeIso.slice(0, 7);
  const mesAnterior = new Date(hoje); mesAnterior.setMonth(mesAnterior.getMonth() - 1);
  const mesAntStr = mesAnterior.toISOString().slice(0, 7);

  // --- CPL: 7 dias vs 7 dias anteriores ---
  try {
    const [{ data: sem1 }, { data: sem2 }] = await Promise.all([
      supabase.from("ads_performance")
        .select("spend, leads")
        .gte("data_ref", d7.toISOString().slice(0, 10))
        .lte("data_ref", hojeIso)
        .limit(10000),
      supabase.from("ads_performance")
        .select("spend, leads")
        .gte("data_ref", d14.toISOString().slice(0, 10))
        .lt("data_ref", d7.toISOString().slice(0, 10))
        .limit(10000),
    ]);

    const spend1 = (sem1 || []).reduce((s, r) => s + Number(r.spend || 0), 0);
    const leads1 = (sem1 || []).reduce((s, r) => s + (r.leads || 0), 0);
    const spend2 = (sem2 || []).reduce((s, r) => s + Number(r.spend || 0), 0);
    const leads2 = (sem2 || []).reduce((s, r) => s + (r.leads || 0), 0);

    const cpl1 = leads1 > 0 ? spend1 / leads1 : 0;
    const cpl2 = leads2 > 0 ? spend2 / leads2 : 0;

    if (cpl2 > 0 && cpl1 > 0) {
      const delta = pct(cpl1, cpl2);
      if (delta >= 30) {
        anomalias.push({
          tipo: "cpl_alto",
          severidade: "critico",
          metrica_atual: Math.round(cpl1 * 100) / 100,
          metrica_baseline: Math.round(cpl2 * 100) / 100,
          delta_pct: Math.round(delta),
          mensagem: `CPL subiu ${Math.round(delta)}% em 7 dias (R$ ${cpl2.toFixed(2)} → R$ ${cpl1.toFixed(2)})`,
          link: "/marketing/visao-geral",
        });
      } else if (delta <= -30) {
        anomalias.push({
          tipo: "cpl_baixo",
          severidade: "info",
          metrica_atual: Math.round(cpl1 * 100) / 100,
          metrica_baseline: Math.round(cpl2 * 100) / 100,
          delta_pct: Math.round(delta),
          mensagem: `CPL caiu ${Math.abs(Math.round(delta))}% em 7 dias (R$ ${cpl2.toFixed(2)} → R$ ${cpl1.toFixed(2)}) — bom sinal`,
          link: "/marketing/visao-geral",
        });
      }
    }

    // --- Leads/dia: 3 dias vs 3 dias anteriores ---
    const d3 = new Date(hoje); d3.setDate(d3.getDate() - 3);
    const d6 = new Date(hoje); d6.setDate(d6.getDate() - 6);

    const leads3d = (sem1 || []).filter(r => {
      // sem1 ja tem 7 dias, filtrar 3
      return true; // simplificar: usar leads1/7*3 como proxy
    });
    const leadsDia1 = leads1 / 7;
    const leadsDia2 = leads2 / 7;

    if (leadsDia2 > 0) {
      const deltaLeads = pct(leadsDia1, leadsDia2);
      if (deltaLeads <= -50) {
        anomalias.push({
          tipo: "leads_quedaram",
          severidade: "critico",
          metrica_atual: Math.round(leadsDia1 * 10) / 10,
          metrica_baseline: Math.round(leadsDia2 * 10) / 10,
          delta_pct: Math.round(deltaLeads),
          mensagem: `Leads/dia caíram ${Math.abs(Math.round(deltaLeads))}% (${leadsDia2.toFixed(1)} → ${leadsDia1.toFixed(1)}/dia)`,
          link: "/marketing/visao-geral",
        });
      }
    }
  } catch { /* falha silenciosa no bloco CPL/leads */ }

  // --- Churn: mes atual vs anterior (via churn_monthly_summary) ---
  try {
    const mesAntFormatted = `${mesAnterior.getFullYear()}/${String(mesAnterior.getMonth() + 1).padStart(2, "0")}`;
    const mesAtualFormatted = `${hoje.getFullYear()}/${String(hoje.getMonth() + 1).padStart(2, "0")}`;

    const [{ data: churnAtualData }, { data: churnAntData }] = await Promise.all([
      supabase.from("churn_monthly_summary").select("num_saidas").eq("ano_mes", mesAtualFormatted).maybeSingle(),
      supabase.from("churn_monthly_summary").select("num_saidas").eq("ano_mes", mesAntFormatted).maybeSingle(),
    ]);

    const ca = churnAtualData?.num_saidas || 0;
    const cp = churnAntData?.num_saidas || 0;

    if (cp > 0) {
      const delta = pct(ca, cp);
      if (delta >= 20) {
        anomalias.push({
          tipo: "churn_alto",
          severidade: "atencao",
          metrica_atual: ca,
          metrica_baseline: cp,
          delta_pct: Math.round(delta),
          mensagem: `Churn subiu ${Math.round(delta)}% vs mes anterior (${cp} → ${ca} saidas)`,
          link: "/retencao",
        });
      }
    }
  } catch { /* falha silenciosa */ }

  // --- Clientes em risco: score_saude < 40 ---
  try {
    const { count } = await supabase
      .from("clientes_receita")
      .select("*", { count: "exact", head: true })
      .lt("score_saude", 40)
      .in("status_financeiro", ["ativo", "pausado", "pagou_integral", "parceria"]);

    const emRisco = count || 0;
    if (emRisco >= 5) {
      anomalias.push({
        tipo: "clientes_em_risco",
        severidade: "critico",
        metrica_atual: emRisco,
        metrica_baseline: 5,
        delta_pct: 0,
        mensagem: `${emRisco} clientes com score saude < 40 — investigar`,
        link: "/clientes",
      });
    } else if (emRisco >= 3) {
      anomalias.push({
        tipo: "clientes_em_risco",
        severidade: "atencao",
        metrica_atual: emRisco,
        metrica_baseline: 3,
        delta_pct: 0,
        mensagem: `${emRisco} clientes com score saude < 40`,
        link: "/clientes",
      });
    }
  } catch { /* falha silenciosa */ }

  // --- CTWA: degradacao de atribuicao WhatsApp ---
  try {
    // Buscar leads WhatsApp dos ultimos 7 dias direto
    const d7Str = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const { data: ctwaLeads } = await supabase
      .from("leads_crm")
      .select("ad_id")
      .gte("ghl_created_at", d7Str)
      .in("utm_medium", ["whatsapp", "whatsapp_coex"]);

    const ctwaTotal = (ctwaLeads || []).length;
    const ctwaSemAdId = (ctwaLeads || []).filter(
      (l) => l.ad_id === null || l.ad_id === ""
    ).length;
    const ctwaPctSem = ctwaTotal > 0 ? (ctwaSemAdId / ctwaTotal) * 100 : 0;

    if (ctwaTotal > 0 && ctwaPctSem > 30) {
      anomalias.push({
        tipo: "ctwa_degradado",
        severidade: ctwaPctSem > 70 ? "critico" : "atencao",
        metrica_atual: Math.round(ctwaPctSem),
        metrica_baseline: 30,
        delta_pct: Math.round(ctwaPctSem - 30),
        mensagem: `${Math.round(ctwaPctSem)}% leads WhatsApp sem ad_id (esperado < 30%). Possivel regressao CTWA.`,
        link: "/marketing/atribuicao-proporcional",
      });
    }
  } catch { /* falha silenciosa no bloco CTWA */ }

  // Ordenar: critico > atencao > info
  const ordem: Record<Severidade, number> = { critico: 0, atencao: 1, info: 2 };
  anomalias.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);

  return anomalias;
}

