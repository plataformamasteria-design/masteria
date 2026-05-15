"use client";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import type { DailyMetric, FatigueStatus } from "@/lib/types/metaVideo";

type FatigueLabel = "saudavel" | "em_queda" | "atencao" | "pausar";

const STATUS_COLORS: Record<FatigueLabel, string> = {
  "saudavel": "bg-green-500/20 text-green-400",
  "em_queda": "bg-yellow-500/20 text-yellow-400",
  "atencao": "bg-accent/20 text-accent",
  "pausar": "bg-red-500/20 text-red-400",
};

/**
 * Detecção de fadiga com thresholds configuráveis:
 * - Saudável: variação < 10%
 * - Em queda: variação entre 10% e 20%
 * - Atenção: variação entre 20% e 30%
 * - Pausar: variação > 30%
 */
function detectFatigueFromPeak(metrics: DailyMetric[]): { status: FatigueLabel; dropPct: number } {
  if (metrics.length < 4) return { status: "saudavel", dropPct: 0 };

  const values = metrics.map(m => m.hookRate);
  const peak = Math.max(...values);
  if (peak === 0) return { status: "saudavel", dropPct: 0 };

  // Compare last 7 days average vs peak
  const recent = values.slice(-7);
  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
  const dropPct = ((peak - recentAvg) / peak) * 100;

  if (dropPct > 30) return { status: "pausar", dropPct };
  if (dropPct > 20) return { status: "atencao", dropPct };
  if (dropPct > 10) return { status: "em_queda", dropPct };
  return { status: "saudavel", dropPct };
}

export function CreativeFatigue() {
  const { queryString } = useDateFilter();
  const [data, setData] = useState<Record<string, DailyMetric[]>>({});
  const [loading, setLoading] = useState(true);
  const [onlyFatigued, setOnlyFatigued] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meta-video/daily?${queryString}`).then((r) => r.json()).then((d) => {
      setData(d.data || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [queryString]);

  if (loading) return <Card><CardContent className="py-8"><div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded" />)}</div></CardContent></Card>;

  const entries = Object.entries(data).map(([adId, metrics]) => {
    const { status, dropPct } = detectFatigueFromPeak(metrics);
    return {
      adId,
      adName: metrics[0]?.adName || adId,
      metrics,
      fatigue: status,
      dropPct,
      avgHookRate: metrics.length > 0 ? metrics.reduce((s, m) => s + m.hookRate, 0) / metrics.length : 0,
    };
  });

  const filtered = onlyFatigued ? entries.filter((e) => e.fatigue !== "saudavel") : entries;
  const fatigueCount = entries.filter((e) => e.fatigue !== "saudavel").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Analise de Fadiga ({fatigueCount} com atencao)</CardTitle>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={onlyFatigued} onChange={(e) => setOnlyFatigued(e.target.checked)} className="rounded" />
            Apenas em fadiga
          </label>
        </div>
        <div className="flex gap-4 mt-2 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> {"< 10%: Saudavel"}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> 10-20%: Em queda</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" /> 20-30%: Atencao</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {"> 30%: Pausar"}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{onlyFatigued ? "Nenhum criativo em fadiga" : "Sem dados de video"}</p>}
        {filtered.slice(0, 8).map((entry) => {
          const chartData = entry.metrics.map((m) => ({ dia: m.date.slice(5), hookRate: Math.round(m.hookRate * 10) / 10 }));
          const lineColor = entry.fatigue === "saudavel" ? "#22c55e" : entry.fatigue === "em_queda" ? "#f59e0b" : entry.fatigue === "atencao" ? "#f97316" : "#ef4444";
          return (
            <div key={entry.adId} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium truncate max-w-[250px]" title={entry.adName}>{entry.adName}</p>
                <div className="flex items-center gap-2">
                  {entry.dropPct > 0 && <span className="text-[9px] text-muted-foreground">-{entry.dropPct.toFixed(0)}% do pico</span>}
                  <Badge className={`text-[10px] ${STATUS_COLORS[entry.fatigue]}`}>{entry.fatigue.replace("_", " ")}</Badge>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={chartData}>
                  <XAxis dataKey="dia" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 8 }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 10 }} />
                  <ReferenceLine y={entry.avgHookRate} stroke="#6b7280" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="hookRate" stroke={lineColor} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
