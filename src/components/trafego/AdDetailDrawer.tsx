"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataHealthBadge } from "@/components/marketing/DataHealthBadge";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  ExternalLink, Image as ImageIcon, Video, Layers, ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, Tooltip as RechartsTooltip } from "recharts";

interface AdDetailData {
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  campaign_id: string | null;
  adset_name: string | null;
  adset_id: string | null;
  status: string;
  thumbnail_url?: string | null;
  creative_type?: string | null;
  // Performance (pre-calculated)
  spend: number;
  leads: number;
  cpl: number;
  ctr: number;
  impressoes: number;
  alcance: number;
  frequencia: number;
  // CRM funnel
  qualificados: number;
  taxaQualif: number;
  reunioesAgendadas: number;
  reunioesFeitas: number;
  showRate: number;
  cprf: number;
  mql: number;
  pctMql: number;
  // Account averages for comparison
  avgSpend: number;
  avgLeads: number;
  avgCpl: number;
  avgCtr: number;
}

interface AdDetailDrawerProps {
  ad: AdDetailData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MetricRow({ label, value, comparison, suffix }: {
  label: string;
  value: string;
  comparison?: string | null;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">{value}{suffix}</span>
        {comparison && (
          <span className={cn(
            "text-[10px]",
            comparison.startsWith("+") ? "text-emerald-400" : comparison.startsWith("-") ? "text-red-400" : "text-muted-foreground"
          )}>
            {comparison} vs media
          </span>
        )}
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">Sem dados suficientes</span>;

  const color = score < 30 ? "bg-red-500" : score < 60 ? "bg-yellow-500" : score < 80 ? "bg-green-500" : "bg-green-700";
  const textColor = score < 30 ? "text-red-400" : score < 60 ? "text-yellow-400" : score < 80 ? "text-green-400" : "text-green-300";

  return (
    <div className="flex items-center gap-3">
      <span className={cn("text-lg font-bold", textColor)}>{score}</span>
      <span className="text-xs text-muted-foreground">/100</span>
      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function comparisonLabel(value: number, avg: number): string | null {
  if (avg <= 0 || value <= 0) return null;
  const pct = ((value - avg) / avg) * 100;
  if (Math.abs(pct) < 1) return null;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

export function AdDetailDrawer({ ad, open, onOpenChange }: AdDetailDrawerProps) {
  const [score, setScore] = useState<number | null>(null);
  const [contratos, setContratos] = useState<{ fechamentos: number; mrr: number; cac: number; roasCash: number; roasReal: number; payback: number } | null>(null);
  const [videoMetrics, setVideoMetrics] = useState<{ hookRate: number; completionRate: number; ret25: number; ret50: number; ret75: number } | null>(null);
  const [cplHistory, setCplHistory] = useState<{ dia: string; cpl: number | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ad || !open) return;
    setLoading(true);
    loadAdDetails(ad.ad_id, ad.spend, ad.leads);
  }, [ad?.ad_id, open]);

  async function loadAdDetails(adId: string, adSpend: number, adLeads: number) {
    try {
      // Parallel fetches: score, contracts, video, history
      const [scoreRes, contratoRes, videoRes, historyRes] = await Promise.all([
        supabase.from("creative_scores").select("composite_score").eq("ad_id", adId).maybeSingle(),
        loadContratoData(adId, adSpend),
        loadVideoMetrics(adId),
        loadCplHistory(adId),
      ]);

      setScore(scoreRes.data?.composite_score ?? null);
      setContratos(contratoRes);
      setVideoMetrics(videoRes);
      setCplHistory(historyRes);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function loadContratoData(adId: string, adSpend: number) {
    // Find leads linked to this ad, then their contracts
    const { data: leads } = await supabase
      .from("leads_crm")
      .select("id, ad_id")
      .eq("ad_id", adId);

    if (!leads || leads.length === 0) return null;

    const leadIds = leads.map(l => l.id);
    const { data: cts } = await supabase
      .from("contratos")
      .select("id, valor_mensal, valor_entrada, status")
      .in("lead_id", leadIds)
      .eq("status", "ativo");

    if (!cts || cts.length === 0) return null;

    const fechamentos = cts.length;
    const mrr = cts.reduce((s, c) => s + Number(c.valor_mensal || 0), 0);
    const entradaTotal = cts.reduce((s, c) => s + Number(c.valor_entrada || 0), 0);
    const cac = fechamentos > 0 ? adSpend / fechamentos : 0;
    const roasCash = adSpend > 0 ? entradaTotal / adSpend : 0;
    const roasReal = adSpend > 0 ? mrr / adSpend : 0;
    const payback = mrr > 0 ? adSpend / mrr : 0;

    return { fechamentos, mrr, cac, roasCash, roasReal, payback };
  }

  async function loadVideoMetrics(adId: string) {
    const { data } = await supabase
      .from("ads_performance")
      .select("impressoes, video_views, video_p25, video_p50, video_p75, video_p100, video_3s_views")
      .eq("ad_id", adId);

    if (!data || data.length === 0) return null;

    const totalImpr = data.reduce((s, r) => s + (r.impressoes || 0), 0);
    const total3s = data.reduce((s, r) => s + (r.video_3s_views || 0), 0);
    const totalViews = data.reduce((s, r) => s + (r.video_views || 0), 0);
    const totalP25 = data.reduce((s, r) => s + (r.video_p25 || 0), 0);
    const totalP50 = data.reduce((s, r) => s + (r.video_p50 || 0), 0);
    const totalP75 = data.reduce((s, r) => s + (r.video_p75 || 0), 0);
    const totalP100 = data.reduce((s, r) => s + (r.video_p100 || 0), 0);

    if (total3s === 0 && totalViews === 0) return null;

    const hookRate = totalImpr > 0 ? (total3s / totalImpr) * 100 : 0;
    const completionRate = totalViews > 0 ? (totalP100 / totalViews) * 100 : 0;
    const ret25 = totalViews > 0 ? (totalP25 / totalViews) * 100 : 0;
    const ret50 = totalViews > 0 ? (totalP50 / totalViews) * 100 : 0;
    const ret75 = totalViews > 0 ? (totalP75 / totalViews) * 100 : 0;

    return { hookRate, completionRate, ret25, ret50, ret75 };
  }

  async function loadCplHistory(adId: string): Promise<{ dia: string; cpl: number | null }[]> {
    const { data } = await supabase
      .from("ads_performance")
      .select("data_ref, spend, leads")
      .eq("ad_id", adId)
      .order("data_ref", { ascending: true });

    if (!data || data.length === 0) return [];

    // Group by date, last 14 days
    const byDate = new Map<string, { spend: number; leads: number }>();
    for (const row of data) {
      const existing = byDate.get(row.data_ref) || { spend: 0, leads: 0 };
      existing.spend += Number(row.spend || 0);
      existing.leads += Number(row.leads || 0);
      byDate.set(row.data_ref, existing);
    }

    return Array.from(byDate, ([dia, { spend, leads }]) => ({
      dia: dia.slice(5), // MM-DD
      cpl: leads > 0 ? spend / leads : null,
    })).slice(-14);
  }

  if (!ad) return null;

  const thumbSrc = ad.thumbnail_url;
  const isVideo = ad.creative_type === "VIDEO" || !!videoMetrics;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[500px] overflow-y-auto p-0">
        <div className="space-y-0">
          {/* HEADER */}
          <div className="relative">
            {thumbSrc ? (
              <div className="w-full h-[200px] bg-muted/30 overflow-hidden">
                <img src={thumbSrc} alt={ad.ad_name || ""} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-[120px] bg-muted/20 flex items-center justify-center">
                {isVideo ? <Video size={32} className="text-muted-foreground/30" /> :
                  <ImageIcon size={32} className="text-muted-foreground/30" />}
              </div>
            )}
            <div className="absolute top-3 right-3">
              <Badge className={cn("text-[10px]", ad.status === "ACTIVE" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground")}>
                {ad.status === "ACTIVE" ? "Ativo" : (ad.status || "").replace(/_/g, " ")}
              </Badge>
            </div>
          </div>

          <div className="px-5 pt-4 pb-2 space-y-2">
            <SheetHeader className="p-0">
              <SheetTitle className="text-base leading-tight">{ad.ad_name || ad.ad_id}</SheetTitle>
              <SheetDescription className="text-[11px]">
                <span className="text-muted-foreground">{ad.campaign_name}</span>
                <span className="mx-1.5 text-muted-foreground/50">&rsaquo;</span>
                <span className="text-muted-foreground">{ad.adset_name}</span>
              </SheetDescription>
            </SheetHeader>
            <ScoreBar score={score} />
          </div>

          {/* SEÇÃO 1 — MÍDIA */}
          <div className="px-5 py-4 border-t border-border/30 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Midia</h3>
              <DataHealthBadge status="verified" fonte="Meta Ads API - ads_performance" />
            </div>
            <MetricRow label="Investimento" value={formatCurrency(ad.spend)} comparison={comparisonLabel(ad.spend, ad.avgSpend)} />
            <MetricRow label="Leads" value={String(ad.leads)} comparison={comparisonLabel(ad.leads, ad.avgLeads)} />
            <MetricRow label="CPL" value={ad.leads > 0 ? formatCurrency(ad.cpl) : "—"} comparison={ad.cpl > 0 ? comparisonLabel(ad.cpl, ad.avgCpl) : null} />
            <MetricRow label="CTR" value={ad.ctr > 0 ? formatPercent(ad.ctr) : "—"} comparison={ad.ctr > 0 ? comparisonLabel(ad.ctr, ad.avgCtr) : null} />
            <MetricRow label="Impressoes" value={ad.impressoes.toLocaleString("pt-BR")} />
            <MetricRow label="Alcance" value={ad.alcance > 0 ? ad.alcance.toLocaleString("pt-BR") : "—"} />
            <MetricRow label="Frequencia" value={ad.frequencia > 0 ? ad.frequencia.toFixed(2) : "—"} />
          </div>

          {/* SEÇÃO 2 — FUNIL */}
          <div className="px-5 py-4 border-t border-border/30 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Funil</h3>
              <DataHealthBadge status="verified" fonte="leads_crm linkados por ad_id" />
            </div>
            {ad.qualificados === 0 && ad.leads === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Sem leads atribuidos via ad_id</p>
            ) : (
              <>
                <MetricRow label="Qualificados" value={ad.qualificados > 0 ? String(ad.qualificados) : "—"} />
                <MetricRow label="Taxa Qualif." value={ad.taxaQualif > 0 ? formatPercent(ad.taxaQualif) : "—"} />
                <MetricRow label="Reun. Agendadas" value={ad.reunioesAgendadas > 0 ? String(ad.reunioesAgendadas) : "—"} />
                <MetricRow label="Reun. Feitas" value={ad.reunioesFeitas > 0 ? String(ad.reunioesFeitas) : "—"} />
                <MetricRow label="Show Rate" value={ad.showRate > 0 ? formatPercent(ad.showRate) : "—"} />
                <MetricRow label="CPRF" value={ad.cprf > 0 ? formatCurrency(ad.cprf) : "—"} />
                <MetricRow label="MQL" value={ad.mql > 0 ? String(ad.mql) : "—"} />
                <MetricRow label="% MQL" value={ad.pctMql > 0 ? formatPercent(ad.pctMql) : "—"} />
              </>
            )}
          </div>

          {/* SEÇÃO 3 — RECEITA */}
          <div className="px-5 py-4 border-t border-border/30 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receita</h3>
              <DataHealthBadge status={contratos ? "verified" : "warning"} fonte="contratos linkados por lead_id" />
            </div>
            {!contratos ? (
              <p className="text-xs text-muted-foreground py-2">Sem contratos vinculados</p>
            ) : (
              <>
                <MetricRow label="Fechamentos" value={String(contratos.fechamentos)} />
                <MetricRow label="MRR" value={formatCurrency(contratos.mrr)} />
                <MetricRow label="CAC" value={formatCurrency(contratos.cac)} />
                {contratos.cac > 0 && contratos.cac < 10 && contratos.fechamentos > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-yellow-400 bg-yellow-500/10 rounded px-2 py-1">
                    <AlertTriangle size={10} /> CAC improvavel — verificar atribuicao
                  </div>
                )}
                <MetricRow label="ROAS Cash" value={contratos.roasCash > 0 ? `${contratos.roasCash.toFixed(2)}x` : "—"} />
                {contratos.roasCash > 50 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-yellow-400 bg-yellow-500/10 rounded px-2 py-1">
                    <AlertTriangle size={10} /> Verificar: possivel uso de valor total em vez de MRR mensal
                  </div>
                )}
                <MetricRow label="ROAS Real" value={contratos.roasReal > 0 ? `${contratos.roasReal.toFixed(2)}x` : "—"} />
                <MetricRow label="Payback" value={contratos.payback > 0 ? `${contratos.payback.toFixed(1)} meses` : "—"} />
              </>
            )}
          </div>

          {/* SEÇÃO 4 — VÍDEO (condicional) */}
          {videoMetrics && (
            <div className="px-5 py-4 border-t border-border/30 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Video</h3>
              <MetricRow label="Hook Rate" value={formatPercent(videoMetrics.hookRate)} />
              <MetricRow label="Completion Rate" value={formatPercent(videoMetrics.completionRate)} />
              <MetricRow label="Ret. 25%" value={formatPercent(videoMetrics.ret25)} />
              <MetricRow label="Ret. 50%" value={formatPercent(videoMetrics.ret50)} />
              <MetricRow label="Ret. 75%" value={formatPercent(videoMetrics.ret75)} />
              <div className="text-[10px] text-muted-foreground">
                Hook Rate = video_3s_views / impressions x 100
              </div>
            </div>
          )}

          {/* SEÇÃO 5 — HISTÓRICO CPL */}
          <div className="px-5 py-4 border-t border-border/30 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historico CPL (14 dias)</h3>
            {cplHistory.length < 3 ? (
              <p className="text-xs text-muted-foreground py-2">Historico insuficiente</p>
            ) : (
              <div className="h-[60px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cplHistory}>
                    <RechartsTooltip
                      formatter={(v) => v != null ? formatCurrency(Number(v)) : "—"}
                      contentStyle={{ fontSize: 11, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                      labelStyle={{ fontSize: 10 }}
                    />
                    <Line type="monotone" dataKey="cpl" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="px-5 py-4 border-t border-border/30 space-y-2">
            <div className="flex flex-col gap-2">
              <a
                href={`https://adsmanager.facebook.com/adsmanager/manage/ads?act=${ad.ad_id}&selected_ad_ids=${ad.ad_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink size={12} /> Abrir no Meta Ads Manager
              </a>
              <a
                href={`/marketing/criativos?ad_id=${ad.ad_id}`}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <ArrowRight size={12} /> Ver analise de criativo
              </a>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type { AdDetailData };

