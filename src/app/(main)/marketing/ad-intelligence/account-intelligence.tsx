"use client";

/**
 * AccountIntelligence 2.0
 * UI de análise vertical: Funil | Criativos | Públicos | Posicionamento | Alertas
 *
 * Fixes vs v1:
 * - MetricBadge com formatação monetária R$ correta (A2)
 * - FunnelTab aceita since/until via props e mostra skeleton para adsets/ads (C3, A1)
 * - Loading skeletons premium em todas as abas (M1, M4)
 * - AlertsTab com loading state por item para evitar race condition (M3)
 * - Sem `any` nos tipos de ícone e listas (M6)
 * - Props since/until recebidas do page.tsx (C3)
 */

import { useState, useCallback, useId } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Zap, AlertTriangle, TrendingDown, TrendingUp, ChevronRight,
  ChevronDown, ImageIcon, VideoIcon, Layers, BarChart2, Users, MapPin,
  Target, RefreshCw, CheckCircle2, X, Flame, Clock,
  Filter, LayoutGrid, PauseCircle, PlayCircle,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ── Types ─────────────────────────────────────────────────────────────────────

interface CampaignRow {
  id: string; name: string; status?: string;
  spend: number; leads: number; cpl: number | null;
  ctr: number | null; score: number; parent_id?: string;
}

interface Creative {
  ad_id: string; ad_name: string; adset_id: string; adset_name: string;
  campaign_id: string; campaign_name: string;
  format: "image" | "video" | "carousel" | "unknown";
  title: string | null; body: string | null;
  call_to_action: string | null;
  thumbnail_url: string | null;
  status: string; effective_status: string;
  spend: number; leads: number; cpl: number | null; ctr: number | null;
  score: number; impressions: number;
  alerts: AdAlert[];
  has_alert: boolean; worst_severity: string | null;
}

interface Targeting {
  adset_id: string; adset_name: string; campaign_name: string;
  age_min: number | null; age_max: number | null; genders: number[] | null;
  interests: Array<{ id: string; name: string }> | null;
  behaviors: Array<{ id: string; name: string }> | null;
  custom_audiences: Array<{ id: string; name: string }> | null;
  publisher_platforms: string[] | null;
  facebook_positions: string[] | null;
  instagram_positions: string[] | null;
  optimization_goal: string | null; status: string;
  spend: number; leads: number; cpl: number | null; score: number;
}

interface InterestRow {
  name: string; count: number; total_leads: number;
  total_spend: number; avg_cpl: number | null;
}

interface PlacementRow {
  placement_label: string; platform: string; placement: string;
  spend: number; leads: number; cpl: number | null; ctr: number | null;
  cpm: number | null; delta_cpl: number | null; share_spend: number;
}

interface AdAlert {
  id: string; alert_type: string; severity: string;
  title: string; reason: string; entity_name: string; entity_level: string;
  metric_value: number | null; metric_baseline: number | null;
  delta_pct: number | null; status: string; created_at: string;
}

// ── Severity config ────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { label: string; cls: string; icon: LucideIcon }> = {
  critical: { label: "Crítico", cls: "text-red-400 border-red-500/20 bg-red-500/10",     icon: Flame },
  high:     { label: "Alto",    cls: "text-primary border-primary/20 bg-primary/10", icon: AlertTriangle },
  medium:   { label: "Médio",   cls: "text-amber-400 border-amber-500/20 bg-amber-500/10",  icon: Clock },
  low:      { label: "Baixo",   cls: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10", icon: CheckCircle2 },
};

const FORMAT_ICON: Record<string, LucideIcon> = {
  image: ImageIcon, video: VideoIcon, carousel: Layers,
};

// ── Primitive helpers ──────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 70
    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : score >= 40
    ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
    : "text-red-400 bg-red-500/10 border-red-500/20";
  const label = score >= 70 ? "Top" : score >= 40 ? "Médio" : "Crítico";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-widest shrink-0", cls)}>
      {score} <span className="opacity-70">{label}</span>
    </span>
  );
}

const MONETARY_LABELS = new Set(["Invest.", "CPL", "CPM", "CPC", "R$"]);

