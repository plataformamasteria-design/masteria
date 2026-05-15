"use client";
/**
 * Hook unificado de dados para a página de Relatórios.
 * Orquestra 3 fontes em paralelo com período comparativo automático.
 */
import { useMemo, useState, useEffect } from "react";
import useSWR from "swr";
import { useAccountId } from "@/contexts/ad-account-context";
import { usePeriodoTrafego } from "@/contexts/periodo-trafego-context";
import { useAccountSpend } from "@/hooks/use-account-spend";

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

export type SortMetric = "spend" | "leads" | "cpl" | "ctr" | "cpm" | "cpc" | "frequency" | "reach" | "score";
export type ReportLevel = "campaign" | "adset" | "ad";

export interface ReportFilters {
  since: string;
  until: string;
  level: ReportLevel;
  sortMetric: SortMetric;
  sortDir: "asc" | "desc";
  statusFilter: "all" | "ACTIVE" | "PAUSED";
  search: string;
}

function autoCompare(since: string, until: string) {
  const dias = Math.ceil((new Date(until).getTime() - new Date(since).getTime()) / 86400000) + 1;
  const prevUntil = new Date(new Date(since).getTime() - 86400000).toISOString().slice(0, 10);
  const prevSince = new Date(new Date(since).getTime() - dias * 86400000).toISOString().slice(0, 10);
  return { prevSince, prevUntil };
}

