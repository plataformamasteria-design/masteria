"use client";

import { Component, useMemo, useState } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/format";
import { usePeriodoTrafego } from "@/contexts/periodo-trafego-context";
import { useTrafegoData } from "@/hooks/use-trafego-data";
import { useAccountSpend } from "@/hooks/use-account-spend";
import useSWR from "swr";
import {
  Users, UserCheck, CalendarCheck, Video, FileText, Trophy,
  TrendingUp, TrendingDown, AlertTriangle, DollarSign, Target, Activity,
  Filter, X,
} from "lucide-react";

// ── ErrorBoundary ──
class FunilErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[FunilCliente] Erro capturado:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertTriangle className="h-12 w-12 text-amber-400" />
          <h2 className="text-xl font-semibold">Não foi possível carregar os dados do funil</h2>
          <p className="text-muted-foreground text-sm">Tente novamente. Se o problema persistir, verifique a conexão.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm font-medium"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Etapas cumulativas no CRM ──
const ETAPA_QUALIFICADO = ["qualificado", "lead_qualificado", "reuniao_agendada", "reuniao_feita", "proposta_enviada", "negociacao", "follow_up", "assinatura_contrato", "comprou"];
const ETAPA_REUNIAO_AGENDADA = ["reuniao_agendada", "reuniao_feita", "proposta_enviada", "negociacao", "follow_up", "assinatura_contrato", "comprou"];
const ETAPA_REUNIAO_REALIZADA = ["reuniao_feita", "proposta_enviada", "negociacao", "follow_up", "assinatura_contrato", "comprou"];
const ETAPA_PROPOSTA = ["proposta_enviada", "negociacao", "follow_up", "assinatura_contrato", "comprou"];
const ETAPA_FECHADO = ["assinatura_contrato", "comprou"];

// ── Funil config ──
const FUNIL_ESTAGIOS = [
  { key: "leads", label: "Leads Gerados", icon: Users, cor: "#94a3b8" },
  { key: "qualificados", label: "Qualificados", icon: UserCheck, cor: "#3b82f6" },
  { key: "reunioes_agendadas", label: "Reuniões Agendadas", icon: CalendarCheck, cor: "#8b5cf6" },
  { key: "reunioes_realizadas", label: "Reuniões Realizadas", icon: Video, cor: "#a855f7" },
  { key: "propostas", label: "Propostas Enviadas", icon: FileText, cor: "#f97316" },
  { key: "fechados", label: "Clientes Fechados", icon: Trophy, cor: "#22c55e" },
] as const;

type FunilKey = typeof FUNIL_ESTAGIOS[number]["key"];

interface CrmLead {
  id: string;
  ad_id: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  etapa: string;
  ghl_created_at: string | null;
  created_at: string;
  data_reuniao_agendada: string | null;
  data_proposta_enviada: string | null;
  data_comprou: string | null;
  data_assinatura: string | null;
  nome: string | null;
}

interface FunilData {
  counts: Record<FunilKey, number>;
  tempoMedio: Record<string, number>;
}

