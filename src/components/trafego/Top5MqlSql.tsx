"use client";

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/format";
import { getConfigMqlSql, type ConfigMqlSql } from "@/lib/metricas/mql-sql";
import { ATRIBUICAO_INICIO_DATA } from "@/lib/atribuicao";
import { useConfigFunilCampanha, FunilBadge } from "@/components/trafego/FunilCampanhaConfig";
import { Trophy, Loader2 } from "lucide-react";
import useSWR from "swr";
import type { FunilFilterValue } from "@/components/trafego/FunilFilter";

interface AdRanking {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  adset_name: string;
  campaign_id: string;
  leads_total: number;
  mql: number;
  sql: number;
  taxa_mql: number;
  investimento: number;
  custo_mql: number | null;
  custo_sql: number | null;
  fechamentos: number;
  receita_entrada: number;
  receita_ltv: number;
}

function generateMonthOptions(): { value: string; label: string }[] {
  const cutoff = new Date(ATRIBUICAO_INICIO_DATA);
  const now = new Date();
  const options: { value: string; label: string }[] = [];

  let d = new Date(now.getFullYear(), now.getMonth(), 1);
  while (d >= cutoff) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    options.push({ value: `${y}-${m}`, label: label.charAt(0).toUpperCase() + label.slice(1) });
    d.setMonth(d.getMonth() - 1);
  }
  return options;
}

async function fetchRankingData(mesRef: string): Promise<{ ads: AdRanking[]; config: ConfigMqlSql }> {
  const config = await getConfigMqlSql();
  const startDate = `${mesRef}-01`;
  const endDate = new Date(Number(mesRef.split("-")[0]), Number(mesRef.split("-")[1]), 0).toISOString().split("T")[0];

  // TODOS os leads do mês (com ou sem ad_id) + contrato vinculado
  const { data: leads } = await supabase
    .from("leads_crm")
    .select("ad_id, campaign_id, campaign_name, adset_name, etapa, contrato_id")
    .eq("mes_referencia", mesRef)
    .not("etapa", "is", null);

  if (!leads || leads.length === 0) return { ads: [], config };

  // Contratos fechados (para mapear receita por lead)
  const contratoIds = leads.map(l => l.contrato_id).filter(Boolean) as string[];
  const { data: contratosData } = contratoIds.length > 0
    ? await supabase
        .from("contratos")
        .select("id, valor_entrada, valor_total_projeto, status")
        .in("id", contratoIds)
        .in("status", ["ativo", "pendente_aprovacao"])
    : { data: [] };
  const contratoMap = new Map((contratosData || []).map(c => [c.id, c]));

  // Performance data for spend
  const { data: perf } = await supabase
    .from("ads_performance")
    .select("ad_id, spend, leads")
    .gte("data_ref", startDate)
    .lte("data_ref", endDate);

  // ads_metadata para nomes e mapeamento campaign → ads
  const { data: metaRows } = await supabase
    .from("ads_metadata")
    .select("ad_id, ad_name, campaign_id, campaign_name, adset_name");

  const metaNameMap = new Map<string, { ad_name: string; campaign_name: string | null; adset_name: string | null; campaign_id: string | null }>();
  // Map campaign_id → ad_id mais volumoso (para atribuir leads sem ad_id)
  const campaignTopAd = new Map<string, string>();
  for (const m of metaRows || []) {
    metaNameMap.set(m.ad_id, { ad_name: m.ad_name, campaign_name: m.campaign_name, adset_name: m.adset_name, campaign_id: m.campaign_id });
  }

  // Spend e leads Meta por ad_id
  const spendMap = new Map<string, number>();
  const leadsMetaMap = new Map<string, number>();
  for (const p of perf || []) {
    spendMap.set(p.ad_id, (spendMap.get(p.ad_id) || 0) + Number(p.spend));
    leadsMetaMap.set(p.ad_id, (leadsMetaMap.get(p.ad_id) || 0) + Number(p.leads));
  }

  // Encontrar o anúncio com mais leads Meta por campanha (para atribuir leads sem ad_id)
  const campaignAdsVolume = new Map<string, { ad_id: string; volume: number }[]>();
  for (const [adId, volume] of leadsMetaMap) {
    const meta = metaNameMap.get(adId);
    if (meta?.campaign_id) {
      if (!campaignAdsVolume.has(meta.campaign_id)) campaignAdsVolume.set(meta.campaign_id, []);
      campaignAdsVolume.get(meta.campaign_id)!.push({ ad_id: adId, volume });
    }
  }
  for (const [cid, ads] of campaignAdsVolume) {
    ads.sort((a, b) => b.volume - a.volume);
    if (ads.length > 0) campaignTopAd.set(cid, ads[0].ad_id);
  }

  // Agrupar leads por ad_id (leads COM ad_id direto, SEM ad_id → atribui ao top ad da campanha)
  const adMap = new Map<string, {
    ad_id: string; ad_name: string; campaign_name: string; adset_name: string;
    campaign_id: string; leads: { etapa: string; contrato_id: string | null }[];
  }>();

  for (const l of leads) {
    // Resolver ad_id: direto se tem, senão top ad da campanha
    let adId = l.ad_id;
    if (!adId && l.campaign_id) {
      adId = campaignTopAd.get(l.campaign_id) || null;
    }
    if (!adId) continue; // sem ad_id e sem campanha — skip

    if (!adMap.has(adId)) {
      const meta = metaNameMap.get(adId);
      adMap.set(adId, {
        ad_id: adId,
        ad_name: meta?.ad_name || adId,
        campaign_name: l.campaign_name || meta?.campaign_name || "—",
        adset_name: l.adset_name || meta?.adset_name || "—",
        campaign_id: l.campaign_id || meta?.campaign_id || "",
        leads: [],
      });
    }
    adMap.get(adId)!.leads.push({ etapa: l.etapa, contrato_id: l.contrato_id || null });
  }

  const ads: AdRanking[] = [];
  for (const [adId, data] of adMap) {
    const mql = data.leads.filter((l) => config.mql.includes(l.etapa)).length;
    const sql = data.leads.filter((l) => config.sql.includes(l.etapa)).length;
    const investimento = spendMap.get(adId) || 0;
    const leadsTotal = data.leads.length;
    const taxa_mql = leadsTotal > 0 ? (mql / leadsTotal) * 100 : 0;

    // Fechamentos e receita: leads com contrato ativo
    let fechamentos = 0;
    let receita_entrada = 0;
    let receita_ltv = 0;
    for (const l of data.leads) {
      if (l.contrato_id) {
        const ct = contratoMap.get(l.contrato_id);
        if (ct) {
          fechamentos++;
          receita_entrada += Number(ct.valor_entrada || 0);
          receita_ltv += Number(ct.valor_total_projeto || 0);
        }
      }
    }

    ads.push({
      ad_id: adId,
      ad_name: data.ad_name,
      campaign_name: data.campaign_name,
      adset_name: data.adset_name,
      campaign_id: data.campaign_id,
      leads_total: leadsTotal,
      mql,
      sql,
      taxa_mql,
      investimento,
      custo_mql: mql > 0 ? investimento / mql : null,
      custo_sql: sql > 0 ? investimento / sql : null,
      fechamentos,
      receita_entrada,
      receita_ltv,
    });
  }

  return { ads, config };
}