export function useRelatorioData(filters: ReportFilters) {
  const { since, until, level } = filters;
  const { prevSince, prevUntil } = autoCompare(since, until);
  const accountId = useAccountId();
  const acct = accountId ? `&account_id=${accountId}` : "";

  // Fonte unificada de investimento (mesma para todas as telas de tráfego)
  const unified = useAccountSpend(since, until);

  // Insights por nível: rankings + totais + deltas
  const rankingKey = accountId
    ? `/api/meta/insights?since=${since}&until=${until}&prev_since=${prevSince}&prev_until=${prevUntil}&level=${level}&breakdown=none${acct}`
    : null;
  const { data: rankingRes, isLoading: loadingRanking, mutate: mutateRanking } = useSWR(rankingKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    keepPreviousData: true,
  });

  // Insights diários para o gráfico de tendência (sempre no nível campaign para performance)
  const trendKey = accountId
    ? `/api/meta/insights?since=${since}&until=${until}&level=campaign&breakdown=daily${acct}`
    : null;
  const { data: trendRes, isLoading: loadingTrend, mutate: mutateTrend } = useSWR(trendKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    keepPreviousData: true,
  });

  // Dados CRM diários (view materializada vw_trafego_diario)
  const crmDiarioKey = `/api/marketing/tendencia-diaria?dataInicio=${since}&dataFim=${until}&metricas=qualificados,reunioes_realizadas,mrr_gerado,cprf`;
  const { data: crmDiarioRes, isLoading: loadingCrmDiario } = useSWR(crmDiarioKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120000,
    keepPreviousData: true,
  });

  // Audiências + breakdowns demográficos
  const audienceKey = accountId
    ? `/api/meta/insights-audiences?since=${since}&until=${until}${acct}`
    : null;
  const { data: audienceRes, isLoading: loadingAudiences } = useSWR(audienceKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120000,
    keepPreviousData: true,
  });

  // Dados processados e filtrados
  const rows = useMemo(() => {
    const raw: any[] = rankingRes?.data || [];
    let filtered = raw;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(r => r.name?.toLowerCase().includes(q));
    }
    if (filters.statusFilter !== "all") {
      filtered = filtered.filter(r => r.status === filters.statusFilter || r.effective_status === filters.statusFilter);
    }

    const { sortMetric, sortDir } = filters;
    filtered.sort((a, b) => {
      const av = a[sortMetric] ?? (sortDir === "asc" ? Infinity : -Infinity);
      const bv = b[sortMetric] ?? (sortDir === "asc" ? Infinity : -Infinity);
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return filtered;
  }, [rankingRes, filters.search, filters.statusFilter, filters.sortMetric, filters.sortDir]);

  // Tendência diária agregada (soma de todas as campanhas por dia + dados CRM)
  const trendData = useMemo(() => {
    const raw: any[] = trendRes?.data || [];
    const byDate = new Map<string, Record<string, any>>();

    for (const row of raw) {
      if (!row.date) continue;
      const cur = byDate.get(row.date) || { date: row.date, spend: 0, leads: 0, clicks: 0, impressions: 0, reach: 0 };
      cur.spend       += row.spend       || 0;
      cur.leads       += row.leads       || 0;
      cur.clicks      += row.clicks      || 0;
      cur.impressions += row.impressions || 0;
      cur.reach       += row.reach       || 0;
      byDate.set(row.date, cur);
    }

    // Mesclar dados CRM diários
    const crmSerie: any[] = crmDiarioRes?.serie || [];
    for (const crm of crmSerie) {
      if (!crm.data) continue;
      const cur = byDate.get(crm.data) || { date: crm.data, spend: 0, leads: 0, clicks: 0, impressions: 0, reach: 0 };
      cur.qualificados = crm.qualificados ?? null;
      cur.reunioes_realizadas = crm.reunioes_realizadas ?? null;
      cur.mrr_gerado = crm.mrr_gerado ?? null;
      cur.cprf = crm.cprf ?? null;
      cur.atribuicao_completa = crm.atribuicao_completa ?? false;
      byDate.set(crm.data, cur);
    }

    return Array.from(byDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        cpl: d.leads > 0 ? d.spend / d.leads : null,
        ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : null,
        cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : null,
        label: d.date.slice(5), // MM-DD
      }));
  }, [trendRes, crmDiarioRes]);

  // Sobrescrever totals com a fonte unificada para garantir consistência entre telas
  const baseTotals = rankingRes?.totals || null;
  const unifiedTotals = baseTotals ? {
    ...baseTotals,
    spend: unified.totalSpend ?? baseTotals.spend,
    leads: unified.totalLeads ?? baseTotals.leads,
    impressions: unified.totalImpressions ?? baseTotals.impressions,
    clicks: unified.totalClicks ?? baseTotals.clicks,
    reach: unified.totalReach ?? baseTotals.reach,
    inline_link_clicks: unified.totalInlineLinkClicks ?? baseTotals.inline_link_clicks,
  } : null;

  return {
    rows,
    totals:         unifiedTotals,
    totalsPrev:     rankingRes?.totals_prev   || null,
    trendData,
    audiences:      audienceRes?.audiences    || [],
    ageGender:      audienceRes?.age_gender   || [],
    platformData:   audienceRes?.platform     || [],
    isLoading:      loadingRanking || loadingTrend || loadingCrmDiario,
    isLoadingAudiences: loadingAudiences,
    period: { since, until, prevSince, prevUntil },
    mutate: () => { mutateRanking(); mutateTrend(); },
  };
}

/** Hook para gerenciar os filtros do relatório com defaults */
export function useReportFilters() {
  const { dataInicio: globalSince, dataFim: globalUntil } = usePeriodoTrafego();

  const [since, setSince]               = useState(globalSince);
  const [until, setUntil]               = useState(globalUntil);

  // Sync with global period when it changes
  useEffect(() => { setSince(globalSince); }, [globalSince]);
  useEffect(() => { setUntil(globalUntil); }, [globalUntil]);
  const [level, setLevel]               = useState<ReportLevel>("campaign");
  const [sortMetric, setSortMetric]     = useState<SortMetric>("spend");
  const [sortDir, setSortDir]           = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "PAUSED">("all");
  const [search, setSearch]             = useState("");

  const toggleSort = (metric: SortMetric) => {
    if (metric === sortMetric) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortMetric(metric); setSortDir("desc"); }
  };

  return {
    filters: { since, until, level, sortMetric, sortDir, statusFilter, search } as ReportFilters,
    setSince, setUntil, setLevel, toggleSort,
    setSortMetric, setSortDir, setStatusFilter, setSearch,
  };
}

