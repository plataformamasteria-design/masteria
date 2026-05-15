"use client";

import React, { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, ChevronDown, ChevronRight, Pencil,
  RefreshCw, BarChart3, DollarSign, Users, Zap, ExternalLink,
  Target, AlertTriangle, CheckCircle2, Layers, Eye, Copy,
  TrendingUp, TrendingDown, Minus, MousePointer, ShoppingCart,
  Calendar, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { FullEditDrawer, EditTarget } from "./full-edit-drawer";
import { AdPreviewModal } from "./ad-preview-modal";
import { CriarCampanhaDrawer } from "./criar-campanha-drawer";
import { BulkCreativeSwap } from "./bulk-creative-swap";
import { DuplicarCampanhaDrawer, DupCampaignSource } from "./duplicar-campanha-drawer";
import { useAccountId } from "@/contexts/ad-account-context";
import { usePeriodoTrafego } from "@/contexts/periodo-trafego-context";
import { useAccountSpend } from "@/hooks/use-account-spend";
import { TabLoading } from "@/components/ui/tab-loading";
import { SpotlightCard } from "@/components/ui/spotlight-card";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Ad {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  creative?: { id?: string; thumbnail_url?: string; image_url?: string; video_id?: string };
  spend?: number; leads?: number; cpl?: number; impressions?: number;
  clicks?: number; ctr?: number; cpm?: number; cpc?: number; roas?: number;
  purchases?: number; revenue?: number;
}
interface AdSet {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  daily_budget?: number;
  lifetime_budget?: number;
  budget_remaining?: number;
  ads?: { data: Ad[] };
  spend?: number; leads?: number; cpl?: number; impressions?: number;
  clicks?: number; ctr?: number; cpm?: number; cpc?: number; roas?: number;
  purchases?: number; revenue?: number; reach?: number; frequency?: number;
}
interface Campaign {
  id: string; name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED";
  effective_status?: string;
  objective: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  budget_remaining: number | null;
  spend: number; leads: number; cpl: number | null;
  impressions: number; clicks: number;
  ctr?: number | null; cpm?: number | null; cpc?: number | null;
  roas?: number | null; purchases?: number; revenue?: number;
  reach?: number; frequency?: number;
  pace_status?: string;
  expected_spend_today?: number | null;
  spend_today?: number;
  adsets?: { data: AdSet[] };
  created_time?: string;
}

type StatusFilter = "ALL" | "ACTIVE" | "PAUSED" | "RECENT";
type MetricPreset = "PERFORMANCE" | "PERFORMANCE_CLICKS" | "ENGAGEMENT";
type DatePreset = "7d" | "30d" | "3m" | "custom";

// ── Helpers ────────────────────────────────────────────────────────────────────
const OBJECTIVE_PT: Record<string, string> = {
  OUTCOME_LEADS: "Geração de Leads", OUTCOME_SALES: "Vendas",
  OUTCOME_TRAFFIC: "Tráfego", OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_ENGAGEMENT: "Engajamento", OUTCOME_APP_PROMOTION: "App",
};
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtExact = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const fmtPct = (v: number) => `${v.toFixed(2)}%`;
const fmtNum = (v: number) => v.toLocaleString("pt-BR");
const fetcher = (url: string) => fetch(url).then((r) => r.json());

function getDateRange(preset: DatePreset, customSince: string, customUntil: string) {
  const until = new Date().toISOString().slice(0, 10);
  if (preset === "7d") return { since: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), until };
  if (preset === "30d") return { since: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), until };
  if (preset === "3m") return { since: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10), until };
  return { since: customSince || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), until: customUntil || until };
}