function MetricBadge({ value, label }: { value: number | null; label: string }) {
  if (value === null || value === undefined) {
    return (
      <div className="flex flex-col min-w-[40px]">
        <span className="text-[9px] text-zinc-600 uppercase tracking-widest">{label}</span>
        <span className="text-xs font-mono text-zinc-600">—</span>
      </div>
    );
  }
  const isMonetary = MONETARY_LABELS.has(label);
  const formatted = isMonetary
    ? `R$${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : label === "CTR%"
    ? `${value.toFixed(2)}%`
    : value.toFixed(0);

  return (
    <div className="flex flex-col min-w-[40px]">
      <span className="text-[9px] text-zinc-500 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-mono font-bold">{formatted}</span>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const up = delta > 0;
  return (
    <span className={cn("flex items-center gap-0.5 text-[10px] font-bold", up ? "text-red-400" : "text-emerald-400")}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

function StatusDot({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
      status === "ACTIVE" ? "bg-emerald-400" : "bg-zinc-600"
    )} title={status} />
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonRows({ count = 4, height = "h-12" }: { count?: number; height?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(height, "rounded-xl bg-white/[0.025] animate-pulse")} />
      ))}
    </div>
  );
}

function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-56 rounded-2xl bg-white/[0.025] animate-pulse" />
      ))}
    </div>
  );
}

// ── Tab: Funil ─────────────────────────────────────────────────────────────────

function FunnelTab({ accountId, since, until }: { accountId: string; since: string; until: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());

  const qs = `account_id=${accountId}&since=${since}&until=${until}`;

  const { data: campaignData, isLoading: campLoading } = useSWR(
    `/api/meta/insights?${qs}&level=campaign&breakdown=none`,
    fetcher, { revalidateOnFocus: false }
  );
  const { data: adsetData, isLoading: adsetLoading } = useSWR(
    `/api/meta/insights?${qs}&level=adset`,
    fetcher, { revalidateOnFocus: false }
  );
  const { data: adData, isLoading: adLoading } = useSWR(
    `/api/meta/insights?${qs}&level=ad`,
    fetcher, { revalidateOnFocus: false }
  );

  const campaigns: CampaignRow[] = campaignData?.data || [];
  const adsets: CampaignRow[] = adsetData?.data || [];
  const ads: CampaignRow[] = adData?.data || [];

  if (campLoading) return <SkeletonRows count={5} height="h-14" />;

  return (
    <div className="space-y-2">
      {campaigns.length === 0 && (
        <div className="text-center py-16 text-zinc-500 text-sm">
          Nenhuma campanha com dados no período selecionado.
        </div>
      )}

      {campaigns.map(c => {
        const isOpen = expanded.has(c.id);
        const campAdsets = adsets.filter(a => a.parent_id === c.id);

        return (
          <div key={c.id} className="rounded-xl border border-white/5 bg-white/[0.01] overflow-hidden">
            {/* Campanha */}
            <button
              onClick={() => setExpanded(prev => {
                const s = new Set(prev);
                s.has(c.id) ? s.delete(c.id) : s.add(c.id);
                return s;
              })}
              className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors text-left"
            >
              {isOpen
                ? <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />
                : <ChevronRight className="h-4 w-4 text-zinc-500 shrink-0" />
              }
              <StatusDot status={c.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.name}</p>
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Campanha</p>
              </div>
              <div className="flex items-center gap-5 shrink-0">
                <MetricBadge value={c.spend} label="Invest." />
                <MetricBadge value={c.leads} label="Leads" />
                <MetricBadge value={c.cpl} label="CPL" />
                <MetricBadge value={c.ctr} label="CTR%" />
                <ScoreBadge score={c.score || 0} />
              </div>
            </button>

            {/* Adsets */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {adsetLoading ? (
                    <div className="pl-10 pr-4 py-3">
                      <SkeletonRows count={2} height="h-10" />
                    </div>
                  ) : campAdsets.length === 0 ? (
                    <p className="text-center py-4 text-zinc-600 text-xs">
                      Nenhum conjunto de anúncios com dados neste período
                    </p>
                  ) : (
                    campAdsets.map(as => {
                      const adsetOpen = expandedAdsets.has(as.id);
                      const adsetAds = ads.filter(a => a.parent_id === as.id);

                      return (
                        <div key={as.id} className="border-t border-white/5">
                          <button
                            onClick={() => setExpandedAdsets(prev => {
                              const s = new Set(prev);
                              s.has(as.id) ? s.delete(as.id) : s.add(as.id);
                              return s;
                            })}
                            className="w-full flex items-center gap-3 pl-10 pr-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                          >
                            {adsetOpen
                              ? <ChevronDown className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                              : <ChevronRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                            }
                            <StatusDot status={as.status} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{as.name}</p>
                              <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Conjunto</p>
                            </div>
                            <div className="flex items-center gap-5 shrink-0">
                              <MetricBadge value={as.spend} label="Invest." />
                              <MetricBadge value={as.leads} label="Leads" />
                              <MetricBadge value={as.cpl} label="CPL" />
                              <MetricBadge value={as.ctr} label="CTR%" />
                              <ScoreBadge score={as.score || 0} />
                            </div>
                          </button>

                          {/* Ads */}
                          <AnimatePresence>
                            {adsetOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                              >
                                {adLoading ? (
                                  <div className="pl-16 pr-4 py-2">
                                    <SkeletonRows count={2} height="h-8" />
                                  </div>
                                ) : adsetAds.length === 0 ? (
                                  <p className="pl-16 py-2 text-[11px] text-zinc-600">
                                    Sem anúncios com dados no período
                                  </p>
                                ) : (
                                  adsetAds.map(ad => (
                                    <div
                                      key={ad.id}
                                      className="flex items-center gap-3 pl-16 pr-4 py-2.5 border-t border-white/5 hover:bg-white/[0.02] transition-colors"
                                    >
                                      <Zap className="h-3 w-3 text-zinc-600 shrink-0" />
                                      <StatusDot status={ad.status} />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[11px] truncate">{ad.name}</p>
                                        <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Anúncio</p>
                                      </div>
                                      <div className="flex items-center gap-5 shrink-0">
                                        <MetricBadge value={ad.spend} label="Invest." />
                                        <MetricBadge value={ad.leads} label="Leads" />
                                        <MetricBadge value={ad.cpl} label="CPL" />
                                        <MetricBadge value={ad.ctr} label="CTR%" />
                                        <ScoreBadge score={ad.score || 0} />
                                      </div>
                                    </div>
                                  ))
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Criativos ─────────────────────────────────────────────────────────────

function CreativesTab({ accountId }: { accountId: string }) {
  const [sortBy, setSortBy] = useState("score_desc");
  const [filterFormat, setFilterFormat] = useState("all");
  const [expandedBody, setExpandedBody] = useState<string | null>(null);

  const { data, isLoading } = useSWR(
    `/api/ad-intelligence/creatives/${accountId}?sort=${sortBy}${filterFormat !== "all" ? `&format=${filterFormat}` : ""}`,
    fetcher, { revalidateOnFocus: false }
  );

  const creatives: Creative[] = data?.data || [];
  const formatSummary: Record<string, { count: number }> = data?.format_summary || {};

  if (isLoading) return <SkeletonCards />;

  if (creatives.length === 0) return (
    <div className="text-center py-16 text-zinc-500">
      <Layers className="h-10 w-10 mx-auto mb-3 opacity-20" />
      <p className="text-sm">Nenhum criativo. Execute o Sync primeiro.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-black/40 border border-white/10 rounded-lg p-1">
          {(["all", "image", "video", "carousel"] as const).map(f => {
            const FmtIcon = f === "all" ? LayoutGrid : f === "image" ? ImageIcon : f === "video" ? VideoIcon : Layers;
            return (
              <button
                key={f}
                onClick={() => setFilterFormat(f)}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all flex items-center gap-1",
                  filterFormat === f ? "bg-accent text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <FmtIcon className="h-3 w-3" />
                {f === "all" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== "all" && formatSummary[f] && (
                  <span className="ml-1 opacity-70">({formatSummary[f].count})</span>
                )}
              </button>
            );
          })}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-accent/50 text-foreground"
        >
          <option value="score_desc">Score ↓</option>
          <option value="score_asc">Score ↑</option>
          <option value="leads_desc">Leads ↓</option>
          <option value="cpl_asc">CPL — melhor</option>
          <option value="cpl_desc">CPL — pior</option>
          <option value="spend_desc">Investimento ↓</option>
        </select>
        <span className="text-[11px] text-zinc-500 ml-auto">{creatives.length} criativos</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {creatives.map(cr => {
          const FmtIcon = FORMAT_ICON[cr.format] || Layers;
          const isBodyOpen = expandedBody === cr.ad_id;
          const severityConf = cr.worst_severity ? SEVERITY_CONFIG[cr.worst_severity] : null;

          return (
            <motion.div key={cr.ad_id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <SpotlightCard
                className={cn(
                  "flex flex-col h-full p-4 border-white/5 hover:border-white/10 transition-colors",
                  cr.worst_severity === "critical" && "border-red-500/20",
                  cr.worst_severity === "high" && "border-primary/20"
                )}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  {cr.thumbnail_url ? (
                    <img
                      src={cr.thumbnail_url}
                      alt=""
                      className="h-14 w-14 rounded-lg object-cover shrink-0 border border-white/10"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <FmtIcon className="h-6 w-6 text-zinc-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FmtIcon className="h-3 w-3 text-zinc-500 shrink-0" />
                      <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">{cr.format}</span>
                      {severityConf && (
                        <span className={cn("text-[8px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-widest", severityConf.cls)}>
                          {severityConf.label}
                        </span>
                      )}
                      <StatusDot status={cr.effective_status} />
                    </div>
                    <p className="text-xs font-semibold truncate leading-tight">{cr.ad_name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{cr.campaign_name}</p>
                  </div>
                  <ScoreBadge score={cr.score} />
                </div>

                {/* Copy preview */}
                {(cr.title || cr.body) && (
                  <div
                    className={cn(
                      "bg-white/[0.02] border border-white/5 rounded-lg p-3 mb-3 cursor-pointer hover:border-white/10 transition-colors",
                      isBodyOpen && "border-primary/20"
                    )}
                    onClick={() => setExpandedBody(isBodyOpen ? null : cr.ad_id)}
                  >
                    {cr.title && <p className="text-[11px] font-bold mb-1 leading-tight">{cr.title}</p>}
                    {cr.body && (
                      <p className={cn("text-[10px] text-zinc-400 leading-relaxed", !isBodyOpen && "line-clamp-2")}>
                        {cr.body}
                      </p>
                    )}
                    {cr.call_to_action && (
                      <span className="mt-2 inline-block text-[9px] font-bold uppercase tracking-widest text-primary border border-primary/20 bg-accent/5 px-2 py-0.5 rounded">
                        {cr.call_to_action}
                      </span>
                    )}
                  </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 mt-auto">
                  {[
                    { label: "Invest.", value: cr.spend > 0 ? cr.spend : null },
                    { label: "Leads",   value: cr.leads },
                    { label: "CPL",     value: cr.cpl },
                  ].map(m => (
                    <div key={m.label} className="bg-white/[0.02] rounded-lg p-2 text-center">
                      <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{m.label}</p>
                      <p className="text-xs font-mono font-bold">
                        {m.value === null || m.value === undefined ? "—"
                          : m.label === "Invest." || m.label === "CPL"
                          ? `R$${(m.value as number).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : (m.value as number).toFixed(0)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Alerts inline */}
                {cr.alerts.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {cr.alerts.slice(0, 2).map((a, i) => {
                      const sc = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.low;
                      const AlertIcon = sc.icon;
                      const borderBg = sc.cls.split(" ").filter(c => c.startsWith("bg") || c.startsWith("border")).join(" ");
                      return (
                        <div key={i} className={cn("flex items-center gap-2 rounded-lg border p-2", borderBg)}>
                          <AlertIcon className="h-3 w-3 shrink-0" />
                          <span className="text-[10px] font-medium truncate">{a.title}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SpotlightCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Públicos ──────────────────────────────────────────────────────────────

function TargetingTab({ accountId }: { accountId: string }) {
  const { data, isLoading } = useSWR(
    `/api/ad-intelligence/targeting/${accountId}`,
    fetcher, { revalidateOnFocus: false }
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <SkeletonRows count={6} height="h-14" />;

  const targeting: Targeting[] = data?.data || [];
  const topInterests: InterestRow[] = data?.top_interests || [];
  const genderAnalysis: Record<string, { count: number; total_leads: number; total_spend: number }> = data?.gender_analysis || {};

  if (targeting.length === 0) return (
    <div className="text-center py-16 text-zinc-500 text-sm">
      Nenhum dado de targeting. Execute o Sync primeiro.
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Interesses */}
      {topInterests.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Interesses com Melhor Performance
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
            {topInterests.slice(0, 12).map((interest, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <p className="text-[11px] font-semibold truncate mb-2">{interest.name}</p>
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>{interest.total_leads} leads</span>
                  {interest.avg_cpl !== null && (
                    <span>CPL R${interest.avg_cpl.toFixed(0)}</span>
                  )}
                </div>
                <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{
                      width: `${Math.min(100, (interest.total_leads / (topInterests[0]?.total_leads || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[9px] text-zinc-600">{interest.count} conjuntos</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Análise de gênero */}
      {Object.keys(genderAnalysis).length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Análise Demográfica
          </h3>
          <div className="flex gap-3">
            {Object.entries(genderAnalysis).map(([gender, d]) => (
              <div key={gender} className="flex-1 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <p className="text-xs font-bold mb-2">{gender}</p>
                <p className="text-2xl font-black text-foreground/90">{d.total_leads}</p>
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">leads totais</p>
                <p className="text-[10px] text-zinc-400 mt-2">
                  {d.total_leads > 0
                    ? `CPL médio R$${(d.total_spend / d.total_leads).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
                    : "Sem dados"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adsets */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" /> Conjuntos ({targeting.length})
        </h3>
        <div className="space-y-2">
          {targeting.map(t => {
            const isOpen = expanded === t.adset_id;
            const allPositions = [...(t.facebook_positions || []), ...(t.instagram_positions || [])];
            return (
              <div key={t.adset_id} className="rounded-xl border border-white/5 bg-white/[0.01] overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : t.adset_id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors text-left"
                >
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-zinc-500 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{t.adset_name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{t.campaign_name}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {t.age_min && (
                      <span className="text-[10px] text-zinc-400">{t.age_min}–{t.age_max || "65+"}a</span>
                    )}
                    <MetricBadge value={t.leads} label="Leads" />
                    <MetricBadge value={t.cpl} label="CPL" />
                    <ScoreBadge score={t.score} />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 p-4 grid grid-cols-1 md:grid-cols-3 gap-4"
                    >
                      {t.interests && t.interests.length > 0 && (
                        <div>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">Interesses</p>
                          <div className="flex flex-wrap gap-1">
                            {t.interests.slice(0, 8).map((interest, idx) => (
                              <span key={idx} className="text-[10px] bg-accent/5 border border-accent/15 text-accent/70 px-2 py-0.5 rounded-full">
                                {interest.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {t.custom_audiences && t.custom_audiences.length > 0 && (
                        <div>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">Audiências Customizadas</p>
                          <div className="flex flex-wrap gap-1">
                            {t.custom_audiences.map((a, idx) => (
                              <span key={idx} className="text-[10px] bg-white/5 border border-white/10 text-zinc-300 px-2 py-0.5 rounded-full">
                                {a.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {allPositions.length > 0 && (
                        <div>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">Posicionamentos</p>
                          <div className="flex flex-wrap gap-1">
                            {allPositions.map((pos, idx) => (
                              <span key={idx} className="text-[10px] bg-white/5 border border-white/10 text-zinc-400 px-2 py-0.5 rounded-full capitalize">
                                {pos.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Posicionamento ────────────────────────────────────────────────────────

function PlacementsTab({ accountId }: { accountId: string }) {
  const { data, isLoading } = useSWR(
    `/api/ad-intelligence/placements/${accountId}`,
    fetcher, { revalidateOnFocus: false }
  );

  if (isLoading) return <SkeletonRows count={6} height="h-12" />;

  const placements: PlacementRow[] = data?.data || [];
  const best = data?.best_placement as { placement: string; platform: string; cpl: number } | null;
  const worst = data?.worst_placement as { placement: string; platform: string; cpl: number } | null;

  if (placements.length === 0) return (
    <div className="text-center py-16 text-zinc-500 text-sm">
      Nenhum dado de posicionamento. Execute o Sync primeiro.
    </div>
  );

  const maxSpend = Math.max(...placements.map(p => p.spend || 0), 1);
  const maxLeads = Math.max(...placements.map(p => p.leads || 0), 1);

  return (
    <div className="space-y-6">
      {/* Destaques */}
      {(best || worst) && (
        <div className="grid grid-cols-2 gap-4">
          {best && (
            <SpotlightCard className="p-5 border-emerald-500/20 bg-emerald-500/5">
              <p className="text-[9px] uppercase tracking-widest text-emerald-400 font-bold mb-2 flex items-center gap-1.5">
                <TrendingDown className="h-3 w-3" /> Menor CPL (Melhor)
              </p>
              <p className="text-base font-bold">
                {best.placement} <span className="text-zinc-500 text-sm">({best.platform})</span>
              </p>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                R${best.cpl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </SpotlightCard>
          )}
          {worst && (
            <SpotlightCard className="p-5 border-red-500/20 bg-red-500/5">
              <p className="text-[9px] uppercase tracking-widest text-red-400 font-bold mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" /> Maior CPL (Pior)
              </p>
              <p className="text-base font-bold">
                {worst.placement} <span className="text-zinc-500 text-sm">({worst.platform})</span>
              </p>
              <p className="text-2xl font-black text-red-400 mt-1">
                R${worst.cpl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </SpotlightCard>
          )}
        </div>
      )}

      {/* Tabela com overflow-x em mobile */}
      <div className="rounded-xl border border-white/5 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              {["Posicionamento", "Plataforma", "Investimento", "Leads", "CPL", "CTR%", "Δ CPL", "Share"].map(h => (
                <th key={h} className="text-left py-3 px-4 text-[9px] font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {placements.map((p, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-4">
                  <span className="text-xs font-semibold whitespace-nowrap">{p.placement_label}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">{p.platform}</span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1 bg-white/5 rounded-full overflow-hidden shrink-0">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${(p.spend / maxSpend) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono whitespace-nowrap">
                      R${p.spend.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-1 bg-white/5 rounded-full overflow-hidden shrink-0">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(p.leads / maxLeads) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono">{p.leads}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={cn(
                    "text-xs font-mono font-bold whitespace-nowrap",
                    p.cpl && p.cpl > 60 ? "text-red-400" : p.cpl && p.cpl < 30 ? "text-emerald-400" : ""
                  )}>
                    {p.cpl ? `R$${p.cpl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                  </span>
                </td>
                <td className="py-3 px-4 text-xs font-mono whitespace-nowrap">
                  {p.ctr ? `${p.ctr.toFixed(2)}%` : "—"}
                </td>
                <td className="py-3 px-4">
                  <DeltaBadge delta={p.delta_cpl} />
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-accent/60 rounded-full" style={{ width: `${p.share_spend}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-500 whitespace-nowrap">{p.share_spend.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: Alertas ───────────────────────────────────────────────────────────────

function AlertsTab({ accountId }: { accountId: string }) {
  const { data, isLoading, mutate } = useSWR(
    `/api/ad-intelligence/alerts?account_id=${accountId}&status=active&limit=100`,
    fetcher, { revalidateOnFocus: false }
  );

  // Loading state por alerta para evitar race-condition (M3)
  const [actioningId, setActioningId] = useState<string | null>(null);

  const alerts: AdAlert[] = data?.data || [];
  const totals: Record<string, number> = data?.totals || {};

  if (isLoading) return <SkeletonRows count={4} height="h-20" />;

  async function handleAction(id: string, action: "resolve" | "dismiss") {
    setActioningId(id);
    try {
      const res = await fetch("/api/ad-intelligence/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(action === "resolve" ? "Alerta resolvido" : "Alerta descartado");
      mutate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar alerta");
    }
    setActioningId(null);
  }

  return (
    <div className="space-y-4">
      {/* Resumo por severidade */}
      <div className="flex flex-wrap gap-3">
        {(["critical", "high", "medium", "low"] as const).map(s => {
          const c = SEVERITY_CONFIG[s];
          const count = totals[s] || 0;
          if (!count) return null;
          const SevIcon = c.icon;
          return (
            <div key={s} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border text-sm", c.cls)}>
              <SevIcon className="h-4 w-4" />
              <span className="font-black">{count}</span>
              <span className="opacity-70">{c.label}</span>
            </div>
          );
        })}
        {alerts.length === 0 && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle2 className="h-4 w-4" /> Nenhum alerta ativo para esta conta
          </div>
        )}
      </div>

      {/* Lista de alertas */}
      <div className="space-y-2">
        <AnimatePresence>
          {alerts.map(a => {
            const c = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.low;
            const SevIcon = c.icon;
            const borderBg = c.cls.split(" ").filter(v => !v.startsWith("text-")).join(" ");
            const textCls = c.cls.split(" ").find(v => v.startsWith("text-")) || "";
            const isActioning = actioningId === a.id;

            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10, height: 0 }}
                className={cn("flex items-start gap-4 rounded-xl border p-4", borderBg)}
              >
                <SevIcon className={cn("h-5 w-5 shrink-0 mt-0.5", textCls)} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-bold">{a.title}</span>
                    <span className={cn("text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-widest", c.cls)}>
                      {c.label}
                    </span>
                    <span className="text-[10px] text-zinc-500 capitalize">
                      {a.entity_level} · {a.entity_name}
                    </span>
                  </div>
                  {a.reason && (
                    <p className="text-xs text-zinc-400 mb-1.5">{a.reason}</p>
                  )}
                  {a.metric_value !== null && (
                    <div className="flex gap-4 text-[10px] text-zinc-500">
                      <span>Atual: <strong className="text-zinc-300">{a.metric_value?.toFixed(2)}</strong></span>
                      {a.metric_baseline !== null && (
                        <span>Baseline: <strong className="text-zinc-300">{a.metric_baseline?.toFixed(2)}</strong></span>
                      )}
                      {a.delta_pct !== null && (
                        <span>Δ <strong className="text-zinc-300">{a.delta_pct?.toFixed(0)}%</strong></span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAction(a.id, "resolve")}
                    disabled={isActioning}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400 transition-all disabled:opacity-40"
                  >
                    {isActioning
                      ? <RefreshCw className="h-3 w-3 animate-spin" />
                      : <CheckCircle2 className="h-3 w-3" />
                    }
                    Resolver
                  </button>
                  <button
                    onClick={() => handleAction(a.id, "dismiss")}
                    disabled={isActioning}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-500 hover:text-white disabled:opacity-40"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

type Tab = "funnel" | "creatives" | "targeting" | "placements" | "alerts";

interface AccountIntelligenceProps {
  accountId: string | null;
  since: string;
  until: string;
}

export function AccountIntelligence({ accountId, since, until }: AccountIntelligenceProps) {
  const [tab, setTab] = useState<Tab>("funnel");
  const [syncing, setSyncing] = useState(false);

  // Badge de alertas no header
  const { data: alertsData } = useSWR(
    accountId ? `/api/ad-intelligence/alerts?account_id=${accountId}&status=active&limit=10` : null,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60000 }
  );
  const alertCount: number = alertsData?.count || 0;

  const handleSync = useCallback(async () => {
    if (!accountId) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/ad-intelligence/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        `Sync completo — ${data.synced_creatives ?? 0} criativos · ${data.synced_targeting ?? 0} targeting · ${data.alerts_generated ?? 0} alertas`
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro no sync");
    }
    setSyncing(false);
  }, [accountId]);

  if (!accountId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
        <BarChart2 className="h-10 w-10 mb-3 opacity-20" />
        <p className="text-sm">Selecione uma conta Meta no menu superior para analisar.</p>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; icon: LucideIcon; badge?: number }[] = [
    { key: "funnel",     label: "Funil",          icon: BarChart2 },
    { key: "creatives",  label: "Criativos",       icon: Layers },
    { key: "targeting",  label: "Públicos",        icon: Users },
    { key: "placements", label: "Posicionamento",  icon: MapPin },
    { key: "alerts",     label: "Alertas",         icon: AlertTriangle, badge: alertCount },
  ];

  return (
    <div className="space-y-5">
      {/* Tab bar + Sync */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 flex-wrap gap-0.5">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold tracking-widest uppercase rounded-lg transition-all",
                tab === t.key
                  ? "bg-accent text-white shadow-[0_0_15px_rgba(0,153,255,0.2)]"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[9px] rounded-full px-1.5 py-0.5 font-black">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
          {syncing ? "Sincronizando..." : "Sync Dados"}
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "funnel"     && <FunnelTab     accountId={accountId} since={since} until={until} />}
          {tab === "creatives"  && <CreativesTab  accountId={accountId} />}
          {tab === "targeting"  && <TargetingTab  accountId={accountId} />}
          {tab === "placements" && <PlacementsTab accountId={accountId} />}
          {tab === "alerts"     && <AlertsTab     accountId={accountId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
