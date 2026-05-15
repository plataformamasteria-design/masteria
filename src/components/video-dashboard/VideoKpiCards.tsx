"use client";
import { useEffect, useState } from "react";
import { KpiCard } from "@/components/kpi-card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { validateVideoMetrics, safeDivide } from "@/lib/video-metrics";
import { AlertTriangle } from "lucide-react";
import type { CreativeWithMetrics } from "@/lib/types/metaVideo";

function fmtTime(s: number): string {
  if (s >= 60) return `${Math.floor(s / 60)}min ${Math.round(s % 60)}s`;
  return `${s.toFixed(1)}s`;
}

export function VideoKpiCards() {
  const { queryString } = useDateFilter();
  const [ads, setAds] = useState<CreativeWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meta-video?${queryString}`).then((r) => r.json()).then((d) => {
      setAds(d.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [queryString]);

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>;

  const totalPlays = ads.reduce((s, a) => s + a.metrics.totalPlays, 0);
  const totalThru = ads.reduce((s, a) => s + a.metrics.totalThruPlays, 0);
  const totalImp = ads.reduce((s, a) => s + a.impressions, 0);
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);

  // Hook Rate CORRETO: p25 (proxy 3s views) / impressions
  const totalP25 = ads.reduce((s, a) => s + (a.metrics.p25Rate / 100 * a.impressions), 0);
  const avgHook = totalImp > 0 ? (totalP25 / totalImp) * 100 : 0;

  // Completion Rate: thruplays / impressions
  const avgCompletion = totalImp > 0 ? (totalThru / totalImp) * 100 : 0;

  const avgCostThru = totalThru > 0 ? totalSpend / totalThru : 0;
  const avgTime = ads.length > 0 ? ads.reduce((s, a) => s + a.metrics.avgTimeWatched, 0) / ads.length : 0;

  // Validação: bloquear se hook > 80%
  const hookInvalid = avgHook > 80;

  // Benchmarks corretos para Hook Rate: <15% ruim, 15-25% médio, 25-40% bom, >40% excelente
  const hookClass =
    hookInvalid ? "border-l-2 border-l-orange-500" :
    avgHook >= 40 ? "border-l-2 border-l-emerald-500" :
    avgHook >= 25 ? "border-l-2 border-l-green-500" :
    avgHook >= 15 ? "border-l-2 border-l-yellow-500" :
    "border-l-2 border-l-red-500";
  // Completion Rate benchmark: meta > 3%
  const completionClass =
    avgCompletion >= 3 ? "border-l-2 border-l-green-500" :
    avgCompletion >= 1.5 ? "border-l-2 border-l-yellow-500" :
    "border-l-2 border-l-red-500";
  // Custo/ThruPlay benchmark: meta < R$3
  const costThruClass =
    avgCostThru <= 1.5 ? "border-l-2 border-l-green-500" :
    avgCostThru <= 3.0 ? "border-l-2 border-l-yellow-500" :
    "border-l-2 border-l-red-500";

  const kpis = [
    { title: "Hook Rate", value: hookInvalid ? "Erro" : formatPercent(avgHook), className: hookClass, info: "Percentual de 3s views sobre impressoes. Formula: (video_p25_watched / impressoes) x 100. Meta: > 25%. Benchmarks: <15% Ruim | 15-25% Medio | 25-40% Bom | >40% Excelente.", badge: avgHook < 5 && !hookInvalid ? "Hook Rate critico" : hookInvalid ? "Calculo incorreto" : null },
    { title: "Completion Rate", value: formatPercent(avgCompletion), className: completionClass, info: "Percentual de thruplays sobre impressoes. Formula: (thruplays / impressoes) x 100. Meta: > 3%.", badge: null },
    { title: "Custo/ThruPlay", value: formatCurrency(avgCostThru), className: costThruClass, info: "Quanto custa cada visualizacao completa (ou 15s). Formula: investido / thru-plays. Meta: < R$3,00.", badge: null },
    { title: "Tempo Medio", value: fmtTime(avgTime), className: "", info: "Tempo medio que as pessoas assistem o video antes de pular. Quanto maior, mais engajado esta o publico.", badge: null },
    { title: "Total Plays", value: totalPlays.toLocaleString("pt-BR"), className: "", info: "Total de vezes que o video comecou a ser reproduzido no periodo selecionado.", badge: null },
    { title: "ThruPlays", value: totalThru.toLocaleString("pt-BR"), className: "", info: "Total de visualizacoes completas (ou de pelo menos 15 segundos). E o que o Meta cobra no modelo ThruPlay.", badge: null },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.title} className={`relative ${kpi.className}`}>
          <KpiCard title={kpi.title} value={kpi.value} className={kpi.className} />
          {kpi.badge && (
            <div className="absolute top-1 left-2 flex items-center gap-1 text-[9px] font-medium text-orange-400">
              <AlertTriangle size={10} /> {kpi.badge}
            </div>
          )}
          <div className="absolute top-2 right-2 group cursor-help">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="invisible group-hover:visible absolute right-0 top-full mt-1 z-50 w-64 p-2.5 text-[11px] text-muted-foreground bg-card border rounded-lg shadow-lg leading-relaxed">
              {kpi.info}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