// ── Metric column definitions ───────────────────────────────────────────────────
const METRIC_COLS: Record<MetricPreset, { key: string; label: string; fmt: (v: any) => string }[]> = {
  PERFORMANCE: [
    { key: "spend", label: "Valor Gasto", fmt: (v) => fmtExact(v || 0) },
    { key: "leads", label: "Resultados", fmt: (v) => fmtNum(v || 0) },
    { key: "cpl", label: "Custo por Result.", fmt: (v) => v ? fmtExact(v) : "—" },
    { key: "reach", label: "Alcance", fmt: (v) => fmtNum(v || 0) },
    { key: "impressions", label: "Impressões", fmt: (v) => fmtNum(v || 0) },
  ],
  PERFORMANCE_CLICKS: [
    { key: "leads", label: "Resultados", fmt: (v) => fmtNum(v || 0) },
    { key: "reach", label: "Alcance", fmt: (v) => fmtNum(v || 0) },
    { key: "frequency", label: "Frequência", fmt: (v) => v ? v.toFixed(2) : "—" },
    { key: "cpl", label: "Custo por resultado", fmt: (v) => v ? fmtExact(v) : "—" },
    { key: "spend", label: "Valor usado", fmt: (v) => fmtExact(v || 0) },
    { key: "impressions", label: "Impressões", fmt: (v) => fmtNum(v || 0) },
    { key: "cpm", label: "CPM (custo por 1.000 impr.)", fmt: (v) => v ? fmtExact(v) : "—" },
    { key: "inline_link_clicks", label: "Cliques no link", fmt: (v) => fmtNum(v || 0) },
    { key: "cpc_link", label: "CPC (clique no link)", fmt: (v) => v ? fmtExact(v) : "—" },
    { key: "ctr_link", label: "CTR (taxa de cliques no link)", fmt: (v) => v ? fmtPct(v) : "—" },
    { key: "clicks", label: "Cliques (todos)", fmt: (v) => fmtNum(v || 0) },
    { key: "ctr", label: "CTR (todos)", fmt: (v) => v ? fmtPct(v) : "—" },
    { key: "cpc", label: "CPC (todos)", fmt: (v) => v ? fmtExact(v) : "—" },
    { key: "landing_page_views", label: "Visual. da pág. de destino", fmt: (v) => fmtNum(v || 0) },
    { key: "cost_per_lpv", label: "Custo por visualização", fmt: (v) => v ? fmtExact(v) : "—" },
  ],
  ENGAGEMENT: [
    { key: "spend", label: "Valor Gasto", fmt: (v) => fmtExact(v || 0) },
    { key: "actions", label: "Engajamentos", fmt: (v) => fmtNum(v || 0) },
    { key: "reach", label: "Alcance", fmt: (v) => fmtNum(v || 0) },
    { key: "frequency", label: "Frequência", fmt: (v) => v ? v.toFixed(2) : "—" },
  ],
};

// ── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider ${
      active ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-muted text-muted-foreground border border-border"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
      {active ? "ATIVO" : "PAUSADO"}
    </div>
  );
}

// ── Pace Badge + Budget Bar ────────────────────────────────────────────────────
function PaceBadge({ pace, expected }: { pace?: string; expected?: number | null }) {
  if (!pace || pace === "unknown" || !expected) return <Minus  className="h-3.5 w-3.5 text-foreground/90" />;
  if (pace === "overpacing") return <TrendingUp  className="h-3.5 w-3.5 text-red-400" title="Gastando acima do ritmo esperado" />;
  if (pace === "underpacing") return <TrendingDown  className="h-3.5 w-3.5 text-amber-400" title="Gastando abaixo do ritmo esperado" />;
  return <CheckCircle2  className="h-3.5 w-3.5 text-emerald-400" title="No ritmo ideal" />;
}