function computeFunil(leadsComAd: Pick<CrmLead, "etapa" | "data_reuniao_agendada" | "data_proposta_enviada" | "data_comprou" | "data_assinatura" | "ghl_created_at" | "created_at">[]): FunilData {
  const counts: Record<FunilKey, number> = {
    leads: leadsComAd.length,
    qualificados: 0,
    reunioes_agendadas: 0,
    reunioes_realizadas: 0,
    propostas: 0,
    fechados: 0,
  };

  const tempos: Record<string, number[]> = {
    lead_to_qualif: [],
    qualif_to_reuniao: [],
    reuniao_to_realizada: [],
    realizada_to_proposta: [],
    proposta_to_fechado: [],
  };

  for (const lead of leadsComAd) {
    const etapa = lead.etapa;
    if (ETAPA_QUALIFICADO.includes(etapa)) counts.qualificados++;
    if (ETAPA_REUNIAO_AGENDADA.includes(etapa) || lead.data_reuniao_agendada) counts.reunioes_agendadas++;
    if (ETAPA_REUNIAO_REALIZADA.includes(etapa)) counts.reunioes_realizadas++;
    if (ETAPA_PROPOSTA.includes(etapa) || lead.data_proposta_enviada) counts.propostas++;
    if (ETAPA_FECHADO.includes(etapa)) counts.fechados++;

    const criacao = lead.ghl_created_at || lead.created_at;
    if (criacao && lead.data_reuniao_agendada) {
      const d = diasEntre(criacao, lead.data_reuniao_agendada);
      if (d >= 0) tempos.lead_to_qualif.push(d);
    }
    if (lead.data_reuniao_agendada && lead.data_proposta_enviada) {
      const d = diasEntre(lead.data_reuniao_agendada, lead.data_proposta_enviada);
      if (d >= 0) tempos.qualif_to_reuniao.push(d);
    }
    if (lead.data_proposta_enviada && (lead.data_comprou || lead.data_assinatura)) {
      const d = diasEntre(lead.data_proposta_enviada, lead.data_comprou || lead.data_assinatura!);
      if (d >= 0) tempos.proposta_to_fechado.push(d);
    }
  }

  const tempoMedio: Record<string, number> = {};
  for (const [key, vals] of Object.entries(tempos)) {
    if (vals.length > 0) tempoMedio[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  return { counts, tempoMedio };
}

function diasEntre(a: string | null, b: string | null): number {
  if (!a || !b) return -1;
  return (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}

// ── Component ──

export default function FunilClientePageWrapper() {
  return (
    <FunilErrorBoundary>
      <FunilClienteContent />
    </FunilErrorBoundary>
  );
}

function FunilClienteContent() {
  const filters = usePeriodoTrafego();
  const { data: tData, isLoading: loadingTrafego } = useTrafegoData(filters.dataInicio, filters.dataFim, filters.statusFiltro);
  const { totalSpend, isLoading: loadingSpend } = useAccountSpend(filters.dataInicio, filters.dataFim);

  const metadata = tData?.metadata || [];
  const performance = tData?.performance || [];

  // Buscar leads_crm com ad_id
  const { data: crmLeads, isLoading: loadingCrm } = useSWR(
    ["funil-crm-leads", filters.dataInicio, filters.dataFim],
    async () => {
      const { data } = await supabase
        .from("leads_crm")
        .select("id, ad_id, campaign_id, campaign_name, adset_id, adset_name, etapa, ghl_created_at, created_at, data_reuniao_agendada, data_proposta_enviada, data_comprou, data_assinatura, nome")
        .not("ad_id", "is", null)
        .gte("ghl_created_at", filters.dataInicio + "T00:00:00")
        .lte("ghl_created_at", filters.dataFim + "T23:59:59")
        .limit(5000);
      return (data || []) as CrmLead[];
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  // Período anterior para comparativo
  const dias = Math.ceil((new Date(filters.dataFim).getTime() - new Date(filters.dataInicio).getTime()) / 86400000) + 1;
  const prevFim = new Date(new Date(filters.dataInicio).getTime() - 86400000);
  const prevInicio = new Date(prevFim.getTime() - (dias - 1) * 86400000);
  const prevInicioStr = prevInicio.toISOString().split("T")[0];
  const prevFimStr = prevFim.toISOString().split("T")[0];

  const { data: prevCrmLeads, isLoading: loadingPrev } = useSWR(
    ["funil-crm-leads-prev", prevInicioStr, prevFimStr],
    async () => {
      const { data } = await supabase
        .from("leads_crm")
        .select("id, ad_id, etapa, ghl_created_at, created_at, data_reuniao_agendada, data_proposta_enviada, data_comprou, data_assinatura")
        .not("ad_id", "is", null)
        .gte("ghl_created_at", prevInicioStr + "T00:00:00")
        .lte("ghl_created_at", prevFimStr + "T23:59:59")
        .limit(5000);
      return data || [];
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const { totalSpend: prevSpend } = useAccountSpend(prevInicioStr, prevFimStr);

  // ── Filtros locais: campanha multi-select ──
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  const [showCampaignFilter, setShowCampaignFilter] = useState(false);

  const allLeads = crmLeads || [];
  const prevLeads = prevCrmLeads || [];

  // Campanhas disponíveis para filtro
  const availableCampaigns = useMemo(() => {
    const map = new Map<string, string>();
    for (const lead of allLeads) {
      if (lead.campaign_id && lead.campaign_name) {
        map.set(lead.campaign_id, lead.campaign_name);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allLeads]);

  // Aplicar filtro de campanha
  const leads = useMemo(() => {
    if (selectedCampaigns.size === 0) return allLeads;
    return allLeads.filter(l => l.campaign_id && selectedCampaigns.has(l.campaign_id));
  }, [allLeads, selectedCampaigns]);

  const loading = loadingTrafego || loadingSpend || loadingCrm || loadingPrev;

  // Funil atual e anterior
  const funil = useMemo(() => computeFunil(leads), [leads]);
  const funilPrev = useMemo(() => computeFunil(prevLeads), [prevLeads]);

  // Detectar gargalo (maior drop percentual entre estágios consecutivos)
  const gargaloIdx = useMemo(() => {
    let maxDrop = -1;
    let idx = -1;
    const keys = FUNIL_ESTAGIOS.map(e => e.key);
    for (let i = 1; i < keys.length; i++) {
      const prev = funil.counts[keys[i - 1]];
      const curr = funil.counts[keys[i]];
      if (prev > 0) {
        const drop = 1 - curr / prev;
        if (drop > maxDrop) { maxDrop = drop; idx = i; }
      }
    }
    return idx;
  }, [funil.counts]);

  // Métricas derivadas
  const metricas = useMemo(() => {
    const c = funil.counts;
    return {
      cpql: c.qualificados > 0 ? totalSpend / c.qualificados : 0,
      cpar: c.reunioes_agendadas > 0 ? totalSpend / c.reunioes_agendadas : 0,
      cprr: c.reunioes_realizadas > 0 ? totalSpend / c.reunioes_realizadas : 0,
      cac: c.fechados > 0 ? totalSpend / c.fechados : 0,
      showRate: c.reunioes_agendadas > 0 ? (c.reunioes_realizadas / c.reunioes_agendadas) * 100 : 0,
      taxaQualif: c.leads > 0 ? (c.qualificados / c.leads) * 100 : 0,
    };
  }, [funil.counts, totalSpend]);

  const metricasPrev = useMemo(() => {
    const c = funilPrev.counts;
    return {
      cpql: c.qualificados > 0 ? prevSpend / c.qualificados : 0,
      cpar: c.reunioes_agendadas > 0 ? prevSpend / c.reunioes_agendadas : 0,
      cprr: c.reunioes_realizadas > 0 ? prevSpend / c.reunioes_realizadas : 0,
      cac: c.fechados > 0 ? prevSpend / c.fechados : 0,
      showRate: c.reunioes_agendadas > 0 ? (c.reunioes_realizadas / c.reunioes_agendadas) * 100 : 0,
      taxaQualif: c.leads > 0 ? (c.qualificados / c.leads) * 100 : 0,
    };
  }, [funilPrev.counts, prevSpend]);

  // Campanha breakdown
  const campanhas = useMemo(() => {
    const map = new Map<string, { id: string; name: string; leads: number; qualif: number; reunioes: number; fechados: number; spend: number }>();
    for (const lead of leads) {
      const cid = lead.campaign_id || "sem_campanha";
      const cname = lead.campaign_name || "Sem campanha";
      if (!map.has(cid)) map.set(cid, { id: cid, name: cname, leads: 0, qualif: 0, reunioes: 0, fechados: 0, spend: 0 });
      const c = map.get(cid)!;
      c.leads++;
      if (ETAPA_QUALIFICADO.includes(lead.etapa)) c.qualif++;
      if (ETAPA_REUNIAO_AGENDADA.includes(lead.etapa) || lead.data_reuniao_agendada) c.reunioes++;
      if (ETAPA_FECHADO.includes(lead.etapa)) c.fechados++;
    }
    for (const [cid, c] of map) {
      const campMeta = metadata.filter(m => m.campaign_id === cid);
      const campAdIds = new Set(campMeta.map(m => m.ad_id));
      c.spend = performance.filter(p => campAdIds.has(p.ad_id)).reduce((s, p) => s + Number(p.spend), 0);
    }
    return Array.from(map.values()).sort((a, b) => b.leads - a.leads);
  }, [leads, metadata, performance]);

  // Toggle campanha no filtro
  const toggleCampaign = (cid: string) => {
    setSelectedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="space-y-1">
          {[100, 82, 64, 48, 32, 18].map((w, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-40 h-4 bg-muted rounded animate-pulse" />
              <div className="flex-1 h-16 bg-muted rounded-xl animate-pulse" style={{ maxWidth: `${w}%` }} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (allLeads.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Funil de Tráfego Pago</h1>
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhum dado de funil encontrado para o período selecionado.</p>
            <p className="text-sm text-muted-foreground/70 mt-2">Leads com <code className="bg-muted px-1.5 py-0.5 rounded text-xs">ad_id</code> aparecerão aqui quando chegarem via tráfego pago.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tempoLabels: Record<string, string> = {
    lead_to_qualif: "Lead \u2192 Qualificação",
    qualif_to_reuniao: "Qualif. \u2192 Reunião",
    reuniao_to_realizada: "Agendada \u2192 Realizada",
    realizada_to_proposta: "Realizada \u2192 Proposta",
    proposta_to_fechado: "Proposta \u2192 Fechamento",
  };

  return (
    <div className="space-y-6">
      {/* Header + Filtros */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Funil de Tráfego Pago</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {leads.length} leads no período · Investimento: {formatCurrency(totalSpend)}
            {selectedCampaigns.size > 0 && (
              <span className="ml-2 text-primary font-medium">
                ({selectedCampaigns.size} campanha{selectedCampaigns.size > 1 ? "s" : ""} filtrada{selectedCampaigns.size > 1 ? "s" : ""})
              </span>
            )}
          </p>
        </div>

        {/* Filtro de campanha */}
        <div className="relative">
          <button
            onClick={() => setShowCampaignFilter(!showCampaignFilter)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              selectedCampaigns.size > 0
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Filter size={12} />
            Campanhas
            {selectedCampaigns.size > 0 && (
              <>
                <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0">{selectedCampaigns.size}</Badge>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedCampaigns(new Set()); }}
                  className="hover:text-destructive"
                >
                  <X size={10} />
                </button>
              </>
            )}
          </button>

          {showCampaignFilter && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-lg shadow-lg p-2 w-80 max-h-64 overflow-auto">
              {availableCampaigns.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">Nenhuma campanha encontrada</p>
              ) : (
                availableCampaigns.map(([cid, cname]) => (
                  <label
                    key={cid}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCampaigns.has(cid)}
                      onChange={() => toggleCampaign(cid)}
                      className="rounded border-border"
                    />
                    <span className="truncate">{cname}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ FUNIL VISUAL ══ */}
      <Card className="overflow-hidden">
        <CardContent className="py-6 px-4 md:px-8">
          <div className="space-y-0">
            {FUNIL_ESTAGIOS.map((etapa, i) => {
              const count = funil.counts[etapa.key];
              const prevStageCount = i > 0 ? funil.counts[FUNIL_ESTAGIOS[i - 1].key] : count;
              const taxaConversao = i > 0 && prevStageCount > 0 ? (count / prevStageCount) * 100 : 100;
              const dropPct = i > 0 && prevStageCount > 0 ? ((prevStageCount - count) / prevStageCount) * 100 : 0;
              const widthPct = funil.counts.leads > 0 ? Math.max(12, (count / funil.counts.leads) * 100) : 12;
              const isGargalo = i === gargaloIdx;
              const Icon = etapa.icon;

              // Delta vs período anterior
              const prevVal = funilPrev.counts[etapa.key];
              const delta = prevVal > 0 ? ((count - prevVal) / prevVal) * 100 : count > 0 ? 100 : 0;

              return (
                <div key={etapa.key}>
                  {/* Drop indicator entre estágios */}
                  {i > 0 && (
                    <div className="flex items-center gap-4 py-1.5">
                      <div className="w-40 shrink-0" />
                      <div className="flex-1 flex items-center gap-2">
                        {isGargalo ? (
                          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                            <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                            <span className="text-xs font-bold text-amber-400">
                              -{dropPct.toFixed(0)}% de perda · {taxaConversao.toFixed(0)}% passam
                            </span>
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px] font-bold">GARGALO</Badge>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
                            <div className="w-4 border-l-2 border-b-2 border-muted-foreground/20 h-3 rounded-bl" />
                            <span>{taxaConversao.toFixed(0)}% passam</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Barra do estágio */}
                  <div className={`flex items-center gap-4 ${isGargalo ? "relative" : ""}`}>
                    {/* Gargalo background glow */}
                    {isGargalo && (
                      <div className="absolute inset-0 -mx-2 rounded-xl bg-amber-500/5 border border-amber-500/10" />
                    )}

                    <div className="w-40 flex items-center gap-2 justify-end shrink-0 relative z-10">
                      <Icon size={14} className={isGargalo ? "text-amber-400 shrink-0" : "text-muted-foreground shrink-0"} />
                      <span className={`text-xs text-right font-medium leading-tight ${isGargalo ? "text-amber-400" : "text-muted-foreground"}`}>
                        {etapa.label}
                      </span>
                    </div>

                    <div className="flex-1 relative z-10">
                      <div
                        className={`relative h-16 rounded-xl flex items-center justify-between px-5 text-white transition-all ${
                          isGargalo ? "ring-2 ring-amber-400/60 ring-offset-2 ring-offset-background shadow-[0_0_20px_rgba(245,158,11,0.15)]" : ""
                        }`}
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: isGargalo ? "#d97706" : etapa.cor,
                          minWidth: "140px",
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-xl font-black leading-none">{count}</span>
                          {i > 0 && (
                            <span className="text-[10px] font-medium opacity-70 mt-0.5">{taxaConversao.toFixed(0)}% conv.</span>
                          )}
                        </div>

                        {/* Tempo médio no estágio (se disponível) */}
                        {i > 0 && (() => {
                          const tempoKeys = ["lead_to_qualif", "qualif_to_reuniao", "reuniao_to_realizada", "realizada_to_proposta", "proposta_to_fechado"];
                          const tk = tempoKeys[i - 1];
                          const t = tk ? funil.tempoMedio[tk] : undefined;
                          if (t === undefined) return null;
                          return (
                            <span className="text-[10px] font-mono opacity-60">
                              {t < 1 ? `${Math.round(t * 24)}h` : `${t.toFixed(1)}d`}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Delta vs anterior */}
                    <div className="w-20 shrink-0 relative z-10">
                      {(prevVal > 0 || count > 0) && <DeltaBadge delta={delta} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tempo médio entre etapas (resumo) */}
          {Object.keys(funil.tempoMedio).length > 0 && (
            <div className="mt-6 pt-4 border-t border-border/30">
              <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-widest">Tempo Médio entre Etapas</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(funil.tempoMedio).map(([key, d]) => (
                  <Badge key={key} variant="outline" className="text-xs font-mono">
                    {tempoLabels[key] || key}: {d < 1 ? `${Math.round(d * 24)}h` : `${d.toFixed(1)}d`}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══ MÉTRICAS DERIVADAS ══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricaCard
          label="CPQL"
          sublabel="Custo por Lead Qualificado"
          value={metricas.cpql > 0 ? formatCurrency(metricas.cpql) : "\u2014"}
          prev={metricasPrev.cpql}
          curr={metricas.cpql}
          invertDelta
          destaque
          icon={DollarSign}
        />
        <MetricaCard
          label="CPAR"
          sublabel="Custo por Reunião Agendada"
          value={metricas.cpar > 0 ? formatCurrency(metricas.cpar) : "\u2014"}
          prev={metricasPrev.cpar}
          curr={metricas.cpar}
          invertDelta
          icon={DollarSign}
        />
        <MetricaCard
          label="CPRR"
          sublabel="Custo por Reunião Realizada"
          value={metricas.cprr > 0 ? formatCurrency(metricas.cprr) : "\u2014"}
          prev={metricasPrev.cprr}
          curr={metricas.cprr}
          invertDelta
          icon={DollarSign}
        />
        <MetricaCard
          label="CAC Real"
          sublabel="Custo por Cliente"
          value={metricas.cac > 0 ? formatCurrency(metricas.cac) : "\u2014"}
          prev={metricasPrev.cac}
          curr={metricas.cac}
          invertDelta
          icon={Target}
        />
        <MetricaCard
          label="Show Rate"
          sublabel="Realizadas / Agendadas"
          value={metricas.showRate > 0 ? formatPercent(metricas.showRate) : "\u2014"}
          prev={metricasPrev.showRate}
          curr={metricas.showRate}
          icon={Activity}
        />
        <MetricaCard
          label="Taxa Qualif."
          sublabel="Qualificados / Leads"
          value={metricas.taxaQualif > 0 ? formatPercent(metricas.taxaQualif) : "\u2014"}
          prev={metricasPrev.taxaQualif}
          curr={metricas.taxaQualif}
          icon={UserCheck}
        />
      </div>

      {/* ══ BREAKDOWN POR CAMPANHA ══ */}
      {campanhas.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border/30">
              <p className="text-sm font-bold">Performance por Campanha</p>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-4 py-2 text-left text-xs font-medium">Campanha</th>
                    <th className="px-4 py-2 text-right text-xs font-medium">Leads</th>
                    <th className="px-4 py-2 text-right text-xs font-medium">Qualif.</th>
                    <th className="px-4 py-2 text-right text-xs font-medium">Taxa Qualif.</th>
                    <th className="px-4 py-2 text-right text-xs font-medium">Reuniões</th>
                    <th className="px-4 py-2 text-right text-xs font-medium">Fechados</th>
                    <th className="px-4 py-2 text-right text-xs font-medium">Invest.</th>
                    <th className="px-4 py-2 text-right text-xs font-medium">CPQL</th>
                    <th className="px-4 py-2 text-right text-xs font-medium">CAC</th>
                  </tr>
                </thead>
                <tbody>
                  {campanhas.map((c, i) => {
                    const taxaQ = c.leads > 0 ? (c.qualif / c.leads) * 100 : 0;
                    const cpql = c.qualif > 0 ? c.spend / c.qualif : 0;
                    const cac = c.fechados > 0 ? c.spend / c.fechados : 0;
                    return (
                      <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                        <td className="px-4 py-2 text-xs font-medium max-w-[250px]">
                          <div className="truncate">{c.name}</div>
                        </td>
                        <td className="px-4 py-2 text-xs text-right font-bold">{c.leads}</td>
                        <td className="px-4 py-2 text-xs text-right">{c.qualif}</td>
                        <td className={`px-4 py-2 text-xs text-right font-medium ${taxaQ >= 40 ? "text-emerald-400" : taxaQ >= 20 ? "text-amber-400" : "text-red-400"}`}>
                          {formatPercent(taxaQ)}
                        </td>
                        <td className="px-4 py-2 text-xs text-right">{c.reunioes}</td>
                        <td className="px-4 py-2 text-xs text-right font-bold">{c.fechados}</td>
                        <td className="px-4 py-2 text-xs text-right">{c.spend > 0 ? formatCurrency(c.spend) : "\u2014"}</td>
                        <td className="px-4 py-2 text-xs text-right">{cpql > 0 ? formatCurrency(cpql) : "\u2014"}</td>
                        <td className="px-4 py-2 text-xs text-right">{cac > 0 ? formatCurrency(cac) : "\u2014"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Componentes auxiliares ──

function DeltaBadge({ delta }: { delta: number }) {
  if (!isFinite(delta) || delta === 0) return null;
  const isPositive = delta > 0;
  return (
    <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      <span>{isPositive ? "+" : ""}{delta.toFixed(0)}%</span>
    </div>
  );
}

function MetricaCard({
  label, sublabel, value, prev, curr, invertDelta, destaque, icon: Icon,
}: {
  label: string;
  sublabel: string;
  value: string;
  prev: number;
  curr: number;
  invertDelta?: boolean;
  destaque?: boolean;
  icon: React.ElementType;
}) {
  const rawDelta = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
  const isGood = invertDelta ? rawDelta <= 0 : rawDelta >= 0;

  return (
    <Card className={destaque ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="py-4 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[10px] uppercase font-bold tracking-widest ${destaque ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
          <Icon size={14} className={destaque ? "text-primary" : "text-muted-foreground/50"} />
        </div>
        <p className={`text-xl font-black ${destaque ? "text-primary" : ""}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>
        {prev > 0 && curr > 0 && (
          <div className={`mt-2 flex items-center gap-1 text-[11px] font-medium ${isGood ? "text-emerald-400" : "text-red-400"}`}>
            {rawDelta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            <span>{rawDelta > 0 ? "+" : ""}{rawDelta.toFixed(0)}% vs anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