export function Top5MqlSql({ funilFiltro = "todos" }: { funilFiltro?: FunilFilterValue }) {
  const monthOptions = useMemo(generateMonthOptions, []);
  const [mesRef, setMesRef] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { mapByCampaign: funilMap } = useConfigFunilCampanha();

  const { data, isLoading } = useSWR(
    ["top5-mql-sql", mesRef],
    () => fetchRankingData(mesRef),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  // Apply funnel filter on client side
  const filteredAds = useMemo(() => {
    if (!data?.ads) return [];
    if (funilFiltro === "todos") return data.ads;

    const matchedCampaigns = new Set<string>();
    if (funilFiltro === "nao_classificado") {
      const configuredIds = new Set(Array.from(funilMap.keys()));
      for (const ad of data.ads) {
        if (ad.campaign_id && !configuredIds.has(ad.campaign_id)) matchedCampaigns.add(ad.campaign_id);
      }
    } else {
      for (const [cid, cfg] of funilMap) {
        if (cfg.tipo_funil === funilFiltro) matchedCampaigns.add(cid);
      }
    }

    return data.ads.filter((ad) => ad.campaign_id && matchedCampaigns.has(ad.campaign_id));
  }, [data, funilFiltro, funilMap]);

  const [showAll, setShowAll] = useState(false);

  // Sorted by taxa_mql desc, tiebreak by mql volume desc
  const sortedAds = useMemo(() => {
    return filteredAds
      .filter((a) => a.mql > 0 || a.sql > 0)
      .sort((a, b) => {
        const diff = b.taxa_mql - a.taxa_mql;
        if (diff !== 0) return diff;
        return b.mql - a.mql;
      });
  }, [filteredAds]);

  const displayAds = showAll ? sortedAds : sortedAds.slice(0, 5);
  const hasMore = sortedAds.length > 5;

  const posColors = ["text-yellow-400", "text-zinc-300", "text-amber-600", "text-muted-foreground", "text-muted-foreground"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase font-black tracking-widest text-muted-foreground">
          {showAll ? "Ranking Completo — MQL & SQL" : "Top 5 Anúncios — Taxa MQL"}
        </h2>
        <select
          value={mesRef}
          onChange={(e) => setMesRef(e.target.value)}
          className="text-xs bg-transparent border border-border rounded-lg px-2.5 py-1.5 text-foreground"
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ranking por Taxa de MQL
                {sortedAds.length > 0 && <span className="font-normal text-muted-foreground/50 ml-1">({sortedAds.length} anúncios)</span>}
              </h3>
            </div>
            {displayAds.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {funilFiltro !== "todos"
                  ? `Nenhum anúncio com MQL/SQL e ad_id atribuído para o funil "${funilFiltro}" neste período`
                  : "Sem leads com ad_id e MQL/SQL no período. Execute o Meta Lead Matching para recuperar atribuições."}
              </p>
            ) : (
              <>
                {/* Tabela expandida quando showAll */}
                {showAll ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-[9px] uppercase text-muted-foreground border-b border-border/50">
                        <tr>
                          <th className="text-left py-2 px-2">#</th>
                          <th className="text-left py-2 px-2">Anúncio / Campanha</th>
                          <th className="text-right py-2 px-2">Leads</th>
                          <th className="text-right py-2 px-2">MQL</th>
                          <th className="text-right py-2 px-2">SQL</th>
                          <th className="text-right py-2 px-2">Taxa MQL</th>
                          <th className="text-right py-2 px-2">Invest</th>
                          <th className="text-right py-2 px-2">Custo/MQL</th>
                          <th className="text-right py-2 px-2">Custo/SQL</th>
                          <th className="text-right py-2 px-2">Fechou</th>
                          <th className="text-right py-2 px-2">Entrada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {displayAds.map((ad, i) => {
                          const funilCfg = funilMap.get(ad.campaign_id);
                          return (
                            <tr key={ad.ad_id} className="hover:bg-white/[0.02]">
                              <td className={`py-2 px-2 font-black ${posColors[i] || "text-muted-foreground"}`}>{i + 1}</td>
                              <td className="py-2 px-2 max-w-[200px]">
                                <Tooltip content={ad.ad_name}>
                                  <p className="font-semibold truncate cursor-help">{ad.ad_name}</p>
                                </Tooltip>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[9px] text-muted-foreground truncate max-w-[140px]">{ad.campaign_name}</span>
                                  {funilCfg && <FunilBadge tipo={funilCfg.tipo_funil} size="xs" />}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right">{ad.leads_total}</td>
                              <td className="py-2 px-2 text-right font-bold text-emerald-400">{ad.mql}</td>
                              <td className="py-2 px-2 text-right font-bold text-blue-400">{ad.sql}</td>
                              <td className="py-2 px-2 text-right font-bold">{ad.taxa_mql.toFixed(1)}%</td>
                              <td className="py-2 px-2 text-right text-muted-foreground">{formatCurrency(ad.investimento)}</td>
                              <td className="py-2 px-2 text-right">{ad.custo_mql !== null ? formatCurrency(ad.custo_mql) : "—"}</td>
                              <td className="py-2 px-2 text-right">{ad.custo_sql !== null ? formatCurrency(ad.custo_sql) : "—"}</td>
                              <td className="py-2 px-2 text-right font-bold">{ad.fechamentos > 0 ? <span className="text-emerald-400">{ad.fechamentos}</span> : "—"}</td>
                              <td className="py-2 px-2 text-right">{ad.receita_entrada > 0 ? <span className="text-emerald-400">{formatCurrency(ad.receita_entrada)}</span> : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Cards compactos (top 5) */
                  <div className="space-y-2">
                    {displayAds.map((ad, i) => {
                      const funilCfg = funilMap.get(ad.campaign_id);
                      const truncName = ad.ad_name.length > 30 ? ad.ad_name.slice(0, 28) + "…" : ad.ad_name;
                      return (
                        <div key={ad.ad_id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                          <span className={`text-sm font-black w-5 text-center shrink-0 ${posColors[i]}`}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <Tooltip content={ad.ad_name}>
                              <p className="text-xs font-semibold truncate cursor-help">{truncName}</p>
                            </Tooltip>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={ad.campaign_name}>{ad.campaign_name}</span>
                              <span className="text-[10px] text-muted-foreground/50">·</span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[100px]" title={ad.adset_name}>{ad.adset_name}</span>
                              {funilCfg && <FunilBadge tipo={funilCfg.tipo_funil} size="xs" />}
                            </div>
                          </div>
                          <div className="text-right shrink-0 space-y-0.5">
                            <p className="text-xs font-black text-emerald-400">{ad.taxa_mql.toFixed(1)}%</p>
                            <p className="text-[10px] text-muted-foreground">
                              {ad.mql} MQL · {ad.sql} SQL / {ad.leads_total} leads
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {ad.custo_mql !== null ? formatCurrency(ad.custo_mql) : "—"}/MQL
                            </p>
                            {ad.fechamentos > 0 && (
                              <p className="text-[10px] font-bold text-emerald-400">
                                {ad.fechamentos} fechou · {formatCurrency(ad.receita_entrada)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Botão Mostrar mais / Mostrar menos */}
                {hasMore && (
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="w-full text-center text-xs text-primary hover:text-primary/80 font-medium py-2 border-t border-border/30 transition-colors"
                  >
                    {showAll ? `Mostrar apenas Top 5` : `Mostrar todas (${sortedAds.length} campanhas)`}
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