function BudgetBar({ spend, budget }: { spend: number; budget: number | null }) {
  if (!budget) return <span className="text-xs text-foreground/90">—</span>;
  const pct = Math.min((spend / budget) * 100, 100);
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
      </div>
      <span className="text-[10px] text-foreground/90 tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ── Ad Row ─────────────────────────────────────────────────────────────────────
function AdRow({
  ad, onEdit, onToggleStatus, loadingId, metricCols, onPreview,
}: {
  ad: Ad;
  onEdit: (t: EditTarget) => void;
  onToggleStatus: (id: string, currentStatus: string) => void;
  loadingId: boolean;
  metricCols: typeof METRIC_COLS[MetricPreset];
  onPreview: (id: string, name: string) => void;
}) {
  const isActive = ad.status === "ACTIVE";
  return (
    <tr className="border-b border-white/5 bg-black/40 hover:bg-white/[0.03] transition-colors duration-200 group">
      {/* Name + thumbnail */}
      <td className="px-4 py-2.5 pl-[72px] max-w-[220px]">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md overflow-hidden bg-zinc-800 border border-white/8 flex-shrink-0 flex items-center justify-center">
            {ad.creative?.thumbnail_url
              ? <img src={ad.creative.thumbnail_url} className="w-full h-full object-cover" alt="" />
              : <Eye  className="h-3.5 w-3.5 text-foreground/90" />}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-foreground text-xs truncate max-w-[140px]">{ad.name}</div>
            <div className="text-[10px] text-foreground/90 font-mono">{ad.id}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit({ id: ad.id, type: "ad", name: ad.name })} className="h-6 px-2 flex items-center gap-1.5 rounded bg-white/5 text-foreground/90 hover:text-foreground hover:bg-white/10 transition-colors text-[10px] font-medium border border-white/5">
            <Pencil className="h-3 w-3" /> Editar
          </button>
          <button
            onClick={() => onPreview(ad.id, ad.name)}
            title="Preview do anúncio"
            className="h-6 w-6 flex items-center justify-center rounded text-primary hover:bg-primary/10 transition-colors"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={() => onToggleStatus(ad.id, ad.status)}
            disabled={loadingId}
            title={isActive ? "Pausar anúncio" : "Ativar anúncio"}
            className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${isActive ? "text-emerald-400 hover:bg-emerald-500/10" : "text-muted-foreground hover:bg-muted/30"}`}
          >
            {loadingId ? <RefreshCw className="h-3 w-3 animate-spin" /> : isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
        </div>
      </td>
      <td className="px-4 py-2.5"><StatusBadge status={ad.status} /></td>
      <td className="px-4 py-2.5 text-xs text-foreground/90">—</td>
      {metricCols.map(col => (
        <td key={col.key} className="px-4 py-2.5 text-xs text-foreground/90 tabular-nums">
          {col.fmt((ad as Record<string, unknown>)[col.key])}
        </td>
      ))}
    </tr>
  );
}

// ── AdSet Row ──────────────────────────────────────────────────────────────────
function AdSetRow({
  adset, expandedAds, toggleAd, onEdit, onToggleStatus, loadingId, metricCols, onPreview,
}: {
  adset: AdSet;
  expandedAds: Set<string>;
  toggleAd: (id: string) => void;
  onEdit: (t: EditTarget) => void;
  onToggleStatus: (id: string, currentStatus: string, type: "adset") => void;
  loadingId: boolean;
  metricCols: typeof METRIC_COLS[MetricPreset];
  onPreview: (id: string, name: string) => void;
}) {
  const isExp = expandedAds.has(adset.id);
  const ads = adset.ads?.data || [];
  const isActive = adset.status === "ACTIVE";
  return (
    <>
      <tr className="border-b border-white/5 bg-zinc-900/50 hover:bg-white/[0.03] transition-colors duration-200 group">
        <td className="px-4 py-2.5 pl-10 max-w-[220px]">
          <div className="flex items-center gap-2">
            <button onClick={() => toggleAd(adset.id)} className="h-5 w-5 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-foreground/90 flex-shrink-0">
              {ads.length > 0 ? (isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : <div className="h-1 w-1 rounded-full bg-zinc-700" />}
            </button>
            <div className="min-w-0">
               <div className="font-medium text-accent/70 text-xs truncate max-w-[140px]">{adset.name}</div>
               <div className="text-[10px] text-primary/60 font-mono flex items-center gap-1">
                 <Layers className="h-2.5 w-2.5" /> {ads.length} anúncio{ads.length !== 1 ? "s" : ""}
               </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit({ id: adset.id, type: "adset", name: adset.name })} className="h-6 px-2 flex items-center gap-1.5 rounded bg-white/5 text-foreground/90 hover:text-foreground hover:bg-white/10 transition-colors text-[10px] font-medium border border-white/5">
              <Pencil className="h-3 w-3" /> Editar
            </button>
            <button
              onClick={() => onToggleStatus(adset.id, adset.status, "adset")}
              disabled={loadingId}
              title={isActive ? "Pausar conjunto" : "Ativar conjunto"}
              className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${isActive ? "text-emerald-400 hover:bg-emerald-500/10" : "text-muted-foreground hover:bg-muted/30"}`}
            >
              {loadingId ? <RefreshCw className="h-3 w-3 animate-spin" /> : isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
          </div>
        </td>
        <td className="px-4 py-2.5"><StatusBadge status={adset.status} /></td>
        <td className="px-4 py-2.5 text-xs text-accent/70/80 font-mono whitespace-nowrap">
          {adset.daily_budget ? fmt(adset.daily_budget) + "/dia" : adset.lifetime_budget ? fmt(adset.lifetime_budget) + "/total" : "—"}
        </td>
        {metricCols.map(col => (
          <td key={col.key} className="px-4 py-2.5 text-xs text-foreground/90 tabular-nums">
            {col.fmt((adset as Record<string, unknown>)[col.key])}
          </td>
        ))}
      </tr>
      {isExp && ads.map(a => (
        <AdRow
          key={a.id}
          ad={a as { [key: string]: unknown } & Ad}
          onEdit={onEdit}
          onToggleStatus={(id, status) => onToggleStatus(id, status, "adset")}
          loadingId={false}
          metricCols={metricCols}
          onPreview={onPreview}
        />
      ))}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TrafegoGerenciarPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [metricPreset, setMetricPreset] = useState<MetricPreset>("PERFORMANCE");
  const periodoGlobal = usePeriodoTrafego();
  const [expandedCamps, setExpandedCamps] = useState<Set<string>>(new Set());
  const [expandedAds, setExpandedAds] = useState<Set<string>>(new Set());
  // Lazy-loaded adsets cache: campanha_id → AdSet[]
  const [loadedAdsets, setLoadedAdsets] = useState<Record<string, AdSet[]>>({});
  const [loadingTree, setLoadingTree] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [previewTarget, setPreviewTarget] = useState<{ id: string; name: string } | null>(null);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [bulkSwapTarget, setBulkSwapTarget] = useState<{ id: string; name: string } | null>(null);
  const [dupTarget, setDupTarget] = useState<DupCampaignSource | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  const accountId = useAccountId();
  const acct = accountId ? `&account_id=${accountId}` : "";
  const since = periodoGlobal.dataInicio;
  const until = periodoGlobal.dataFim;
  // Investimento total centralizado (fonte única para todas as telas)
  const { totalSpend: unifiedSpend, totalLeads: unifiedLeads } = useAccountSpend(since, until);
  const swrKey = accountId ? `/api/meta/campanhas?since=${since}&until=${until}${acct}` : null;

  const { data, isLoading, error, mutate: revalidate } = useSWR<{ data: Campaign[]; since: string; until: string }>(
    swrKey, fetcher, { refreshInterval: 120000, revalidateOnFocus: false }
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync completo: limpa cache do servidor + revalida SWR + limpa árvore local

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 1. Limpar cache servidor para forçar dados frescos do Meta
      await fetch("/api/meta/cache-clear", { method: "POST" });
      // 2. Limpar árvore lazy-loaded (força reexpandir ao clicar)
      setLoadedAdsets({});
      setExpandedCamps(new Set());
      setExpandedAds(new Set());
      // 3. Revalidar SWR
      await revalidate();
    } finally {
      setIsRefreshing(false);
    }
  }, [revalidate]);

  const campaigns = (data?.data || []).filter((c) => {
    let statusOk = c.status !== "DELETED" && c.status !== "ARCHIVED";
    if (statusFilter === "ACTIVE" || statusFilter === "PAUSED") {
      statusOk = c.status === statusFilter;
    } else if (statusFilter === "RECENT") {
      if (!c.created_time) statusOk = false;
      else {
         const createdAt = new Date(c.created_time).getTime();
         const daysAgo = (Date.now() - createdAt) / 86400000;
         statusOk = daysAgo <= 14;
      }
    }
    const searchOk = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase());
    return statusOk && searchOk;
  }).sort((a, b) => {
    // Active first, then by spend descending
    if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
    if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
    return b.spend - a.spend;
  });

  const paginatedCampaigns = campaigns.slice(0, visibleCount);
  const hasMoreCampaigns = visibleCount < campaigns.length;

  // Usar fonte unificada para KPIs (mesma fonte que todas as telas de tráfego)
  const totalSpend = unifiedSpend;
  const totalLeads = unifiedLeads;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
  const totalBudget = activeCampaigns.reduce((s, c) => s + (c.daily_budget || 0), 0);
  const ativos = activeCampaigns.length;

  const toggleCamp = useCallback(async (id: string) => {
    setExpandedCamps(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    // Lazy load adsets on first expand
    if (!loadedAdsets[id]) {
      setLoadingTree(s => new Set([...s, id]));
      try {
        // Trazendo dados com base nos filtros de data atuais, incluindo revalidator para reset de cache
        const res = await fetch(`/api/meta/campaign-tree?campaign_id=${id}&since=${since}&until=${until}&t=${revalidate}${acct}`);
        const json = await res.json();
        if (res.ok && json.data) {
          setLoadedAdsets(prev => ({ ...prev, [id]: json.data }));
        }
      } catch (e) {
        console.error("[campaign-tree] erro ao carregar:", e);
      } finally {
        setLoadingTree(s => { const n = new Set(s); n.delete(id); return n; });
      }
    }
  }, [loadedAdsets, since, until, revalidate]);
  const toggleAd = (id: string) => {
    setExpandedAds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleStatus = useCallback(async (id: string, currentStatus: string, tipo: "campaign" | "adset" | "ad" = "campaign") => {
    const isActive = currentStatus === "ACTIVE";
    setLoadingIds(ids => new Set([...ids, id]));
    try {
      await fetch(`/api/meta/${isActive ? "pausar" : "ativar"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, objeto_id: id }),
      });
      await refresh();
    } finally {
      setLoadingIds(ids => { const s = new Set(ids); s.delete(id); return s; });
    }
  }, [refresh]);

  const duplicate = useCallback(async (id: string, tipo: "campaign" | "adset" | "ad" = "campaign") => {
    setLoadingIds(ids => new Set([...ids, id + "-dup"]));
    try {
      await fetch("/api/meta/duplicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objeto_id: id, tipo, deep_copy: true }),
      }).then(r => r.json());
      await refresh();
    } finally {
      setLoadingIds(ids => { const s = new Set(ids); s.delete(id + "-dup"); return s; });
    }
  }, [refresh]);

  const metricCols = METRIC_COLS[metricPreset];
  const colHeaders = ["Estrutura", "Ações", "Status", "Budget/Dia", ...metricCols.map(c => c.label)];

  if (isLoading && (!data || !data.data.length)) {
    return <TabLoading message="Sincronizando Estrutura..." />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20 pt-4 px-2 md:px-0">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex flex-col">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground flex items-center gap-3">
            Gerenciar Tráfego
          </h1>
          <p className="text-foreground/90 font-medium text-sm mt-2 max-w-[500px] tracking-tight">
            Estação de Trabalho · Sincronização de <span className="text-foreground font-bold">{since}</span> a <span className="text-foreground font-bold">{until}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <Button 
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isRefreshing}
            className="gap-1.5 border-white/10 bg-transparent text-foreground/90 hover:text-foreground hover:bg-white/5 transition-all h-9 px-4 rounded-xl font-medium"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Sincronizando..." : "Sincronizar Meta"}
          </Button>
          <Button  size="sm" className="gap-1.5 bg-foreground text-background hover:bg-foreground/90 border-0 h-9 px-5 rounded-xl font-bold tracking-tight transition-all" onClick={() => setIsCreating(true)}>
            Nova Campanha
          </Button>
        </div>
      </motion.div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 auto-rows-min">
        {[
          { icon: BarChart3, label: "Campanhas Ativas", value: String(ativos), color: "text-foreground" },
          { icon: DollarSign, label: "Budget Diário Total", value: fmt(totalBudget), color: "text-foreground" },
          { icon: Zap, label: "Gasto no Período", value: fmt(totalSpend), color: "text-foreground" },
          { icon: Users, label: "Leads Gerados", value: fmtNum(totalLeads), color: "text-foreground" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}>
            <SpotlightCard className="h-full p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-6">
                <span className="text-[10px] uppercase tracking-[0.15em] font-medium text-foreground/90">{kpi.label}</span>
                <kpi.icon size={18} className="text-foreground/50" />
              </div>
              <p className="text-4xl font-bold tracking-tighter text-foreground/90">{kpi.value}</p>
            </SpotlightCard>
          </motion.div>
        ))}
      </div>

      {/* ── Controls Bar ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 mt-6">
        {/* Period is now controlled by the global selector in the layout */}
        <div className="flex items-center gap-2 text-xs text-foreground/50">
          <Calendar className="h-3.5 w-3.5" />
          <span>{since} → {until}</span>
        </div>

        <div className="hidden md:block w-px h-6 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-1" />

        {/* Metric Presets */}
        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] rounded-xl p-1 backdrop-blur-md">
          <BarChart3  className="h-3.5 w-3.5 text-foreground/50 ml-2 mr-1" />
          {([
            { key: "PERFORMANCE", label: "Desempenho" },
            { key: "PERFORMANCE_CLICKS", label: "Performance + Cliques" },
            { key: "ENGAGEMENT", label: "Engajamento" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMetricPreset(key as MetricPreset)}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.05em] rounded-lg font-bold transition-all ${metricPreset === key ? "bg-white/10 text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground hover:bg-white/5"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="hidden md:block w-px h-6 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-1" />

        {/* Status filter */}
        <div className="flex items-center gap-1">
        {(["ALL", "ACTIVE", "PAUSED", "RECENT"] as StatusFilter[]).map(f => (
          <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 text-[11px] tracking-[0.05em] rounded-lg font-bold uppercase transition-all ${statusFilter === f ? "bg-foreground/10 text-foreground/90 border border-white/10" : "text-foreground/60 hover:text-foreground hover:bg-white/5 border border-transparent"}`}>
            {f === "ALL" ? "Todas" : f === "ACTIVE" ? "Ativas" : f === "PAUSED" ? "Pausadas" : "Recentes (14d)"}
          </button>
        ))}
        </div>

        {/* Search */}
        <div className="ml-auto flex flex-1 md:flex-none items-center gap-2 bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] rounded-xl px-3 py-2 backdrop-blur-md focus-within:border-white/20 transition-all">
          <Filter  className="h-3.5 w-3.5 text-foreground/50" />
          <input
            type="text"
            placeholder="Filtrar campanhas..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-foreground outline-none placeholder:text-foreground/40 w-full min-w-[160px] font-medium tracking-wide"
          />
        </div>
      </motion.div>

      {/* ── Nested Table ── */}
      <SpotlightCard className="overflow-hidden min-h-[400px] mt-6 flex flex-col">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-foreground/60 font-mono tracking-widest uppercase">Sincronizando árvore via Graph API...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-primary">
            <AlertTriangle className="h-6 w-6" />
            <span className="text-sm font-medium tracking-tight">Erro ao carregar campanhas</span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-foreground/90">
            <Target className="h-10 w-10 opacity-10 mb-2" />
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-foreground/60 text-center">Nenhuma campanha na estação</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-transparent sticky top-0 z-10 backdrop-blur-md">
                  {colHeaders.map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-[9px] font-bold tracking-[0.15em] uppercase text-foreground/60 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedCampaigns.map((c) => {
                  const isExp = expandedCamps.has(c.id);
                  const adsets = loadedAdsets[c.id] || [];
                  const isTreeLoading = loadingTree.has(c.id);
                  const isActive = c.status === "ACTIVE";
                  const isSaving = loadingIds.has(c.id);
                  const isDuping = loadingIds.has(c.id + "-dup");
                  return (
                    <React.Fragment key={c.id}>
                      <tr className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                        {/* Campaign Name */}
                        <td className="px-6 py-4 max-w-[280px]">
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleCamp(c.id)} className="h-5 w-5 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-foreground flex-shrink-0">
                              {isTreeLoading
                                ? <RefreshCw  className="h-3 w-3 animate-spin text-primary" />
                                : isExp
                                  ? <ChevronDown className="h-3 w-3" />
                                  : <ChevronRight className="h-3 w-3" />}
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                                <span className="truncate max-w-[160px]">{c.name}</span>
                                {/nova campanha|tree build/i.test(c.name) && (
                                  <span className="text-amber-400 shrink-0 cursor-help group/alert relative">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    <span className="invisible group-hover/alert:visible absolute left-full ml-1 top-1/2 -translate-y-1/2 z-50 w-48 p-2 text-[10px] text-muted-foreground bg-card border rounded-lg shadow-lg leading-relaxed whitespace-normal">
                                      Campanha usando nome padrao. Possivel duplicacao ou campanha nao configurada. Clique em Editar para renomear.
                                    </span>
                                  </span>
                                )}
                                {c.leads === 0 && c.spend > 50 && c.status === "ACTIVE" && (
                                  <span className="text-red-400 shrink-0 cursor-help group/alert relative">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    <span className="invisible group-hover/alert:visible absolute left-full ml-1 top-1/2 -translate-y-1/2 z-50 w-48 p-2 text-[10px] text-muted-foreground bg-card border rounded-lg shadow-lg leading-relaxed whitespace-normal">
                                      Campanha ativa com R${c.spend.toFixed(0)} gastos e zero leads. Verificar configuracao do formulario ou segmentacao.
                                    </span>
                                  </span>
                                )}
                                {c.cpl != null && c.cpl > 130 && c.leads > 0 && (
                                  <span className="text-orange-400 shrink-0 cursor-help group/alert relative">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    <span className="invisible group-hover/alert:visible absolute left-full ml-1 top-1/2 -translate-y-1/2 z-50 w-48 p-2 text-[10px] text-muted-foreground bg-card border rounded-lg shadow-lg leading-relaxed whitespace-normal">
                                      CPL de R${c.cpl.toFixed(0)} acima da meta. Revisar anuncios e segmentacao.
                                    </span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-foreground/90 truncate">{OBJECTIVE_PT[c.objective] || c.objective}</span>
                                {adsets.length > 0 && <span className="text-[9px] text-foreground/90">{adsets.length} conjunto{adsets.length !== 1 ? "s" : ""}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        {/* Actions Em Primeiro Plano */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditTarget({ id: c.id, type: "campaign", name: c.name })}
                              className="h-7 px-2.5 flex items-center gap-1.5 rounded-md bg-white/5 text-foreground/90 hover:text-foreground hover:bg-primary/20 transition-all font-medium text-[10px] uppercase tracking-wide border border-white/5"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </button>
                            <button
                              onClick={() => setDupTarget({
                                id: c.id,
                                name: c.name,
                                objective: c.objective,
                                daily_budget: c.daily_budget,
                                lifetime_budget: c.lifetime_budget,
                                status: c.status,
                              })}
                              title="Duplicar e editar campanha"
                              className="h-7 px-2 flex items-center gap-1.5 rounded-md bg-white/5 text-foreground/90 hover:text-foreground hover:bg-primary/20 transition-all font-medium text-[10px] uppercase border border-white/5"
                            >
                              <Copy className="h-3.5 w-3.5" /><span className="hidden xl:inline">Dup.</span>
                            </button>
                            <button
                              onClick={() => toggleStatus(c.id, c.status)}
                              disabled={isSaving}
                              title={isActive ? "Pausar" : "Ativar"}
                              className={`h-7 w-7 flex items-center justify-center rounded-md border border-white/5 transition-colors ${isActive ? "text-emerald-400 hover:bg-emerald-500/10" : "text-muted-foreground hover:bg-muted/30"}`}
                            >
                            {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </button>
                            <a
                              href={`https://business.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${c.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir no Ads Manager"
                              className="h-7 w-7 flex items-center justify-center rounded-md border border-white/5 text-foreground/90 hover:text-foreground/90 hover:bg-white/5 transition-colors ml-1"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              onClick={() => setBulkSwapTarget({ id: c.id, name: c.name })}
                              title="Troca de Criativos em Massa"
                              className="h-7 px-2.5 flex items-center gap-1.5 rounded-md bg-white/5 text-foreground/90 hover:text-foreground hover:bg-primary/20 transition-all font-medium text-[10px] uppercase tracking-wide border border-white/5 ml-1"
                            >
                              <Zap className="h-3.5 w-3.5 text-primary" /><span className="hidden xl:inline">Criativos</span>
                            </button>
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        {/* Budget + Pace */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="text-xs text-foreground/90 font-mono">{c.daily_budget ? fmt(c.daily_budget) + "/dia" : "—"}</div>
                            <div className="flex items-center gap-1.5">
                              <PaceBadge pace={c.pace_status} expected={c.expected_spend_today} />
                              <BudgetBar spend={c.spend_today || 0} budget={c.daily_budget} />
                            </div>
                          </div>
                        </td>
                        {/* Dynamic Metric Cols */}
                        {metricCols.map(col => (
                          <td key={col.key} className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-foreground tabular-nums">
                            {col.fmt((c as Record<string, unknown>)[col.key])}
                          </td>
                        ))}
                      </tr>
                      {/* Expanded AdSets (lazy loaded) */}
                      {isExp && isTreeLoading && (
                        <tr className="border-b border-white/5">
                          <td colSpan={colHeaders.length} className="px-12 py-3">
                            <div className="flex items-center gap-2 text-xs text-foreground/90">
                              <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                              Carregando conjuntos e anúncios...
                            </div>
                          </td>
                        </tr>
                      )}
                      {isExp && !isTreeLoading && adsets.map(ast => (
                        <AdSetRow
                          key={ast.id}
                          adset={ast as { [key: string]: unknown } & AdSet}
                          expandedAds={expandedAds}
                          toggleAd={toggleAd}
                          onEdit={setEditTarget}
                          onToggleStatus={(id, status) => toggleStatus(id, status, "adset")}
                          loadingId={loadingIds.has(ast.id)}
                          metricCols={metricCols}
                          onPreview={(id, name) => setPreviewTarget({ id, name })}
                        />
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {campaigns.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/5">
            <p className="text-[11px] text-foreground/50">
              Mostrando 1–{Math.min(visibleCount, campaigns.length)} de {campaigns.length} campanhas
            </p>
            {hasMoreCampaigns && (
              <button
                onClick={() => setVisibleCount(prev => prev + 20)}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Carregar mais 20
              </button>
            )}
          </div>
        )}
      </SpotlightCard>

      {/* ── Full Edit Drawer ── */}
      <AnimatePresence>
        {editTarget && (
          <FullEditDrawer
            target={editTarget}
            onClose={() => setEditTarget(null)}
            onSaved={refresh}
          />
        )}
      </AnimatePresence>

      {/* ── Criar Campanha Drawer ── */}
      <AnimatePresence>
        {isCreating && (
          <CriarCampanhaDrawer
            onClose={() => setIsCreating(false)}
            onCreated={refresh}
          />
        )}
      </AnimatePresence>

      {/* ── Ad Preview Modal ── */}
      <AnimatePresence>
        {previewTarget && (
          <AdPreviewModal
            adId={previewTarget.id}
            adName={previewTarget.name}
            onClose={() => setPreviewTarget(null)}
          />
        )}
      </AnimatePresence>
      {/* ── Bulk Creative Swap ── */}
      <AnimatePresence>
        {bulkSwapTarget && (
          <BulkCreativeSwap
            campaignId={bulkSwapTarget.id}
            campaignName={bulkSwapTarget.name}
            onClose={() => setBulkSwapTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Duplicar Campanha Drawer ── */}
      <AnimatePresence>
        {dupTarget && (
          <DuplicarCampanhaDrawer
            sourceCampaign={dupTarget}
            onClose={() => setDupTarget(null)}
            onCreated={refresh}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
