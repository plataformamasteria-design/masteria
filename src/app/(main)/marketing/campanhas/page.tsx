"use client";

import { useEffect, useState, useMemo, useCallback, Fragment, lazy, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { TabelaInteligencia } from "@/components/trafego/TabelaInteligencia";
import { DrillDownEntidade } from "@/components/trafego/DrillDownEntidade";
import type { MetricaEntidade } from "@/lib/metricas/por-entidade";
import type { AdsMetadata, AdsPerformance, LeadAdsAttribution } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, formatRoas } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import { usePeriodoTrafego } from "@/contexts/periodo-trafego-context";
import {
  ChevronDown, ChevronRight, Trophy, Brain, Loader2, RefreshCw,
  Users, Target, Sparkles, Globe, UserCheck, TrendingUp, DollarSign, ArrowUpDown,
  Smartphone, Monitor, Tablet, MapPin, Calendar, Radio,
  Image as ImageIcon, Video, Layers as LayersIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTrafegoData } from "@/hooks/use-trafego-data";
import { useAccountSpend } from "@/hooks/use-account-spend";
import { useAudiencesEngine } from "@/hooks/use-audiences-engine";
import { IAModelSelector } from "@/components/ia-model-selector";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useConfigFunilCampanha, FunilCampanhaPopover, FunilBadge } from "@/components/trafego/FunilCampanhaConfig";
import { AdDetailDrawer } from "@/components/trafego/AdDetailDrawer";
import type { AdDetailData } from "@/components/trafego/AdDetailDrawer";
import { ConjuntoAlertBadge, ConjuntoAlertSummary, calcConjuntoAlert } from "@/components/trafego/ConjuntoAlertBadge";
import type { ConjuntoAlertResult } from "@/components/trafego/ConjuntoAlertBadge";

/* ========== LAZY IMPORTS ========== */
const LazyEstrutura = lazy(() => import("@/app/(main)/marketing/estrutura/_estrutura-content"));
const LazyGerenciar = lazy(() => import("@/app/(main)/marketing/gerenciar/_gerenciar-content"));

function TabFallback() {
  return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;
}

/* ========== LOCALSTORAGE KEYS ========== */
const EXPANDED_STORAGE_KEY = "campanhas_expanded_ids";
const ADSET_EXPANDED_STORAGE_KEY = "adsets_expanded_ids";

function loadExpandedState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(EXPANDED_STORAGE_KEY) || "{}");
  } catch { return {}; }
}
function saveExpandedState(state: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(state));
}
function loadAdsetExpandedState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ADSET_EXPANDED_STORAGE_KEY) || "{}");
  } catch { return {}; }
}
function saveAdsetExpandedState(state: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADSET_EXPANDED_STORAGE_KEY, JSON.stringify(state));
}

/* ========== CRM Tooltip ========== */
const CRM_TOOLTIP = "Dados de CRM não vinculados a esta campanha";

function CrmDash() {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground cursor-help">—</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {CRM_TOOLTIP}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ========== PUBLICOS TYPES & CONFIG ========== */
interface DemographicRow { label: string; sublabel?: string; spend: number; impressions: number; clicks: number; leads: number; cpl: number; ctr: number; cpc: number; qualificados_est?: number; taxa_qualificacao_est?: number | null; reunioes_realizadas_est?: number; contratos_est?: number | null; mrr_gerado_est?: number | null; cac_est?: number | null; roas_cash_est?: number | null; estimado?: true; }

const TIPO_CONFIG: Record<string, { label: string; icon: typeof Users; color: string; bg: string }> = {
  interest: { label: "Interesse", icon: Sparkles, color: "text-violet-400", bg: "bg-violet-500/10" },
  behavior: { label: "Comportamento", icon: TrendingUp, color: "text-sky-400", bg: "bg-sky-500/10" },
  custom_audience: { label: "Público Personalizado", icon: UserCheck, color: "text-primary", bg: "bg-primary/10" },
  lookalike: { label: "Lookalike", icon: Users, color: "text-amber-400", bg: "bg-amber-500/10" },
};

const SUB_TABS = [
  { id: "audiences", label: "Públicos", icon: Users },
  { id: "age_gender", label: "Idade & Gênero", icon: Calendar },
  { id: "region", label: "Localização", icon: MapPin },
  { id: "device", label: "Dispositivo", icon: Smartphone },
  { id: "platform", label: "Plataforma", icon: Globe },
  { id: "placement", label: "Posicionamento", icon: Radio },
] as const;
type SubTab = typeof SUB_TABS[number]["id"];

function BarRow({ label, value, max, color, extra }: { label: string; sublabel?: string; value: number; max: number; color: string; extra?: React.ReactNode }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2 group hover:bg-muted/10 dark:hover:bg-white/[0.02] px-3 rounded-lg transition-colors">
      <div className="w-[140px] shrink-0">
        <p className="text-xs font-medium truncate" title={label}>{label}</p>
      </div>
      <div className="flex-1 h-7 bg-muted/20 dark:bg-white/[0.03] rounded-md overflow-hidden relative">
        <div className={cn("h-full rounded-md transition-all duration-500 flex items-center px-2", color)} style={{ width: `${Math.max(pct, 2)}%` }}>
          {pct > 15 && <span className="text-[10px] text-foreground font-bold">{pct.toFixed(1)}%</span>}
        </div>
      </div>
      <div className="w-[200px] shrink-0 flex gap-3 justify-end">
        {extra}
      </div>
    </div>
  );
}

function renderLeadsWithObjective(num: number, objective?: string | null) {
  if (!num || num === 0) return "0";
  const obj = (objective || "").toUpperCase();
  if (obj.includes("LEAD")) return <span className="flex justify-end items-center gap-1">{num}<span className="text-[9px] text-foreground/50 font-normal tracking-wide uppercase">leads</span></span>;
  if (obj.includes("SALE") || obj.includes("CONVERSION") || obj.includes("PURCHASE")) return <span className="flex justify-end items-center gap-1">{num}<span className="text-[9px] text-foreground/50 font-normal tracking-wide uppercase">compras</span></span>;
  if (obj.includes("ENGAGEMENT") || obj.includes("MESSAGE")) return <span className="flex justify-end items-center gap-1">{num}<span className="text-[9px] text-foreground/50 font-normal tracking-wide uppercase">msg</span></span>;
  if (obj.includes("TRAFFIC") || obj.includes("LINK_CLICK")) return <span className="flex justify-end items-center gap-1">{num}<span className="text-[9px] text-foreground/50 font-normal tracking-wide uppercase">cliques</span></span>;
  return num;
}

function renderStatusBadge(status: string) {
  const upper = (status || "").toUpperCase();
  if (upper === "ACTIVE") return <Badge className="text-[10px] bg-green-500/20 text-green-400">Ativo</Badge>;
  if (upper === "COMPLETED") return <Badge className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 border">Concluído</Badge>;
  return <Badge className="text-[10px] bg-muted text-muted-foreground">{upper.replace(/_/g, " ")}</Badge>;
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
      <p className="text-xs font-semibold">{value}</p>
    </div>
  );
}

