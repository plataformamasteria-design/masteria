/**
 * Motor de recomendações acionáveis.
 * Analisa ads_performance + ads_metadata + leads para gerar recomendações
 * ranqueadas por severidade e impacto estimado.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export type Severidade = "critico" | "atencao" | "oportunidade";
export type Categoria = "budget" | "criativo" | "segmentacao" | "funil" | "qualidade_lead";

export interface Recomendacao {
  id: string;
  severidade: Severidade;
  categoria: Categoria;
  titulo: string;
  dados_suporte: string;
  recomendacao: string;
  impacto_estimado: string | null;
  entidade_tipo: "adset" | "campaign" | "ad";
  entidade_id: string;
  entidade_nome: string;
  /** Current daily budget in BRL (centavos / 100) */
  budget_atual?: number;
  /** Account ID for Meta API calls */
  account_id?: string;
  meta?: Record<string, unknown>;
}

interface AdsetAgg {
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  account_id: string;
  spend: number;
  leads: number;
  impressoes: number;
  cliques: number;
  cpl: number;
  ctr: number;
  frequencia: number;
  status: string;
  daily_budget: number | null;
}

export async function gerarRecomendacoes(): Promise<Recomendacao[]> {
  const recs: Recomendacao[] = [];
  const hoje = new Date();
  const d7 = new Date(hoje);
  d7.setDate(d7.getDate() - 7);
  const d7Str = d7.toISOString().slice(0, 10);
  const hojeStr = hoje.toISOString().slice(0, 10);

  // Buscar performance por adset nos últimos 7 dias
  const { data: perfRows } = await supabase
    .from("ads_performance")
    .select("ad_id, spend, leads, impressoes, cliques, cpl, ctr, frequencia, data_ref")
    .gte("data_ref", d7Str)
    .lte("data_ref", hojeStr)
    .limit(50000);

  // Buscar metadados dos ads ativos
  const { data: metaRows } = await supabase
    .from("ads_metadata")
    .select("ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name, status, account_id, daily_budget")
    .in("status", ["ACTIVE", "PAUSED", "ADSET_PAUSED"]);

  if (!perfRows?.length || !metaRows?.length) return recs;

  // Indexar metadata por ad_id
  const metaMap = new Map(metaRows.map((m) => [m.ad_id, m]));

  // Agregar por adset
  const adsetMap = new Map<string, AdsetAgg>();
  for (const row of perfRows) {
    const meta = metaMap.get(row.ad_id);
    if (!meta?.adset_id) continue;

    let agg = adsetMap.get(meta.adset_id);
    if (!agg) {
      agg = {
        adset_id: meta.adset_id,
        adset_name: meta.adset_name || meta.adset_id,
        campaign_id: meta.campaign_id || "",
        campaign_name: meta.campaign_name || "",
        account_id: meta.account_id || "",
        spend: 0,
        leads: 0,
        impressoes: 0,
        cliques: 0,
        cpl: 0,
        ctr: 0,
        frequencia: 0,
        status: meta.status,
        daily_budget: meta.daily_budget ? Number(meta.daily_budget) / 100 : null,
      };
      adsetMap.set(meta.adset_id, agg);
    }
    agg.spend += Number(row.spend || 0);
    agg.leads += Number(row.leads || 0);
    agg.impressoes += Number(row.impressoes || 0);
    agg.cliques += Number(row.cliques || 0);
  }

  // Calcular métricas derivadas
  const adsets = Array.from(adsetMap.values()).map((a) => ({
    ...a,
    cpl: a.leads > 0 ? a.spend / a.leads : 0,
    ctr: a.impressoes > 0 ? (a.cliques / a.impressoes) * 100 : 0,
  }));

  // CPL médio global ponderado (spend total / leads total)
  const adsetsComLeads = adsets.filter((a) => a.leads > 0);
  const totalSpendComLeads = adsetsComLeads.reduce((s, a) => s + a.spend, 0);
  const totalLeadsComLeads = adsetsComLeads.reduce((s, a) => s + a.leads, 0);
  const cplMedio = totalLeadsComLeads > 0 ? totalSpendComLeads / totalLeadsComLeads : 80;

  // CTR médio
  const adsetsComImps = adsets.filter((a) => a.impressoes > 100);
  const ctrMedio =
    adsetsComImps.length > 0
      ? adsetsComImps.reduce((s, a) => s + a.ctr, 0) / adsetsComImps.length
      : 1;

  let idCounter = 0;
  const nextId = () => `rec_${++idCounter}`;

  for (const adset of adsets) {
    if (adset.status === "PAUSED" || adset.status === "ADSET_PAUSED") continue;
    if (adset.spend < 50) continue; // Ignorar conjuntos com spend insignificante

    // ── CPL Alto ──
    if (adset.cpl > 0 && adset.cpl > cplMedio * 1.5) {
      const fator = (adset.cpl / cplMedio).toFixed(1);
      const economiaEstimada = ((adset.cpl - cplMedio) * adset.leads) / 7;
      recs.push({
        id: nextId(),
        severidade: adset.cpl > cplMedio * 2.5 ? "critico" : "atencao",
        categoria: "budget",
        titulo: `CPL ${fator}x acima da média em '${adset.adset_name}'`,
        dados_suporte: `CPL atual: R$${adset.cpl.toFixed(2)} | Média: R$${cplMedio.toFixed(2)} | Investimento 7d: R$${adset.spend.toFixed(2)} | Leads: ${adset.leads}`,
        recomendacao:
          adset.cpl > cplMedio * 3
            ? "Pausar este conjunto imediatamente. CPL insustentável — realoque budget para conjuntos com melhor performance."
            : "Reduzir budget em 50% e monitorar por 3 dias. Se CPL não normalizar, pausar.",
        impacto_estimado: `Economia potencial de ~R$${economiaEstimada.toFixed(0)}/dia se CPL normalizar à média`,
        entidade_tipo: "adset",
        entidade_id: adset.adset_id,
        entidade_nome: adset.adset_name,
        budget_atual: adset.daily_budget ?? undefined,
        account_id: adset.account_id || undefined,
      });
    }

    // ── CTR Muito Baixo ──
    if (adset.impressoes > 500 && adset.ctr < ctrMedio * 0.4 && ctrMedio > 0) {
      recs.push({
        id: nextId(),
        severidade: "atencao",
        categoria: "criativo",
        titulo: `CTR muito baixo em '${adset.adset_name}' (${adset.ctr.toFixed(2)}%)`,
        dados_suporte: `CTR atual: ${adset.ctr.toFixed(2)}% | Média: ${ctrMedio.toFixed(2)}% | Impressões 7d: ${adset.impressoes.toLocaleString("pt-BR")}`,
        recomendacao: "O criativo não está gerando cliques. Criar variação A/B com novo hook ou thumbnail diferente.",
        impacto_estimado: `Se CTR subir para média (${ctrMedio.toFixed(2)}%), cliques podem dobrar sem aumentar investimento`,
        entidade_tipo: "adset",
        entidade_id: adset.adset_id,
        entidade_nome: adset.adset_name,
        account_id: adset.account_id || undefined,
      });
    }

    // ── Frequência Alta ──
    if (adset.impressoes > 500) {
      // Calcular frequência: usar dados brutos pois a agregação perde granularidade
      const adsDoAdset = perfRows.filter((r) => {
        const m = metaMap.get(r.ad_id);
        return m?.adset_id === adset.adset_id;
      });
      // Frequência ponderada por impressões (freq de 8 com 10k imps pesa mais que freq 2 com 100 imps)
      const totalImpFreq = adsDoAdset.reduce((s, r) => s + (Number(r.frequencia || 0) > 0 ? Number(r.impressoes || 0) : 0), 0);
      const freqMedia = totalImpFreq > 0
        ? adsDoAdset.reduce((s, r) => s + Number(r.frequencia || 0) * Number(r.impressoes || 0), 0) / totalImpFreq
        : 0;

      if (freqMedia > 4) {
        recs.push({
          id: nextId(),
          severidade: freqMedia > 6 ? "critico" : "atencao",
          categoria: "criativo",
          titulo: `Frequência ${freqMedia.toFixed(1)}x em '${adset.adset_name}' — audiência saturada`,
          dados_suporte: `Frequência média: ${freqMedia.toFixed(1)}x | Limite saudável: 3-4x | Impressões 7d: ${adset.impressoes.toLocaleString("pt-BR")}`,
          recomendacao: freqMedia > 6
            ? "Rotacionar criativos imediatamente. Audiência fadigada — CPL tende a subir."
            : "Preparar novos criativos para rotação. Frequência acima do ideal.",
          impacto_estimado: "Evitar aumento de CPL por fadiga de audiência",
          entidade_tipo: "adset",
          entidade_id: adset.adset_id,
          entidade_nome: adset.adset_name,
          account_id: adset.account_id || undefined,
        });
      }
    }

    // ── Spend Alto sem Leads ──
    if (adset.spend > 200 && adset.leads === 0) {
      recs.push({
        id: nextId(),
        severidade: "critico",
        categoria: "funil",
        titulo: `R$${adset.spend.toFixed(0)} investidos sem nenhum lead em '${adset.adset_name}'`,
        dados_suporte: `Investimento 7d: R$${adset.spend.toFixed(2)} | Leads: 0 | CTR: ${adset.ctr.toFixed(2)}% | Cliques: ${adset.cliques}`,
        recomendacao: adset.cliques > 10
          ? "Há cliques mas zero leads — problema no formulário ou landing page. Verificar pixel e página de destino."
          : "Sem cliques nem leads — pausar conjunto e realocar budget.",
        impacto_estimado: `Recuperar R$${(adset.spend / 7).toFixed(0)}/dia em budget desperdiçado`,
        entidade_tipo: "adset",
        entidade_id: adset.adset_id,
        entidade_nome: adset.adset_name,
        budget_atual: adset.daily_budget ?? undefined,
        account_id: adset.account_id || undefined,
      });
    }

    // ── Oportunidade: CPL baixo, pode escalar ──
    if (adset.cpl > 0 && adset.cpl < cplMedio * 0.6 && adset.leads >= 3) {
      recs.push({
        id: nextId(),
        severidade: "oportunidade",
        categoria: "budget",
        titulo: `Conjunto top: '${adset.adset_name}' com CPL ${(cplMedio / adset.cpl).toFixed(1)}x abaixo da média`,
        dados_suporte: `CPL: R$${adset.cpl.toFixed(2)} | Média: R$${cplMedio.toFixed(2)} | Leads 7d: ${adset.leads} | Budget atual: ${adset.daily_budget ? `R$${adset.daily_budget.toFixed(2)}/dia` : "N/A"}`,
        recomendacao: "Escalar budget em 20% (regra de escala: máx 25%/dia). Monitorar CPL nos próximos 3 dias.",
        impacto_estimado: adset.daily_budget
          ? `+R$${(adset.daily_budget * 0.2).toFixed(2)}/dia → ~${Math.ceil(adset.leads * 0.2)} leads adicionais/semana`
          : "Potencial de mais leads mantendo CPL eficiente",
        entidade_tipo: "adset",
        entidade_id: adset.adset_id,
        entidade_nome: adset.adset_name,
        budget_atual: adset.daily_budget ?? undefined,
        account_id: adset.account_id || undefined,
      });
    }
  }

  // ── Verificar leads estagnados no funil ──
  try {
    const d30 = new Date(hoje);
    d30.setDate(d30.getDate() - 30);
    // Etapas iniciais (não qualificadas) — leads parados aqui > 7 dias são estagnados
    const etapasIniciais = ["oportunidade", "lead_qualificado", "novo", "frio"];
    const { count: estagnados } = await supabase
      .from("leads_crm")
      .select("*", { count: "exact", head: true })
      .in("etapa", etapasIniciais)
      .lt("ghl_created_at", d7.toISOString())
      .gte("ghl_created_at", d30.toISOString());

    if (estagnados && estagnados > 10) {
      recs.push({
        id: nextId(),
        severidade: estagnados > 30 ? "critico" : "atencao",
        categoria: "funil",
        titulo: `${estagnados} leads estagnados no funil há mais de 7 dias`,
        dados_suporte: `Leads em "novo" ou "contato_feito" há 7-30 dias: ${estagnados}`,
        recomendacao: "Exportar lista para CRM e acionar equipe de closers. Leads frios perdem valor rapidamente.",
        impacto_estimado: `Potencial de ${Math.ceil(estagnados * 0.1)} contratos se trabalhados rapidamente`,
        entidade_tipo: "campaign",
        entidade_id: "funil_geral",
        entidade_nome: "Funil de Vendas",
        meta: { leads_estagnados: estagnados },
      });
    }
  } catch { /* silent */ }

  // ── Qualidade de leads: CPQL alto por segmentação ──
  try {
    // Buscar etapas MQL de config_funil_etapas (fonte canônica)
    const { data: mqlRows } = await supabase
      .from("config_funil_etapas")
      .select("etapa")
      .eq("ativo", true)
      .eq("classificacao", "MQL");
    const mqlEtapas = mqlRows && mqlRows.length > 0
      ? mqlRows.map((r: { etapa: string }) => r.etapa)
      : ["qualificado", "reuniao_agendada", "proposta_enviada", "assinatura_contrato"];

    const { data: leadsRecentes } = await supabase
      .from("leads_crm")
      .select("ad_id, etapa, ghl_created_at")
      .gte("ghl_created_at", d7.toISOString())
      .limit(5000);

    if (leadsRecentes && leadsRecentes.length > 0) {
      // Agrupar por adset e calcular taxa de qualificação
      const adsetLeads = new Map<string, { total: number; qualificados: number; adsetName: string; adsetId: string }>();
      for (const lead of leadsRecentes) {
        const meta = lead.ad_id ? metaMap.get(lead.ad_id) : null;
        if (!meta?.adset_id) continue;
        let group = adsetLeads.get(meta.adset_id);
        if (!group) {
          group = { total: 0, qualificados: 0, adsetName: meta.adset_name || meta.adset_id, adsetId: meta.adset_id };
          adsetLeads.set(meta.adset_id, group);
        }
        group.total++;
        if (mqlEtapas.includes(lead.etapa)) {
          group.qualificados++;
        }
      }

      for (const [, group] of adsetLeads) {
        if (group.total < 5) continue;
        const taxaQual = (group.qualificados / group.total) * 100;
        if (taxaQual < 15) {
          const adsetData = adsetMap.get(group.adsetId);
          const cplAdset = adsetData?.cpl ?? 0;
          const cpql = group.qualificados > 0 ? (adsetData?.spend ?? 0) / group.qualificados : 0;
          recs.push({
            id: nextId(),
            severidade: taxaQual < 5 ? "critico" : "atencao",
            categoria: "qualidade_lead",
            titulo: `Qualificação de apenas ${taxaQual.toFixed(0)}% em '${group.adsetName}'`,
            dados_suporte: `Leads 7d: ${group.total} | Qualificados: ${group.qualificados} (${taxaQual.toFixed(0)}%) | CPL: R$${cplAdset.toFixed(2)}${cpql > 0 ? ` | CPQL: R$${cpql.toFixed(2)}` : ""}`,
            recomendacao: "Revisar segmentação — leads não estão avançando no funil. Considerar ajustar interesses ou excluir audiências de baixa qualidade.",
            impacto_estimado: `Reduzir CPQL ajustando segmentação pode economizar ~R$${(cpql * 0.3).toFixed(0)}/lead qualificado`,
            entidade_tipo: "adset",
            entidade_id: group.adsetId,
            entidade_nome: group.adsetName,
            account_id: adsetData?.account_id || undefined,
          });
        }
      }
    }
  } catch { /* silent */ }

  // Ordenar: critico > atencao > oportunidade, depois por impacto (spend)
  const ordemSev: Record<Severidade, number> = { critico: 0, atencao: 1, oportunidade: 2 };
  recs.sort((a, b) => ordemSev[a.severidade] - ordemSev[b.severidade]);

  return recs;
}