/* ========== ANUNCIOS INLINE (level 3) ========== */
function AnunciosInline({ adsetId, metadata, performance, attrLeads, somenteComDados, onAdClick }: {
  adsetId: string;
  metadata: AdsMetadata[];
  performance: AdsPerformance[];
  attrLeads: import("@/hooks/use-trafego-data").AttrLead[];
  somenteComDados: boolean;
  onAdClick: (ad: AdDetailData) => void;
}) {
  const { avgSpend, avgLeads, avgCpl, avgCtr, adRows } = useMemo(() => {
    const adsInAdset = metadata.filter((m) => m.adset_id === adsetId);
    const rows = adsInAdset.map((ad) => {
      const perfs = performance.filter((p) => p.ad_id === ad.ad_id);
      const lds = attrLeads.filter((l) => l.ad_id === ad.ad_id);
      const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
      const impressoes = perfs.reduce((s, p) => s + p.impressoes, 0);
      const cliques = perfs.reduce((s, p) => s + p.cliques, 0);
      const alcance = perfs.reduce((s, p) => s + Number((p as any).reach || 0), 0);
      const leadsCount = lds.length;
      const qualificados = lds.filter((l) => l.foi_qualificado).length;
      const cpl = leadsCount > 0 ? spend / leadsCount : 0;
      const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
      const taxaQualif = leadsCount > 0 ? (qualificados / leadsCount) * 100 : 0;
      const reunioesAgendadas = lds.filter((l) => l.teve_reuniao_agendada).length;
      const reunioesFeitas = lds.filter((l) => l.teve_reuniao_realizada).length;
      const cprf = reunioesFeitas > 0 ? spend / reunioesFeitas : 0;
      const showRate = reunioesAgendadas > 0 ? (reunioesFeitas / reunioesAgendadas) * 100 : 0;
      const frequencia = impressoes > 0 && alcance > 0 ? impressoes / alcance : 0;
      const mql = lds.filter((l) => l.foi_qualificado).length; // simplified MQL
      const pctMql = leadsCount > 0 ? (mql / leadsCount) * 100 : 0;
      const status = ad.status || "";
      const objetivo = ad.objetivo || "";
      const thumbnail = ad.thumbnail_url || ad.image_url || null;
      return {
        ad_id: ad.ad_id, ad_name: ad.ad_name, campaign_name: ad.campaign_name,
        campaign_id: ad.campaign_id, adset_name: ad.adset_name, adset_id: ad.adset_id,
        status, objetivo, thumbnail_url: thumbnail,
        spend, leads: leadsCount, cpl, ctr, impressoes, alcance, frequencia,
        qualificados, taxaQualif, reunioesAgendadas, reunioesFeitas, showRate, cprf,
        mql, pctMql,
      };
    }).filter((a) => !somenteComDados || a.spend > 0).sort((a, b) => b.spend - a.spend);

    const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
    const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
    const totalImpressoes = rows.reduce((s, r) => s + r.impressoes, 0);
    const totalCliques = rows.reduce((s, r) => s + (r.impressoes > 0 ? r.impressoes * r.ctr / 100 : 0), 0);
    const count = rows.filter(r => r.spend > 0).length || 1;
    return {
      adRows: rows,
      avgSpend: totalSpend / count,
      avgLeads: totalLeads / count,
      avgCpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
      avgCtr: totalImpressoes > 0 ? (totalCliques / totalImpressoes) * 100 : 0,
    };
  }, [adsetId, metadata, performance, attrLeads, somenteComDados]);

  if (adRows.length === 0) {
    return <p className="text-xs text-muted-foreground py-2 pl-14">Nenhum anuncio encontrado.</p>;
  }

  return (
    <>
      {adRows.map((ad) => (
        <tr key={ad.ad_id} className="hover:bg-muted/10 transition-colors border-b border-dashed border-muted-foreground/10">
          <td className="px-3 py-2 text-xs font-medium max-w-[200px] pl-16 relative">
            <span className="absolute left-6 top-0 bottom-0 w-px border-l border-dashed border-muted-foreground/20" />
            <span className="absolute left-10 top-0 bottom-0 w-px border-l border-dashed border-muted-foreground/15" />
            <div className="flex items-center gap-2">
              {ad.thumbnail_url ? (
                <img src={ad.thumbnail_url} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded bg-muted/40 flex items-center justify-center shrink-0">
                  <ImageIcon size={10} className="text-muted-foreground/40" />
                </div>
              )}
              <button
                onClick={() => onAdClick({ ...ad, creative_type: null, avgSpend, avgLeads, avgCpl, avgCtr })}
                className="truncate text-left hover:text-primary hover:underline transition-colors"
                title={ad.ad_name || ad.ad_id}
              >
                {ad.ad_name || ad.ad_id}
              </button>
            </div>
          </td>
          <td className="px-3 py-2 text-right text-xs font-bold">{renderLeadsWithObjective(ad.leads, ad.objetivo)}</td>
          <td className="px-3 py-2 text-right text-xs">{ad.leads > 0 ? formatCurrency(ad.cpl) : "—"}</td>
          <td className="px-3 py-2 text-right text-xs">{formatCurrency(ad.spend)}</td>
          <td className="px-3 py-2 text-right text-xs">{ad.qualificados > 0 ? ad.qualificados : <CrmDash />}</td>
          <td className={cn("px-3 py-2 text-right text-xs font-medium",
            ad.taxaQualif >= 50 ? "text-green-400" : ad.taxaQualif >= 30 ? "text-yellow-400" : ad.leads > 0 ? "text-destructive" : "text-muted-foreground"
          )}>
            {ad.leads > 0 ? formatPercent(ad.taxaQualif) : <CrmDash />}
          </td>
          <td className="px-3 py-2 text-right text-xs">{ad.reunioesAgendadas || <CrmDash />}</td>
          <td className="px-3 py-2 text-right text-xs">{ad.reunioesFeitas || <CrmDash />}</td>
          <td className="px-3 py-2 text-right text-xs">{ad.cprf > 0 ? formatCurrency(ad.cprf) : <CrmDash />}</td>
          <td className="px-3 py-2 text-right text-xs">{ad.mql > 0 ? ad.mql : "—"}</td>
          <td className="px-3 py-2 text-right text-xs">{/* alerta: n/a para anúncios */}</td>
          <td className="px-3 py-2 text-center">
            {renderStatusBadge(ad.status)}
          </td>
        </tr>
      ))}
    </>
  );
}

/* ========== CONJUNTOS INLINE (level 2 — lazy loaded) ========== */
function ConjuntosInline({ campaignId, campaignName, metadata, performance, attrLeads, somenteComDados, metaCpl, mediaContaTaxaQualif, onAdClick }: {
  campaignId: string;
  campaignName: string;
  metadata: AdsMetadata[];
  performance: AdsPerformance[];
  attrLeads: import("@/hooks/use-trafego-data").AttrLead[];
  somenteComDados: boolean;
  metaCpl: number;
  mediaContaTaxaQualif: number;
  onAdClick: (ad: AdDetailData) => void;
}) {
  const [adsetExpanded, setAdsetExpanded] = useState<Record<string, boolean>>(() => loadAdsetExpandedState());

  const toggleAdsetExpand = useCallback((asId: string) => {
    setAdsetExpanded((prev) => {
      const next = { ...prev, [asId]: !prev[asId] };
      saveAdsetExpandedState(next);
      return next;
    });
  }, []);

  const { adsetData, alerts } = useMemo(() => {
    const adsInCamp = metadata.filter((m) => m.campaign_id === campaignId);
    const adsetMap = new Map<string, AdsMetadata[]>();
    adsInCamp.forEach((m) => {
      if (m.adset_id) {
        const arr = adsetMap.get(m.adset_id) || [];
        arr.push(m);
        adsetMap.set(m.adset_id, arr);
      }
    });

    const data = Array.from(adsetMap, ([asid, ads]) => {
      const adIds = ads.map((a) => a.ad_id);
      const perfs = performance.filter((p) => adIds.includes(p.ad_id));
      const lds = attrLeads.filter((l) => l.adset_id === asid);
      const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
      const impressoes = perfs.reduce((s, p) => s + p.impressoes, 0);
      const cliques = perfs.reduce((s, p) => s + p.cliques, 0);
      const leadsCount = lds.length;
      const qualificados = lds.filter((l) => l.foi_qualificado).length;
      const cpl = leadsCount > 0 ? spend / leadsCount : 0;
      const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
      const taxaQualif = leadsCount > 0 ? (qualificados / leadsCount) * 100 : 0;
      const reunioesAgendadas = lds.filter((l) => l.teve_reuniao_agendada).length;
      const reunioesFeitas = lds.filter((l) => l.teve_reuniao_realizada).length;
      const fechados = lds.filter((l) => l.virou_cliente).length;
      const taxaFechamento = leadsCount > 0 ? (fechados / leadsCount) * 100 : 0;
      const cprf = reunioesFeitas > 0 ? spend / reunioesFeitas : 0;
      const mql = qualificados; // MQL = qualificados for now
      const status = ads[0]?.status || "";
      const objetivo = ads[0]?.objetivo || "";
      const adsCount = ads.length;
      const alert = calcConjuntoAlert(spend, leadsCount, qualificados, cpl, metaCpl, taxaQualif, mediaContaTaxaQualif);
      return { id: asid, nome: ads[0]?.adset_name || asid, spend, leadsCount, qualificados, cpl, ctr, taxaQualif, reunioesAgendadas, reunioesFeitas, cprf, fechados, taxaFechamento, mql, status, objetivo, adsCount, alert };
    }).filter((as) => !somenteComDados || as.spend > 0).sort((a, b) => b.spend - a.spend);

    return { adsetData: data, alerts: data.map(d => d.alert) };
  }, [campaignId, metadata, performance, attrLeads, somenteComDados, metaCpl, mediaContaTaxaQualif]);

  if (adsetData.length === 0) {
    return <p className="text-xs text-muted-foreground py-3 pl-6">Nenhum conjunto encontrado para esta campanha.</p>;
  }

  return (
    <div className="space-y-2">
      <ConjuntoAlertSummary alerts={alerts} />
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b border-dashed border-muted-foreground/20">
            <th className="px-3 py-1.5 text-left font-medium text-[10px] pl-10">Conjunto</th>
            <th className="px-3 py-1.5 text-right font-medium text-[10px]">Leads</th>
            <th className="px-3 py-1.5 text-right font-medium text-[10px]">CPL</th>
            <th className="px-3 py-1.5 text-right font-medium text-[10px]">Investido</th>
            <th className="px-3 py-1.5 text-right font-medium text-[10px]">Qualif.</th>
            <th className="px-3 py-1.5 text-right font-medium text-[10px]">% Qualif</th>
            <th className="px-3 py-1.5 text-right font-medium text-[10px]">Reun. Ag.</th>
            <th className="px-3 py-1.5 text-right font-medium text-[10px]">Reun. Feitas</th>
            <th className="px-3 py-1.5 text-right font-medium text-[10px]">CPRF</th>
            <th className="px-3 py-1.5 text-right font-medium text-[10px]">MQL</th>
            <th className="px-3 py-1.5 text-right font-medium text-[10px]">Alerta</th>
            <th className="px-3 py-1.5 text-center font-medium text-[10px]">Status</th>
          </tr>
        </thead>
        <tbody>
          {adsetData.map((as) => {
            const isAdsetOpen = !!adsetExpanded[as.id];
            return (
              <Fragment key={as.id}>
                <tr
                  className="hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => toggleAdsetExpand(as.id)}
                >
                  <td className="px-3 py-2 text-xs font-medium max-w-[200px] pl-10 relative">
                    <span className="absolute left-6 top-0 bottom-0 w-px border-l border-dashed border-muted-foreground/30" />
                    <div className="flex items-center gap-1.5">
                      {isAdsetOpen ? <ChevronDown size={12} className="text-muted-foreground shrink-0" /> : <ChevronRight size={12} className="text-muted-foreground shrink-0" />}
                      <span className="truncate" title={as.nome}>{as.nome}</span>
                      <span className="text-[9px] text-muted-foreground shrink-0">({as.adsCount})</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-bold">{renderLeadsWithObjective(as.leadsCount, as.objetivo)}</td>
                  <td className="px-3 py-2 text-right text-xs">{as.leadsCount > 0 ? formatCurrency(as.cpl) : "—"}</td>
                  <td className="px-3 py-2 text-right text-xs">{formatCurrency(as.spend)}</td>
                  <td className="px-3 py-2 text-right text-xs">{as.qualificados || <CrmDash />}</td>
                  <td className={cn("px-3 py-2 text-right text-xs font-medium",
                    as.taxaQualif >= 50 ? "text-green-400" : as.taxaQualif >= 30 ? "text-yellow-400" : as.leadsCount > 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {as.leadsCount > 0 ? formatPercent(as.taxaQualif) : <CrmDash />}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">{as.reunioesAgendadas || <CrmDash />}</td>
                  <td className="px-3 py-2 text-right text-xs">{as.reunioesFeitas || <CrmDash />}</td>
                  <td className="px-3 py-2 text-right text-xs">{as.cprf > 0 ? formatCurrency(as.cprf) : <CrmDash />}</td>
                  <td className="px-3 py-2 text-right text-xs">{as.mql > 0 ? as.mql : "—"}</td>
                  <td className="px-3 py-2 text-right text-xs"><ConjuntoAlertBadge alert={as.alert} /></td>
                  <td className="px-3 py-2 text-center">
                    {renderStatusBadge(as.status)}
                  </td>
                </tr>
                {/* Level 3: Anuncios */}
                {isAdsetOpen && (
                  <AnunciosInline
                    adsetId={as.id}
                    metadata={metadata}
                    performance={performance}
                    attrLeads={attrLeads}
                    somenteComDados={somenteComDados}
                    onAdClick={onAdClick}
                  />
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ========== ESTIMATED TOOLTIP ========== */
function EstTooltip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dashed border-muted-foreground/30">{children}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <span className="text-[10px]">Estimado por atribuicao proporcional ao spend. Nao e valor exato — e uma distribuicao estatistica.</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function EstHeader({ label, sortCol: sc, currentSort, onToggle }: { label: string; sortCol: string; currentSort: string; onToggle: (col: string) => void }) {
  return (
    <th onClick={() => onToggle(sc)} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="border-b border-dashed border-muted-foreground/30 cursor-help">
              {label} <span className="text-[8px] text-amber-400">⚡</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            <span className="text-[10px]">Estimado por atribuicao proporcional ao spend</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {currentSort === sc && <ArrowUpDown size={10} className="inline ml-0.5" />}
    </th>
  );
}

/* ========== COVERAGE WARNING + AUTO INSIGHTS ========== */
function CoverageAndInsights({ rows, totalLeads, totalSpend, avgCpl, breakdown }: { rows: DemographicRow[]; totalLeads: number; totalSpend: number; avgCpl: number; breakdown: string }) {
  if (rows.length === 0 || totalLeads === 0) return null;

  // Find best and worst segments
  const withLeads = rows.filter(r => r.leads >= 3);
  if (withLeads.length < 2) return null;

  const best = withLeads.reduce((a, b) => a.cpl < b.cpl && a.cpl > 0 ? a : b.cpl > 0 ? b : a);
  const worst = withLeads.reduce((a, b) => a.cpl > b.cpl ? a : b);
  const bestLabel = best.sublabel ? `${best.label} ${best.sublabel}` : best.label;
  const worstLabel = worst.sublabel ? `${worst.label} ${worst.sublabel}` : worst.label;
  const worstBudgetPct = totalSpend > 0 ? (worst.spend / totalSpend) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Auto insight */}
      {best.cpl > 0 && worst.cpl > 0 && worst.cpl > avgCpl * 1.3 && (
        <div className="p-3 rounded-lg border bg-accent/5 border-accent/20 text-[11px] text-accent leading-relaxed">
          <span className="font-semibold">Insight:</span> {bestLabel} tem CPL {formatCurrency(best.cpl)} ({((1 - best.cpl / avgCpl) * 100).toFixed(0)}% abaixo da media) com {best.leads} leads.
          {worstBudgetPct > 5 && ` ${worstLabel} consome ${worstBudgetPct.toFixed(0)}% do budget com CPL ${((worst.cpl / avgCpl - 1) * 100).toFixed(0)}% acima da media.`}
          {best.cpl < avgCpl * 0.7 && ` Considere concentrar mais budget em ${bestLabel}.`}
        </div>
      )}
    </div>
  );
}

/* ========== DEMOGRAPHIC PANEL ========== */
function DemographicPanel({ rows, loading, breakdown, somenteComDados, permiteContratos = false }: { rows: DemographicRow[]; loading: boolean; breakdown: string; somenteComDados: boolean; permiteContratos?: boolean }) {
  const [sortCol, setSortCol] = useState("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const grouped = useMemo(() => {
    if (loading || rows.length === 0) return [];
    const map = new Map<string, DemographicRow & { count: number }>();
    for (const row of rows) {
      const key = (breakdown === "age_gender" || breakdown === "placement" || breakdown === "platform")
        ? `${row.label}|${row.sublabel || ""}`
        : row.label;
      if (map.has(key)) {
        const g = map.get(key)!;
        g.spend += row.spend; g.impressions += row.impressions; g.clicks += row.clicks; g.leads += row.leads;
        g.qualificados_est = (g.qualificados_est || 0) + (row.qualificados_est || 0);
        g.reunioes_realizadas_est = (g.reunioes_realizadas_est || 0) + (row.reunioes_realizadas_est || 0);
        if (row.contratos_est != null) g.contratos_est = (g.contratos_est || 0) + row.contratos_est;
        if (row.mrr_gerado_est != null) g.mrr_gerado_est = (g.mrr_gerado_est || 0) + row.mrr_gerado_est;
        g.count++;
      } else {
        map.set(key, { ...row, count: 1 });
      }
    }
    return Array.from(map.values()).map((g) => {
      const cpl = g.leads > 0 ? g.spend / g.leads : 0;
      const ctr = g.impressions > 0 ? (g.clicks / g.impressions) * 100 : 0;
      const cpc = g.clicks > 0 ? g.spend / g.clicks : 0;
      const taxa_qualificacao_est = g.leads > 0 && g.qualificados_est ? (g.qualificados_est / g.leads) * 100 : null;
      const cac_est = g.contratos_est && g.contratos_est > 0 ? g.spend / g.contratos_est : null;
      const roas_cash_est = g.roas_cash_est; // already computed server-side
      return { ...g, cpl, ctr, cpc, taxa_qualificacao_est, cac_est, roas_cash_est };
    });
  }, [rows, breakdown, loading]);

  if (loading) return <div className="flex items-center justify-center h-32"><p className="text-muted-foreground text-sm">Carregando dados demográficos...</p></div>;

  const filtered = somenteComDados ? grouped.filter((r) => r.spend > 0) : grouped;
  const sorted = [...filtered].sort((a, b) => {
    const va = (a as unknown as Record<string, number>)[sortCol] ?? 0;
    const vb = (b as unknown as Record<string, number>)[sortCol] ?? 0;
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const totalSpend = filtered.reduce((s, r) => s + r.spend, 0);
  const totalLeads = filtered.reduce((s, r) => s + r.leads, 0);
  const maxSpend = Math.max(...filtered.map((r) => r.spend), 1);

  const toggleSort = (col: string) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("desc"); } };

  if (filtered.length === 0) return <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum dado demográfico encontrado para o período.</CardContent></Card>;

  // Coverage warning — Meta may not have data for all leads
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  const barColor = breakdown === "age_gender" ? "bg-gradient-to-r from-violet-500 to-accent" :
    breakdown === "region" ? "bg-gradient-to-r from-primary to-teal-500" :
      breakdown === "device" ? "bg-gradient-to-r from-sky-500 to-accent" :
        "bg-gradient-to-r from-amber-500 to-accent";

  const deviceIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes("iphone") || l.includes("android (smartphone)") || l.includes("ipod") || l.includes("mobile")) return <Smartphone size={14} />;
    if (l.includes("desktop")) return <Monitor size={14} />;
    if (l.includes("ipad") || l.includes("tablet")) return <Tablet size={14} />;
    return <Smartphone size={14} />;
  };

  const GENDER_NAMES: Record<string, string> = { Masculino: "♂ Masculino", Feminino: "♀ Feminino", unknown: "Não informado" };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><span className="text-xs text-muted-foreground">Total Investido</span><p className="text-xl font-bold mt-1">{formatCurrency(totalSpend)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><span className="text-xs text-muted-foreground">Total Leads</span><p className="text-xl font-bold mt-1">{totalLeads}</p></CardContent></Card>
        <Card><CardContent className="p-4"><span className="text-xs text-muted-foreground">CPL Medio</span><p className="text-xl font-bold mt-1">{totalLeads > 0 ? formatCurrency(avgCpl) : "—"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><span className="text-xs text-muted-foreground">Segmentos</span><p className="text-xl font-bold mt-1">{filtered.length}</p></CardContent></Card>
      </div>

      {/* Coverage warning + auto insights */}
      <CoverageAndInsights rows={filtered} totalLeads={totalLeads} totalSpend={totalSpend} avgCpl={avgCpl} breakdown={breakdown} />

      <Card>
        <CardContent className="p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Distribuição por {breakdown === "age_gender" ? "Idade & Gênero" : breakdown === "region" ? "Localização" : breakdown === "device" ? "Dispositivo" : breakdown === "placement" ? "Posicionamento" : "Plataforma"}
          </p>
          {sorted.slice(0, 15).map((row, i) => {
            const displayLabel = breakdown === "device"
              ? row.label
              : breakdown === "age_gender"
                ? `${row.label} · ${GENDER_NAMES[row.sublabel || ""] || row.sublabel || ""}`
                : row.sublabel ? `${row.label} · ${row.sublabel}` : row.label;

            return (
              <BarRow
                key={`${row.label}-${row.sublabel}-${i}`}
                label={displayLabel}
                value={row.spend}
                max={maxSpend}
                color={barColor}
                extra={
                  <>
                    <MetricCell label="Invest." value={formatCurrency(row.spend)} />
                    <MetricCell label="Leads" value={String(row.leads)} />
                    <MetricCell label="CPL" value={row.leads > 0 ? formatCurrency(row.cpl) : "—"} />
                  </>
                }
              />
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-3 py-2.5 text-left font-medium text-xs">
                    {breakdown === "age_gender" ? "Faixa Etária" : breakdown === "region" ? "Região" : breakdown === "device" ? "Dispositivo" : breakdown === "placement" ? "Posicionamento" : "Plataforma"}
                  </th>
                  {breakdown === "age_gender" && <th className="px-3 py-2.5 text-left font-medium text-xs">Gênero</th>}
                  {breakdown === "region" && <th className="px-3 py-2.5 text-left font-medium text-xs">País</th>}
                  {breakdown === "platform" && <th className="px-3 py-2.5 text-left font-medium text-xs">Posição</th>}
                  {breakdown === "placement" && <th className="px-3 py-2.5 text-left font-medium text-xs">Plataforma</th>}
                  <th onClick={() => toggleSort("spend")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                    Investido {sortCol === "spend" && <ArrowUpDown size={10} className="inline" />}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium text-xs">% Budget</th>
                  <th onClick={() => toggleSort("leads")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                    Leads {sortCol === "leads" && <ArrowUpDown size={10} className="inline" />}
                  </th>
                  <th onClick={() => toggleSort("cpl")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                    CPL {sortCol === "cpl" && <ArrowUpDown size={10} className="inline" />}
                  </th>
                  <th onClick={() => toggleSort("impressions")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                    Impressões {sortCol === "impressions" && <ArrowUpDown size={10} className="inline" />}
                  </th>
                  <th onClick={() => toggleSort("ctr")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                    CTR {sortCol === "ctr" && <ArrowUpDown size={10} className="inline" />}
                  </th>
                  {/* Colunas de funil estimadas */}
                  <EstHeader label="Qualif." sortCol="qualificados_est" currentSort={sortCol} onToggle={toggleSort} />
                  <EstHeader label="Tx.Qualif" sortCol="taxa_qualificacao_est" currentSort={sortCol} onToggle={toggleSort} />
                  <EstHeader label="Reuniões" sortCol="reunioes_realizadas_est" currentSort={sortCol} onToggle={toggleSort} />
                  {permiteContratos && <EstHeader label="Contratos" sortCol="contratos_est" currentSort={sortCol} onToggle={toggleSort} />}
                  {permiteContratos && <EstHeader label="MRR" sortCol="mrr_gerado_est" currentSort={sortCol} onToggle={toggleSort} />}
                  {permiteContratos && <EstHeader label="CAC" sortCol="cac_est" currentSort={sortCol} onToggle={toggleSort} />}
                  {permiteContratos && <EstHeader label="ROAS Cash" sortCol="roas_cash_est" currentSort={sortCol} onToggle={toggleSort} />}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => {
                  const budgetPct = totalSpend > 0 ? (row.spend / totalSpend) * 100 : 0;
                  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
                  return (
                    <tr key={`${row.label}-${row.sublabel}-${i}`} className="border-b border-border hover:bg-muted/30 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 text-xs font-medium">
                        <div className="flex items-center gap-2">
                          {breakdown === "device" && <span className="text-muted-foreground">{deviceIcon(row.label)}</span>}
                          {row.label}
                        </div>
                      </td>
                      {breakdown === "age_gender" && <td className="px-3 py-2.5 text-xs">
                        <Badge className={cn("text-[9px]", row.sublabel === "Masculino" ? "bg-sky-500/10 text-sky-400" : row.sublabel === "Feminino" ? "bg-pink-500/10 text-pink-400" : "bg-muted text-muted-foreground")}>
                          {GENDER_NAMES[row.sublabel || ""] || row.sublabel}
                        </Badge>
                      </td>}
                      {breakdown === "region" && <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.sublabel || "—"}</td>}
                      {breakdown === "platform" && <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">{row.sublabel || "—"}</td>}
                      {breakdown === "placement" && <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">{row.sublabel || "—"}</td>}
                      <td className="px-3 py-2.5 text-right text-xs font-medium">{formatCurrency(row.spend)}</td>
                      <td className="px-3 py-2.5 text-right text-xs">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", barColor)} style={{ width: `${budgetPct}%` }} />
                          </div>
                          <span className="text-muted-foreground">{budgetPct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold">{row.leads}</td>
                      <td className={cn("px-3 py-2.5 text-right text-xs font-medium",
                        row.cpl > 0 && row.cpl < avgCpl * 0.8 ? "text-primary" :
                          row.cpl > avgCpl * 1.3 ? "text-destructive" : ""
                      )}>
                        {row.leads > 0 ? formatCurrency(row.cpl) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs">{row.impressions.toLocaleString("pt-BR")}</td>
                      <td className={cn("px-3 py-2.5 text-right text-xs font-medium", row.ctr >= 1.5 ? "text-primary" : row.ctr < 0.8 && row.ctr > 0 ? "text-destructive" : "")}>
                        {formatPercent(row.ctr)}
                      </td>
                      {/* Colunas de funil estimadas */}
                      <td className="px-3 py-2.5 text-right text-xs"><EstTooltip>{row.qualificados_est ?? "—"}</EstTooltip></td>
                      <td className="px-3 py-2.5 text-right text-xs"><EstTooltip>{row.taxa_qualificacao_est != null ? formatPercent(row.taxa_qualificacao_est) : "—"}</EstTooltip></td>
                      <td className="px-3 py-2.5 text-right text-xs"><EstTooltip>{row.reunioes_realizadas_est ?? "—"}</EstTooltip></td>
                      {permiteContratos && <td className="px-3 py-2.5 text-right text-xs"><EstTooltip>{row.contratos_est ?? "—"}</EstTooltip></td>}
                      {permiteContratos && <td className="px-3 py-2.5 text-right text-xs"><EstTooltip>{row.mrr_gerado_est != null ? formatCurrency(row.mrr_gerado_est) : "—"}</EstTooltip></td>}
                      {permiteContratos && <td className="px-3 py-2.5 text-right text-xs"><EstTooltip>{row.cac_est != null ? formatCurrency(row.cac_est) : "—"}</EstTooltip></td>}
                      {permiteContratos && <td className="px-3 py-2.5 text-right text-xs font-medium"><EstTooltip>{formatRoas(row.roas_cash_est)}</EstTooltip></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

/* ========== MAIN PAGE ========== */
function CampanhasInner({ initialTab, nivelExpand }: { initialTab: string; nivelExpand?: string | null }) {
  const filters = usePeriodoTrafego();
  const { data, isLoading: loading } = useTrafegoData(filters.dataInicio, filters.dataFim, filters.statusFiltro);
  // Fonte única de investimento (mesmo valor que Visão Geral)
  const { totalSpend: unifiedSpend } = useAccountSpend(filters.dataInicio, filters.dataFim);
  const { mapByCampaign: funilMap } = useConfigFunilCampanha();

  // MQL/SQL: buscar etapas de leads para classificação por campanha (todos os meses do range)
  const mesRef = filters.dataInicio.slice(0, 7);
  const mesesMqlSql = useMemo(() => {
    const meses: string[] = [];
    const cur = new Date(filters.dataInicio + "T00:00:00");
    const fim = new Date(filters.dataFim + "T00:00:00");
    while (cur <= fim) {
      meses.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return meses;
  }, [filters.dataInicio, filters.dataFim]);

  const { data: mqlSqlData } = useSWR(
    ["mql-sql-campanhas", ...mesesMqlSql],
    async () => {
      const results = await Promise.all(
        mesesMqlSql.map(async (m) => {
          const res = await fetch(`/api/marketing/mql-sql?mesReferencia=${m}&breakdown=campaign`);
          const json = await res.json();
          return json.error ? null : json;
        })
      );
      // Merge byEntity de todos os meses
      const merged: Record<string, { mql: number; sql: number }> = {};
      let etapas: any = null;
      for (const r of results) {
        if (!r) continue;
        if (!etapas && r.etapas) etapas = r.etapas;
        for (const [key, val] of Object.entries(r.byEntity || {})) {
          const v = val as { mql: number; sql: number };
          if (!merged[key]) merged[key] = { mql: 0, sql: 0 };
          merged[key].mql += v.mql;
          merged[key].sql += v.sql;
        }
      }
      return { byEntity: merged, etapas };
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );
  const mqlSqlByEntity = (mqlSqlData?.byEntity || {}) as Record<string, { mql: number; sql: number }>;

  const metadata = data?.metadata || [];
  const performance = data?.performance || [];
  const leads = data?.leads || [];
  const attrLeads = data?.attrLeads || [];

  // Accordion state persisted in localStorage
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(() => loadExpandedState());

  const toggleExpand = useCallback((campId: string) => {
    setExpandedMap((prev) => {
      const next = { ...prev, [campId]: !prev[campId] };
      saveExpandedState(next);
      return next;
    });
  }, []);

  // AI Scale Analysis
  const [sheetOpen, setSheetOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  // Ad Detail Drawer (T2)
  const [adDrawerOpen, setAdDrawerOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<AdDetailData | null>(null);

  const handleAdClick = useCallback((ad: AdDetailData) => {
    setSelectedAd(ad);
    setAdDrawerOpen(true);
  }, []);

  // Publicos sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("audiences");
  const [tipoFiltro, setTipoFiltro] = useState("all");
  const [pubSortCol, setPubSortCol] = useState("spend");
  const [pubSortDir, setPubSortDir] = useState<"asc" | "desc">("desc");
  const [demoData, setDemoData] = useState<Record<string, DemographicRow[]>>({});
  const [demoLoading, setDemoLoading] = useState<Record<string, boolean>>({});

  // Audiences engine
  const { audienceRows, bucketBroad, stats, loadingAudiences } = useAudiencesEngine({
    performance: data?.performance || [],
    metadata: data?.metadata || [],
    statusFiltro: filters.statusFiltro,
    somenteComDados: filters.somenteComDados,
    tipoFiltro,
  });

  const [demoPermiteContratos, setDemoPermiteContratos] = useState<Record<string, boolean>>({});

  const fetchDemographic = useCallback(async (breakdown: string) => {
    setDemoLoading((prev) => ({ ...prev, [breakdown]: true }));
    try {
      const res = await fetch(`/api/meta-demographics-enriched?since=${filters.dataInicio}&until=${filters.dataFim}&breakdown=${breakdown}`);
      const json = await res.json();
      setDemoData((prev) => ({ ...prev, [breakdown]: json.data || [] }));
      setDemoPermiteContratos((prev) => ({ ...prev, [breakdown]: json.permite_contratos ?? false }));
    } catch {
      setDemoData((prev) => ({ ...prev, [breakdown]: [] }));
    }
    setDemoLoading((prev) => ({ ...prev, [breakdown]: false }));
  }, [filters.dataInicio, filters.dataFim]);

  useEffect(() => {
    if (activeSubTab !== "audiences" && !demoData[activeSubTab]) {
      fetchDemographic(activeSubTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, fetchDemographic]);

  const togglePubSort = (col: string) => { if (pubSortCol === col) setPubSortDir((d) => d === "asc" ? "desc" : "asc"); else { setPubSortCol(col); setPubSortDir("desc"); } };
  const pubSorted = useMemo(() => [...audienceRows].sort((a, b) => { const va = (a as unknown as Record<string, number>)[pubSortCol] ?? 0; const vb = (b as unknown as Record<string, number>)[pubSortCol] ?? 0; return pubSortDir === "asc" ? va - vb : vb - va; }), [audienceRows, pubSortCol, pubSortDir]);
  const finalRows = useMemo(() => {
    const rows = [...pubSorted];
    if (bucketBroad.spend > 0 && tipoFiltro === "all") rows.push(bucketBroad as unknown as typeof rows[number]);
    return rows;
  }, [pubSorted, bucketBroad, tipoFiltro]);
  const globalCpl = stats.avgCpl;

  // Campanhas data
  const { campanhaData, topPerformer, topMql } = useMemo(() => {
    const campanhasMap = new Map<string, typeof metadata>();
    metadata.forEach((m) => {
      if (m.campaign_id) {
        const arr = campanhasMap.get(m.campaign_id) || [];
        arr.push(m);
        campanhasMap.set(m.campaign_id, arr);
      }
    });

    const cData = Array.from(campanhasMap, ([cid, ads]) => {
      const adIds = ads.map((a) => a.ad_id);
      const perfs = performance.filter((p) => adIds.includes(p.ad_id));
      const lds = attrLeads.filter((l) => l.campanha_id === cid);
      const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
      const qualificados = lds.filter((l) => l.foi_qualificado).length;
      const reunioesAgendadas = lds.filter((l) => l.teve_reuniao_agendada).length;
      const reunioesFeitas = lds.filter((l) => l.teve_reuniao_realizada).length;
      const fechados = lds.filter((l) => l.virou_cliente).length;
      const totalLeads = lds.length;
      const taxaQualif = totalLeads > 0 ? (qualificados / totalLeads) * 100 : 0;
      const taxaFechamento = totalLeads > 0 ? (fechados / totalLeads) * 100 : 0;
      const cpl = totalLeads > 0 ? spend / totalLeads : 0;
      const cprf = reunioesFeitas > 0 ? spend / reunioesFeitas : 0;
      const custoReuniao = reunioesAgendadas > 0 ? spend / reunioesAgendadas : 0;
      const custoFechamento = fechados > 0 ? spend / fechados : 0;
      const nome = ads[0]?.campaign_name || cid;
      const status = ads[0]?.status || "";
      const datas = Array.from(new Set(perfs.map((p) => p.data_ref)));
      const cplPorDia = datas.map((d) => { const dp = perfs.filter((p) => p.data_ref === d); const ds = dp.reduce((s, p) => s + Number(p.spend), 0); const dl = dp.reduce((s, p) => s + p.leads, 0); return { dia: d.slice(5), cpl: dl > 0 ? ds / dl : null, spend: ds, leads: dl }; });
      const impressoes = perfs.reduce((s, p) => s + p.impressoes, 0);
      const cliques = perfs.reduce((s, p) => s + p.cliques, 0);
      const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
      const cpa = fechados > 0 ? spend / fechados : 0;
      const entityMqlSql = mqlSqlByEntity[cid] || { mql: 0, sql: 0 };
      const cpql = qualificados > 0 ? spend / qualificados : 0;
      const mrrGerado = lds.filter((l) => l.virou_cliente && l.mrr_gerado).reduce((s, l) => s + (l.mrr_gerado || 0), 0);
      const objetivo = ads[0]?.objetivo || "";
      const budgetRemaining = ads[0]?.daily_budget || null;
      return { id: cid, nome, status, objetivo, budgetRemaining, spend, leadsCount: totalLeads, qualificados, reunioesAgendadas, reunioesFeitas, fechados, taxaQualif, taxaFechamento, cpl, cpql, cprf, ctr, cpa, custoReuniao, custoFechamento, cplPorDia, adsCount: ads.length, mrrGerado, mql: entityMqlSql.mql, sql: entityMqlSql.sql, custoMql: entityMqlSql.mql > 0 ? spend / entityMqlSql.mql : 0, custoSql: entityMqlSql.sql > 0 ? spend / entityMqlSql.sql : 0, taxaMql: totalLeads > 0 ? (entityMqlSql.mql / totalLeads) * 100 : 0, taxaSql: totalLeads > 0 ? (entityMqlSql.sql / totalLeads) * 100 : 0 };
    }).filter((c) => !filters.somenteComDados || c.spend > 0).sort((a, b) => b.spend - a.spend);

    // Melhor CPL: mínimo 3 leads para ser elegível
    let tPerf: typeof cData[0] | null = null;
    for (const c of cData) {
      if (c.leadsCount < 3 || c.cpl <= 0) continue;
      if (!tPerf || c.cpl < tPerf.cpl) tPerf = c;
    }

    // Mais eficiente em MQL: maior taxa de qualificação (mín. 3 leads)
    let tMql: typeof cData[0] | null = null;
    for (const c of cData) {
      if (c.leadsCount < 3 || c.taxaQualif <= 0) continue;
      if (!tMql || c.taxaQualif > tMql.taxaQualif) tMql = c;
    }

    return { campanhaData: cData, topPerformer: tPerf, topMql: tMql };
  }, [metadata, performance, attrLeads, filters.somenteComDados, mqlSqlByEntity]);

  // Meta CPL da config_mensal (consistente com calendário e apresentação)
  const { data: metaConfigData } = useSWR(
    ["config-mensal-meta-cpl", mesRef],
    async () => {
      const { data } = await (await import("@/lib/supabase")).supabase
        .from("config_mensal")
        .select("meta_cpl")
        .eq("mes_referencia", `${mesRef}-01`)
        .maybeSingle();
      return data;
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const { metaCpl, mediaContaTaxaQualif } = useMemo(() => {
    const totalSpend = campanhaData.reduce((s, c) => s + c.spend, 0);
    const totalLeads = campanhaData.reduce((s, c) => s + c.leadsCount, 0);
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    // Meta CPL real, fallback para média da conta
    const configMetaCpl = Number(metaConfigData?.meta_cpl || 0) || avgCpl;
    // Taxa qualificação ponderada por volume de leads (não média simples)
    const campsComQualif = campanhaData.filter(c => c.leadsCount >= 3 && c.qualificados > 0);
    const totalLeadsQualif = campsComQualif.reduce((s, c) => s + c.leadsCount, 0);
    const totalQualificados = campsComQualif.reduce((s, c) => s + c.qualificados, 0);
    const avgTaxaQualif = totalLeadsQualif > 0
      ? (totalQualificados / totalLeadsQualif) * 100
      : 30; // fallback 30%
    return { metaCpl: configMetaCpl, mediaContaTaxaQualif: avgTaxaQualif };
  }, [campanhaData, metaConfigData]);

  // Auto-expand when ?nivel= param is set (from redirects)
  useEffect(() => {
    if (!nivelExpand || campanhaData.length === 0) return;
    if (nivelExpand === "conjuntos" || nivelExpand === "anuncios") {
      const newExpanded: Record<string, boolean> = {};
      campanhaData.forEach(c => { newExpanded[c.id] = true; });
      setExpandedMap(newExpanded);
      saveExpandedState(newExpanded);
    }
  }, [nivelExpand, campanhaData.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // AI analysis handler
  const handleAnaliseEscala = async () => {
    setAiLoading(true);
    setAiResult(null);
    setSheetOpen(true);
    try {
      const payload = campanhaData
        .filter((c) => c.status === "ACTIVE" && c.spend > 0)
        .map((c) => ({ nome: c.nome, spend: c.spend, leads: c.leadsCount, cpl: c.cpl, status: c.status }));

      const res = await fetch("/api/ia/analisar-escala", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campanhas: payload }),
      });
      const json = await res.json();
      if (json.error) setAiResult(`**Erro:** ${json.error}`);
      else setAiResult(json.analise);
    } catch {
      setAiResult("**Erro:** Não foi possível conectar à IA. Tente novamente.");
    }
    setAiLoading(false);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch("/api/meta/cache-clear", { method: "POST" });
      await mutate(
        (key) => typeof key === "string" && key.includes("/api/meta/"),
        undefined,
        { revalidate: true }
      );
      toast.success("Dados sincronizados com o Meta Ads.");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao sincronizar dados.");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      {/* Header with filters + AI button */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Campanhas ({campanhaData.length})</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs border-primary/20 hover:bg-primary/10 transition-colors"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"} />
              {isRefreshing ? "Sincronizando..." : "Sincronizar Meta"}
            </Button>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={handleAnaliseEscala}
                  disabled={aiLoading}
                >
                  <Brain size={14} />
                  Analisar potencial de escala
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Análise de Escala — IA</SheetTitle>
                <SheetDescription>Análise automática do potencial de escala das campanhas ativas (máx 25%/dia)</SheetDescription>
              </SheetHeader>
              <div className="p-4 pt-0">
                <div className="mb-3">
                  <IAModelSelector fnKey="analisar_escala" compact />
                </div>
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Analisando campanhas...</p>
                  </div>
                ) : aiResult ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                    {aiResult.split(/^(## .+)$/gm).map((block, i) => {
                      if (block.startsWith("## ")) {
                        return <h3 key={i} className="text-sm font-bold mt-4 mb-2 text-foreground">{block.replace("## ", "")}</h3>;
                      }
                      return block.trim() ? <p key={i} className="text-muted-foreground mb-2">{block.trim()}</p> : null;
                    })}
                  </div>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
          </div>
        </div>
        {/* Period selector is now in the layout */}
      </div>

      {/* Top performer cards */}
      {(topPerformer || topMql) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topPerformer && (
            <Card className="border-accent/40 bg-gradient-to-r from-accent/5 to-purple-500/5">
              <CardContent className="py-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-yellow-500/15 flex items-center justify-center shrink-0">
                  <Trophy size={18} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Melhor CPL do periodo (min. 3 leads)</p>
                  <p className="text-sm font-semibold truncate" title={topPerformer.nome}>{topPerformer.nome}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">CPL</p>
                    <p className="text-lg font-bold text-accent">{formatCurrency(topPerformer.cpl)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Leads</p>
                    <p className="text-lg font-bold">{topPerformer.leadsCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {topMql && (
            <Card className="border-green-500/40 bg-gradient-to-r from-green-500/5 to-primary/5">
              <CardContent className="py-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                  <UserCheck size={18} className="text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Mais Eficiente em MQL</p>
                  <p className="text-sm font-semibold truncate" title={topMql.nome}>{topMql.nome}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Qualif.</p>
                    <p className="text-lg font-bold text-green-400">{formatPercent(topMql.taxaQualif)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Leads</p>
                    <p className="text-lg font-bold">{topMql.leadsCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TABS: Desempenho + Inteligencia + Estrutura + Gerenciar + Públicos */}
      <Tabs defaultValue={initialTab}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
          <TabsTrigger value="inteligencia">Inteligencia</TabsTrigger>
          <TabsTrigger value="estrutura">Estrutura</TabsTrigger>
          <TabsTrigger value="gerenciar">Gerenciar</TabsTrigger>
          <TabsTrigger value="publicos">Públicos</TabsTrigger>
        </TabsList>

        {/* ========== TAB DESEMPENHO ========== */}
        <TabsContent value="desempenho">
          {campanhaData.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma campanha com os filtros selecionados</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium text-xs w-6"></th>
                        <th className="px-3 py-2 text-left font-medium text-xs">Campanha</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">Leads</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">CPL</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">CTR</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">Investido</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">Qualif.</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">% Qualif</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">Reun. Ag.</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">Reun. Feitas</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">CPRF</th>
                        <th className="px-3 py-2 text-right font-medium text-xs" title={mqlSqlData?.etapas?.mql ? `MQL: ${mqlSqlData.etapas.mql.join(", ")} — configurável em /config` : undefined}>MQL</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">% MQL</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">C/MQL</th>
                        <th className="px-3 py-2 text-right font-medium text-xs" title={mqlSqlData?.etapas?.sql ? `SQL: ${mqlSqlData.etapas.sql.join(", ")} — configurável em /config` : undefined}>SQL</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">% SQL</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">C/SQL</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">CPQL</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">Fechamentos</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">CAC</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">MRR</th>
                        <th className="px-3 py-2 text-right font-medium text-xs">Tx. Fech.</th>
                        <th className="px-3 py-2 text-center font-medium text-xs">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campanhaData.map((camp) => {
                        const isOpen = !!expandedMap[camp.id];
                        return (
                          <Fragment key={camp.id}>
                            <tr
                              className="border-b hover:bg-muted/30 cursor-pointer"
                              onClick={() => toggleExpand(camp.id)}
                            >
                              <td className="px-3 py-2 text-muted-foreground">
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </td>
                              <td className="px-3 py-2 text-xs font-medium max-w-[300px]">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="truncate" title={camp.nome}>{camp.nome}</span>
                                  <span className="text-[10px] text-muted-foreground font-normal shrink-0">({camp.adsCount})</span>
                                  {funilMap.get(camp.id)?.tipo_funil && <FunilBadge tipo={funilMap.get(camp.id)!.tipo_funil} size="xs" />}
                                  <FunilCampanhaPopover campaignId={camp.id} campaignName={camp.nome} currentTipo={funilMap.get(camp.id)?.tipo_funil} />
                                </div>
                                {camp.budgetRemaining != null && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">Budget: {formatCurrency(camp.budgetRemaining)}</p>
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs text-right font-bold">{renderLeadsWithObjective(camp.leadsCount, camp.objetivo)}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.cpl > 0 ? formatCurrency(camp.cpl) : "—"}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.ctr > 0 ? formatPercent(camp.ctr) : "—"}</td>
                              <td className="px-3 py-2 text-xs text-right font-medium">{formatCurrency(camp.spend)}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.qualificados > 0 ? camp.qualificados : <CrmDash />}</td>
                              <td className={`px-3 py-2 text-xs text-right font-medium ${camp.taxaQualif >= 40 ? "text-green-400" : camp.taxaQualif >= 20 ? "text-yellow-400" : camp.qualificados > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                {camp.qualificados > 0 ? formatPercent(camp.taxaQualif) : <CrmDash />}
                              </td>
                              <td className="px-3 py-2 text-xs text-right">{camp.reunioesAgendadas || <CrmDash />}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.reunioesFeitas || <CrmDash />}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.cprf > 0 ? formatCurrency(camp.cprf) : <CrmDash />}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.mql > 0 ? camp.mql : "—"}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.taxaMql > 0 ? formatPercent(camp.taxaMql) : "—"}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.custoMql > 0 ? formatCurrency(camp.custoMql) : "—"}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.sql > 0 ? camp.sql : "—"}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.taxaSql > 0 ? formatPercent(camp.taxaSql) : "—"}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.custoSql > 0 ? formatCurrency(camp.custoSql) : "—"}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.cpql > 0 ? formatCurrency(camp.cpql) : <CrmDash />}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.fechados || <CrmDash />}</td>
                              <td className="px-3 py-2 text-xs text-right">{camp.cpa > 0 ? formatCurrency(camp.cpa) : <CrmDash />}</td>
                              <td className={`px-3 py-2 text-xs text-right font-medium ${camp.mrrGerado > 0 ? "text-primary" : ""}`}>{camp.mrrGerado > 0 ? formatCurrency(camp.mrrGerado) : <CrmDash />}</td>
                              <td className={`px-3 py-2 text-xs text-right font-medium ${camp.taxaFechamento >= 10 ? "text-green-400" : camp.taxaFechamento >= 5 ? "text-yellow-400" : camp.fechados > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                {camp.fechados > 0 ? formatPercent(camp.taxaFechamento) : <CrmDash />}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {renderStatusBadge(camp.status)}
                              </td>
                            </tr>
                            {/* Expanded: conjuntos inline + funil */}
                            {isOpen && (
                              <tr className="border-b">
                                <td colSpan={23} className="p-0 bg-muted/10">
                                  <div className="space-y-3 py-3">
                                    {/* Conjuntos table (lazy - only rendered when expanded) */}
                                    <ConjuntosInline
                                      campaignId={camp.id}
                                      campaignName={camp.nome}
                                      metadata={metadata}
                                      performance={performance}
                                      attrLeads={attrLeads}
                                      somenteComDados={filters.somenteComDados}
                                      metaCpl={metaCpl}
                                      mediaContaTaxaQualif={mediaContaTaxaQualif}
                                      onAdClick={handleAdClick}
                                    />
                                    {/* Funil + métricas + CPL chart */}
                                    <div className="px-4 space-y-4">
                                      <div className="space-y-1.5">
                                        <p className="text-xs text-muted-foreground mb-1">Funil</p>
                                        {[
                                          { label: "Leads", valor: camp.leadsCount, cor: "#94A3B8" },
                                          { label: "Qualificados", valor: camp.qualificados, cor: "#3B82F6" },
                                          { label: "Reun. Agendadas", valor: camp.reunioesAgendadas, cor: "#7C3AED" },
                                          { label: "Reun. Feitas", valor: camp.reunioesFeitas, cor: "#8B5CF6" },
                                          { label: "Fechados", valor: camp.fechados, cor: "#22c55e" },
                                        ].map((etapa) => {
                                          const pct = camp.leadsCount > 0 ? (etapa.valor / camp.leadsCount) * 100 : 0;
                                          return (
                                            <div key={etapa.label} className="flex items-center gap-2">
                                              <span className="text-xs w-24 text-right text-muted-foreground">{etapa.label}</span>
                                              <div className="flex-1 h-6 bg-muted/40 rounded overflow-hidden">
                                                <div
                                                  className="h-full rounded flex items-center px-2 text-foreground text-xs font-medium transition-all"
                                                  style={{ width: `${Math.max(pct, etapa.valor > 0 ? 4 : 0)}%`, backgroundColor: etapa.cor }}
                                                >
                                                  {etapa.valor > 0 && etapa.valor}
                                                </div>
                                              </div>
                                              <span className="text-[11px] text-muted-foreground w-12 text-right">{pct.toFixed(0)}%</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                        <div className="bg-muted/30 rounded p-2">
                                          <p className="text-muted-foreground text-[10px]">CPRF</p>
                                          <p className="font-semibold">{camp.cprf > 0 ? formatCurrency(camp.cprf) : "—"}</p>
                                        </div>
                                        <div className="bg-muted/30 rounded p-2">
                                          <p className="text-muted-foreground text-[10px]">CAC Bruto</p>
                                          <p className="font-semibold">{camp.custoFechamento > 0 ? formatCurrency(camp.custoFechamento) : "—"}</p>
                                        </div>
                                        <div className="bg-muted/30 rounded p-2">
                                          <p className="text-muted-foreground text-[10px]">Tx. Qualificação</p>
                                          <p className="font-semibold">{camp.taxaQualif > 0 ? formatPercent(camp.taxaQualif) : "—"}</p>
                                        </div>
                                        <div className="bg-muted/30 rounded p-2">
                                          <p className="text-muted-foreground text-[10px]">Tx. Fechamento</p>
                                          <p className="font-semibold">{camp.taxaFechamento > 0 ? formatPercent(camp.taxaFechamento) : "—"}</p>
                                        </div>
                                      </div>
                                      {camp.cplPorDia.length > 1 && (
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-2">Evolução do CPL</p>
                                          <ResponsiveContainer width="100%" height={140}>
                                            <LineChart data={camp.cplPorDia}>
                                              <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                              <RechartsTooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ fontSize: 12 }} />
                                              <Line type="monotone" dataKey="cpl" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls={false} />
                                            </LineChart>
                                          </ResponsiveContainer>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ========== TAB INTELIGENCIA ========== */}
        <TabsContent value="inteligencia">
          <CampanhasInteligenciaTab />
        </TabsContent>

        {/* ========== TAB ESTRUTURA ========== */}
        <TabsContent value="estrutura">
          <Suspense fallback={<TabFallback />}>
            <LazyEstrutura />
          </Suspense>
        </TabsContent>

        {/* ========== TAB GERENCIAR ========== */}
        <TabsContent value="gerenciar">
          <Suspense fallback={<TabFallback />}>
            <LazyGerenciar />
          </Suspense>
        </TabsContent>

        {/* ========== TAB PÚBLICOS ========== */}
        <TabsContent value="publicos">
          {(loading || loadingAudiences) ? (
            <div className="flex flex-col items-center justify-center h-[40vh] gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">Sincronizando dados de públicos...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Sub-tabs */}
              <div className="flex gap-1 bg-muted/30 dark:bg-white/[0.03] rounded-xl p-1">
                {SUB_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSubTab(tab.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors flex-1 justify-center relative",
                        activeSubTab === tab.id ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      {activeSubTab === tab.id && (
                        <motion.div
                          layoutId="publicos-tab-indicator"
                          className="absolute inset-0 gradient-primary rounded-lg shadow-sm"
                          style={{ zIndex: 0 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <Icon size={13} />
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* AUDIENCES SUB-TAB */}
              {activeSubTab === "audiences" && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "all", label: "Todos" }, { value: "interest", label: "Interesses" },
                      { value: "behavior", label: "Comportamentos" }, { value: "custom_audience", label: "Personalizados" },
                      { value: "lookalike", label: "Lookalikes" },
                    ].map((opt) => (
                      <button key={opt.value} onClick={() => setTipoFiltro(opt.value)}
                        className={cn("px-3 py-1.5 text-xs rounded-lg border transition-all",
                          tipoFiltro === opt.value ? "gradient-primary text-foreground border-transparent" : "border-border text-muted-foreground hover:text-foreground"
                        )}>{opt.label}</button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-muted-foreground/50" /><span className="text-xs text-muted-foreground">Total Investido</span></div><p className="text-xl font-bold">{formatCurrency(unifiedSpend ?? stats.totalSpend)}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Users size={14} className="text-muted-foreground/50" /><span className="text-xs text-muted-foreground">Total Leads</span></div><p className="text-xl font-bold">{stats.totalLeads}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Target size={14} className="text-muted-foreground/50" /><span className="text-xs text-muted-foreground">CPL Médio</span></div><p className="text-xl font-bold">{stats.avgCpl > 0 ? formatCurrency(stats.avgCpl) : "—"}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Globe size={14} className="text-muted-foreground/50" /><span className="text-xs text-muted-foreground">Publicos Ativos</span></div>
                      {stats.totalActivePillars > 0 ? (
                        <p className="text-xl font-bold">{stats.totalActivePillars}</p>
                      ) : (
                        <div className="group relative">
                          <p className="text-xl font-bold text-muted-foreground cursor-help">N/D</p>
                          <div className="invisible group-hover:visible absolute left-0 top-full mt-1 z-50 w-56 p-2 text-[10px] text-muted-foreground bg-card border rounded-lg shadow-lg">
                            Dados de publicos nao disponiveis para campanhas de Formulario Nativo. Disponivel apenas para campanhas com segmentacao por interesses.
                          </div>
                        </div>
                      )}
                    </CardContent></Card>
                  </div>

                  {pubSorted.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum público encontrado para o período.</CardContent></Card>
                  ) : (
                    <Card><CardContent className="p-0"><div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border text-muted-foreground">
                          <th className="px-3 py-2.5 text-left font-medium text-xs">Público / Interesse</th>
                          <th className="px-3 py-2.5 text-left font-medium text-xs">Tipo</th>
                          <th className="px-3 py-2.5 text-left font-medium text-xs">Campanhas</th>
                          <th onClick={() => togglePubSort("spend")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">Investido {pubSortCol === "spend" && <ArrowUpDown size={10} className="inline" />}</th>
                          <th onClick={() => togglePubSort("leads")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">Leads {pubSortCol === "leads" && <ArrowUpDown size={10} className="inline" />}</th>
                          <th onClick={() => togglePubSort("cpl")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">CPL {pubSortCol === "cpl" && <ArrowUpDown size={10} className="inline" />}</th>
                          <th onClick={() => togglePubSort("impressoes")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">Impressões {pubSortCol === "impressoes" && <ArrowUpDown size={10} className="inline" />}</th>
                          <th onClick={() => togglePubSort("ctr")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">CTR {pubSortCol === "ctr" && <ArrowUpDown size={10} className="inline" />}</th>
                          <th className="px-3 py-2.5 text-center font-medium text-xs">Conjuntos</th>
                        </tr></thead>
                        <tbody>
                          <AnimatePresence>
                            {finalRows.map((aud, i) => {
                              const cfg = (aud.tipo as string) === "broad" ? { label: "Amplo", icon: Sparkles, color: "text-zinc-400", bg: "bg-zinc-500/10" } : TIPO_CONFIG[aud.tipo] || TIPO_CONFIG.interest;
                              const Icon = cfg.icon;
                              return (
                                <motion.tr
                                  key={`${aud.id}-${i}`}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.05 }}
                                  className={cn(
                                    "border-b border-border hover:bg-muted/30 dark:hover:bg-white/[0.02] transition-colors",
                                    (aud.tipo as string) === "broad" && "bg-muted/10 dark:bg-white/[0.01]"
                                  )}
                                >
                                  <td className="px-3 py-2.5"><div className="flex items-center gap-2.5">
                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", cfg.bg)}><Icon size={14} className={cfg.color} /></div>
                                    <span className="text-xs font-medium truncate max-w-[200px]" title={aud.name}>{aud.name}</span>
                                  </div></td>
                                  <td className="px-3 py-2.5"><Badge className={cn("text-[9px]", cfg.bg, cfg.color)}>{cfg.label}</Badge></td>
                                  <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1 max-w-[180px]">
                                    {aud.campaignNames.slice(0, 2).map((c: string, ci: number) => <span key={ci} className="text-[10px] text-muted-foreground bg-muted/50 dark:bg-white/[0.04] rounded px-1.5 py-0.5 truncate max-w-[80px]" title={c}>{c.length > 15 ? c.slice(0, 14) + "…" : c}</span>)}
                                    {aud.campaignNames.length > 2 && <span className="text-[10px] text-muted-foreground">+{aud.campaignNames.length - 2}</span>}
                                  </div></td>
                                  <td className="px-3 py-2.5 text-right text-xs font-medium">{formatCurrency(aud.spend)}</td>
                                  <td className="px-3 py-2.5 text-right text-xs font-bold">{aud.leads}</td>
                                  <td className={cn("px-3 py-2.5 text-right text-xs font-medium", aud.cpl > 0 && aud.cpl < globalCpl * 0.8 ? "text-primary" : aud.cpl > globalCpl * 1.3 ? "text-destructive" : "")}>
                                    {aud.leads > 0 ? formatCurrency(aud.cpl) : "—"}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-xs">{aud.impressoes.toLocaleString("pt-BR")}</td>
                                  <td className={cn("px-3 py-2.5 text-right text-xs font-medium", aud.ctr >= 1.5 ? "text-primary" : aud.ctr > 0 && aud.ctr < 0.8 ? "text-destructive" : "")}>{formatPercent(aud.ctr)}</td>
                                  <td className="px-3 py-2.5 text-center"><Badge className="text-[10px] bg-muted text-muted-foreground">{aud.adsets.length}</Badge></td>
                                </motion.tr>
                              );
                            })}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div></CardContent></Card>
                  )}
                </>
              )}

              {/* DEMOGRAPHIC SUB-TABS */}
              {activeSubTab !== "audiences" && (
                <DemographicPanel
                  rows={demoData[activeSubTab] || []}
                  loading={!!demoLoading[activeSubTab]}
                  breakdown={activeSubTab}
                  somenteComDados={filters.somenteComDados}
                  permiteContratos={demoPermiteContratos[activeSubTab] ?? false}
                />
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Ad Detail Drawer */}
      <AdDetailDrawer
        ad={selectedAd}
        open={adDrawerOpen}
        onOpenChange={setAdDrawerOpen}
      />
    </div>
  );
}

function CampanhasInteligenciaTab() {
  const [selectedItem, setSelectedItem] = useState<MetricaEntidade | null>(null);
  const [drillOpen, setDrillOpen] = useState(false);

  return (
    <div className="space-y-4">
      <TabelaInteligencia
        nivel="campaign"
        onRowClick={(item) => { setSelectedItem(item); setDrillOpen(true); }}
      />
      <DrillDownEntidade
        item={selectedItem}
        nivel="campaign"
        open={drillOpen}
        onOpenChange={setDrillOpen}
      />
    </div>
  );
}

export default function TrafegoCampanhasPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>}>
      <CampanhasWithParams />
    </Suspense>
  );
}

function CampanhasWithParams() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "desempenho";
  const nivelExpand = searchParams?.get("nivel") || null;
  return <CampanhasInner initialTab={initialTab} nivelExpand={nivelExpand} />;
}


