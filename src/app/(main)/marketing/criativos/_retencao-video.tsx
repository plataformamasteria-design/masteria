"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Area, AreaChart } from "recharts";
import { Loader2, AlertTriangle, TrendingUp, Eye, Filter, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Creative {
  ad_id: string;
  ad_name: string;
  format: string;
  spend: number;
  cpl: number | null;
  taxa_qualificacao: number;
  leads_qualificados: number;
  cpql: number | null;
  video_retention_25: number | null;
  video_retention_50: number | null;
  video_retention_75: number | null;
  video_retention_100: number | null;
}

type SortKey = "ret50" | "taxa_qualificacao" | "cpql" | "spend";

function calculateRetentionScore(c: Creative): number {
  const r25 = c.video_retention_25 ?? 0;
  const r50 = c.video_retention_50 ?? 0;
  const r75 = c.video_retention_75 ?? 0;
  const r100 = c.video_retention_100 ?? 0;
  const raw = r25 * 0.4 + r50 * 0.3 + r75 * 0.2 + r100 * 0.1;
  return Math.min(raw, 100);
}

function getRetentionInsight(c: Creative): { text: string; type: "success" | "warning" | "info" | "muted" } {
  const r25 = c.video_retention_25 ?? 0;
  const r50 = c.video_retention_50 ?? 0;
  const r75 = c.video_retention_75 ?? 0;
  const r100 = c.video_retention_100 ?? 0;

  if (r25 === 0 && r50 === 0) return { text: "Sem dados", type: "muted" };
  if (r25 < 3) return { text: "Hook fraco", type: "warning" };
  if (r25 >= 3 && r50 < 1.5) return { text: "Perde no meio", type: "warning" };
  if (r75 >= 2 && r100 < 1) return { text: "CTA fraco", type: "info" };
  if (r25 >= 3 && r50 >= 1.5 && r75 >= 1) return { text: "Saudavel", type: "success" };
  return { text: "Sem dados", type: "muted" };
}

function retCellColor(value: number | null, thresholds: { bad: number; mid: number }): string {
  if (value == null || value === 0) return "text-muted-foreground";
  if (value < thresholds.bad) return "text-red-400";
  if (value < thresholds.mid) return "text-yellow-400";
  return "text-green-400";
}

export default function RetencaoVideoTab() {
  const [data, setData] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [onlyWithData, setOnlyWithData] = useState(true);
  const [minRet50, setMinRet50] = useState(0);
  const [minQual, setMinQual] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("ret50");
  const [showNoData, setShowNoData] = useState(false);

  useEffect(() => {
    fetch("/api/marketing/criativos-enriched")
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        else setData(res.data || []);
      })
      .catch(() => setError("Erro ao carregar"))
      .finally(() => setLoading(false));
  }, []);

  // All video creatives
  const allVideos = useMemo(() => data.filter(c => c.format === "video"), [data]);

  // Videos with retention data
  const videosWithData = useMemo(() =>
    allVideos.filter(c =>
      c.video_retention_25 != null && (c.video_retention_25 > 0 || c.video_retention_50! > 0)
    ), [allVideos]);

  // Videos without data
  const videosWithoutData = useMemo(() =>
    allVideos.filter(c =>
      c.video_retention_25 == null || (c.video_retention_25 === 0 && c.video_retention_50 === 0)
    ), [allVideos]);

  // Filtered videos
  const filtered = useMemo(() => {
    let result = onlyWithData ? videosWithData : allVideos;
    if (minRet50 > 0) result = result.filter(c => (c.video_retention_50 ?? 0) >= minRet50);
    if (minQual > 0) result = result.filter(c => c.taxa_qualificacao >= minQual);

    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case "ret50": return (b.video_retention_50 ?? 0) - (a.video_retention_50 ?? 0);
        case "taxa_qualificacao": return b.taxa_qualificacao - a.taxa_qualificacao;
        case "cpql": return (a.cpql ?? Infinity) - (b.cpql ?? Infinity);
        case "spend": return b.spend - a.spend;
      }
    });
    return result;
  }, [allVideos, videosWithData, onlyWithData, minRet50, minQual, sortKey]);

  // Top 5 by retention
  const top5 = useMemo(() => [...videosWithData]
    .sort((a, b) => (b.video_retention_50 ?? 0) - (a.video_retention_50 ?? 0))
    .slice(0, 5), [videosWithData]);

  // Top 5 by qualification
  const top5Qual = useMemo(() => [...videosWithData]
    .filter(c => c.taxa_qualificacao > 0)
    .sort((a, b) => b.taxa_qualificacao - a.taxa_qualificacao)
    .slice(0, 5), [videosWithData]);

  // Zero qual creatives
  const zeroQual = useMemo(() => videosWithData.filter(c => c.taxa_qualificacao === 0), [videosWithData]);

  // Average retention curve data
  const avgCurveData = useMemo(() => {
    const calcAvg = (items: Creative[], key: keyof Creative) => {
      const vals = items.map(c => (c[key] as number) ?? 0).filter(v => v > 0);
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    };

    const allActive = videosWithData;
    return [
      { quartil: "0%", media: 100, top5: 100, zeroQual: 100 },
      { quartil: "25%", media: calcAvg(allActive, "video_retention_25"), top5: calcAvg(top5Qual, "video_retention_25"), zeroQual: calcAvg(zeroQual, "video_retention_25") },
      { quartil: "50%", media: calcAvg(allActive, "video_retention_50"), top5: calcAvg(top5Qual, "video_retention_50"), zeroQual: calcAvg(zeroQual, "video_retention_50") },
      { quartil: "75%", media: calcAvg(allActive, "video_retention_75"), top5: calcAvg(top5Qual, "video_retention_75"), zeroQual: calcAvg(zeroQual, "video_retention_75") },
      { quartil: "100%", media: calcAvg(allActive, "video_retention_100"), top5: calcAvg(top5Qual, "video_retention_100"), zeroQual: calcAvg(zeroQual, "video_retention_100") },
    ];
  }, [videosWithData, top5Qual, zeroQual]);

  // Selected creative for detail view
  const selected = useMemo(() => {
    if (selectedId) return filtered.find(v => v.ad_id === selectedId) || null;
    return null;
  }, [filtered, selectedId]);

  // Individual curve for selected
  const selectedCurveData = useMemo(() => {
    if (!selected) return null;
    const calcAvg = (items: Creative[], key: keyof Creative) => {
      const vals = items.map(c => (c[key] as number) ?? 0).filter(v => v > 0);
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    };
    return [
      { quartil: "0%", criativo: 100, media: 100 },
      { quartil: "25%", criativo: selected.video_retention_25 ?? 0, media: calcAvg(videosWithData, "video_retention_25") },
      { quartil: "50%", criativo: selected.video_retention_50 ?? 0, media: calcAvg(videosWithData, "video_retention_50") },
      { quartil: "75%", criativo: selected.video_retention_75 ?? 0, media: calcAvg(videosWithData, "video_retention_75") },
      { quartil: "100%", criativo: selected.video_retention_100 ?? 0, media: calcAvg(videosWithData, "video_retention_100") },
    ];
  }, [selected, videosWithData]);

  // Insights automáticos
  const avgRet50 = videosWithData.length > 0 ? videosWithData.reduce((s, c) => s + (c.video_retention_50 ?? 0), 0) / videosWithData.length : 0;
  const highRetHighQual = videosWithData.filter(c => (c.video_retention_50 ?? 0) > 3 && c.taxa_qualificacao > 0);
  const lowRetHighQual = videosWithData.filter(c => (c.video_retention_50 ?? 0) <= 3 && c.taxa_qualificacao > 0);
  const qualMultiplier = highRetHighQual.length > 0 && lowRetHighQual.length > 0
    ? (highRetHighQual.reduce((s, c) => s + c.taxa_qualificacao, 0) / highRetHighQual.length) /
      (lowRetHighQual.reduce((s, c) => s + c.taxa_qualificacao, 0) / lowRetHighQual.length)
    : 0;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;
  if (error) return <Card><CardContent className="py-12 text-center text-red-400 text-sm">{error}</CardContent></Card>;
  if (allVideos.length === 0) return <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Nenhum criativo de video encontrado.</CardContent></Card>;

  return (
    <div className="space-y-4">
      {/* BLOCO A — Filters */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={12} className="text-muted-foreground" />
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={onlyWithData} onChange={e => setOnlyWithData(e.target.checked)} className="rounded" />
                Apenas com dados de retencao
              </label>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Ret.50% min:</span>
              <input type="number" value={minRet50} onChange={e => setMinRet50(Number(e.target.value))} className="w-14 text-xs bg-transparent border rounded px-2 py-1" step={0.5} min={0} />
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Taxa Qual. min:</span>
              <input type="number" value={minQual} onChange={e => setMinQual(Number(e.target.value))} className="w-14 text-xs bg-transparent border rounded px-2 py-1" step={5} min={0} />
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowUpDown size={10} className="text-muted-foreground" />
              <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="text-xs bg-transparent border rounded px-2 py-1">
                <option value="ret50">Ret. 50%</option>
                <option value="taxa_qualificacao">Taxa Qual.</option>
                <option value="cpql">CPQL</option>
                <option value="spend">Investimento</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO B — Top 5 by Retention */}
      {top5.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">Top 5 Criativos por Retencao</p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {top5.map((c, i) => (
              <Card key={c.ad_id} className={cn("cursor-pointer hover:border-primary/40 transition-colors", selectedId === c.ad_id && "border-primary bg-primary/5")} onClick={() => setSelectedId(c.ad_id)}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-medium truncate max-w-[120px]" title={c.ad_name}>{c.ad_name}</p>
                    <span className="text-[10px] font-bold text-primary">#{i + 1}</span>
                  </div>
                  {/* Mini retention bars */}
                  <div className="space-y-1">
                    {[
                      { label: "25%", value: c.video_retention_25 },
                      { label: "50%", value: c.video_retention_50 },
                      { label: "75%", value: c.video_retention_75 },
                      { label: "100%", value: c.video_retention_100 },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        <span className="text-[8px] text-muted-foreground w-6">{item.label}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min((item.value ?? 0) * 5, 100)}%` }} />
                        </div>
                        <span className="text-[9px] font-mono w-8 text-right">{item.value != null ? `${item.value.toFixed(1)}%` : "–"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground pt-1 border-t">
                    <span>Qual: {formatPercent(c.taxa_qualificacao)}</span>
                    <span>{c.cpql != null ? formatCurrency(c.cpql) : "–"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* BLOCO E — Selected creative detail */}
      {selected && selectedCurveData && (
        <Card className="border-primary/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">{selected.ad_name}</p>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedId(null)}>Fechar</Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <MiniKpi label="Ret. 50%" value={selected.video_retention_50 != null ? formatPercent(selected.video_retention_50) : "–"} />
              <MiniKpi label="Taxa Qual." value={formatPercent(selected.taxa_qualificacao)} />
              <MiniKpi label="CPQL" value={selected.cpql != null ? formatCurrency(selected.cpql) : "–"} />
              <MiniKpi label="Investimento" value={formatCurrency(selected.spend)} />
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">Curva individual vs media geral</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={selectedCurveData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="quartil" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <YAxis tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={{ fill: "#9ca3af", fontSize: 9 }} />
                <Line type="monotone" dataKey="criativo" name="Este criativo" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="media" name="Media geral" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className={cn("mt-3 p-2 rounded border text-[11px]",
              getRetentionInsight(selected).type === "success" ? "bg-green-500/10 border-green-500/30 text-green-400" :
              getRetentionInsight(selected).type === "warning" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" :
              "bg-blue-500/10 border-blue-500/30 text-blue-400"
            )}>
              Insight: {getRetentionInsight(selected).text}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BLOCO C — Average retention curve */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <p className="text-sm font-semibold mb-1">Curva de Retencao Media</p>
          <p className="text-[10px] text-muted-foreground mb-4">
            Comparacao entre media geral, top 5 por qualificacao e criativos sem qualificacao
          </p>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={avgCurveData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="quartil" tick={{ fill: "#9ca3af", fontSize: 11 }} label={{ value: "Progresso do video", position: "bottom", offset: 5, style: { fill: "#9ca3af", fontSize: 11 } }} />
              <YAxis tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="media" name="Media todos ativos" stroke="#6b7280" strokeWidth={2} dot={{ r: 4, fill: "#6b7280" }} />
              <Line type="monotone" dataKey="top5" name="Top 5 por qualificacao" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: "#22c55e" }} />
              {zeroQual.length > 0 && (
                <Line type="monotone" dataKey="zeroQual" name="Qual. = 0%" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 3, fill: "#ef4444" }} />
              )}
            </LineChart>
          </ResponsiveContainer>

          {/* Insights automáticos */}
          <div className="mt-4 space-y-2">
            <div className="p-2 rounded border bg-blue-500/5 border-blue-500/20 text-[11px] text-blue-400 flex items-start gap-2">
              <Eye size={12} className="shrink-0 mt-0.5" />
              <span>A maior queda acontece entre 0% e 25% — revisar os primeiros 3 segundos dos videos.</span>
            </div>
            {qualMultiplier > 1.3 && (
              <div className="p-2 rounded border bg-green-500/5 border-green-500/20 text-[11px] text-green-400 flex items-start gap-2">
                <TrendingUp size={12} className="shrink-0 mt-0.5" />
                <span>Criativos com Ret.50% {"> "}3% tem taxa de qualificacao {qualMultiplier.toFixed(1)}x maior.</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* BLOCO D — Comparison Table */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Tabela Comparativa ({filtered.length} criativos)</p>
            {videosWithoutData.length > 0 && (
              <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={showNoData} onChange={e => setShowNoData(e.target.checked)} className="rounded" />
                Exibir sem dados ({videosWithoutData.length} ocultos)
              </label>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 px-2">Criativo</th>
                  <th className="text-right py-2 px-2">Ret 25%</th>
                  <th className="text-right py-2 px-2">Ret 50%</th>
                  <th className="text-right py-2 px-2">Ret 75%</th>
                  <th className="text-right py-2 px-2">Ret 100%</th>
                  <th className="text-right py-2 px-2">Qual.%</th>
                  <th className="text-right py-2 px-2">CPQL</th>
                  <th className="text-right py-2 px-2">Score</th>
                  <th className="text-left py-2 px-2">Insight</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => {
                  const insight = getRetentionInsight(v);
                  const score = calculateRetentionScore(v);
                  return (
                    <tr
                      key={v.ad_id}
                      className={cn("border-b border-border/30 hover:bg-muted/30 cursor-pointer", selectedId === v.ad_id && "bg-primary/5")}
                      onClick={() => setSelectedId(v.ad_id)}
                    >
                      <td className="py-2 px-2 max-w-[160px] truncate font-medium">{v.ad_name}</td>
                      <td className={cn("text-right py-2 px-2 font-mono", retCellColor(v.video_retention_25, { bad: 3, mid: 6 }))}>
                        {v.video_retention_25 != null && v.video_retention_25 > 0 ? formatPercent(v.video_retention_25) : "–"}
                      </td>
                      <td className={cn("text-right py-2 px-2 font-mono", retCellColor(v.video_retention_50, { bad: 1.5, mid: 3 }))}>
                        {v.video_retention_50 != null && v.video_retention_50 > 0 ? formatPercent(v.video_retention_50) : "–"}
                      </td>
                      <td className={cn("text-right py-2 px-2 font-mono", retCellColor(v.video_retention_75, { bad: 1, mid: 2 }))}>
                        {v.video_retention_75 != null && v.video_retention_75 > 0 ? formatPercent(v.video_retention_75) : "–"}
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-muted-foreground">
                        {v.video_retention_100 != null && v.video_retention_100 > 0 ? formatPercent(v.video_retention_100) : "–"}
                      </td>
                      <td className="text-right py-2 px-2 font-mono">{formatPercent(v.taxa_qualificacao)}</td>
                      <td className="text-right py-2 px-2 font-mono">{v.cpql != null ? formatCurrency(v.cpql) : "–"}</td>
                      <td className="text-right py-2 px-2 font-mono font-semibold group relative cursor-help">
                        {score.toFixed(0)}
                        <div className="invisible group-hover:visible absolute right-0 top-full mt-1 z-50 w-48 p-2 text-[9px] text-muted-foreground bg-popover border rounded-lg shadow-lg text-left font-normal">
                          <p className="font-semibold text-foreground mb-1">Como é calculado:</p>
                          <p>Ret 25% × 0.4 = {((v.video_retention_25 ?? 0) * 0.4).toFixed(1)}</p>
                          <p>Ret 50% × 0.3 = {((v.video_retention_50 ?? 0) * 0.3).toFixed(1)}</p>
                          <p>Ret 75% × 0.2 = {((v.video_retention_75 ?? 0) * 0.2).toFixed(1)}</p>
                          <p>Ret 100% × 0.1 = {((v.video_retention_100 ?? 0) * 0.1).toFixed(1)}</p>
                          <p className="border-t border-border/30 pt-1 mt-1 font-semibold text-foreground">Total = {score.toFixed(1)}</p>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge className={cn("text-[8px]",
                          insight.type === "success" && "bg-green-500/15 text-green-400",
                          insight.type === "warning" && "bg-yellow-500/15 text-yellow-400",
                          insight.type === "info" && "bg-blue-500/15 text-blue-400",
                          insight.type === "muted" && "bg-muted text-muted-foreground",
                        )}>
                          {insight.text}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {showNoData && videosWithoutData.map(v => (
                  <tr key={v.ad_id} className="border-b border-border/30 opacity-50">
                    <td className="py-2 px-2 max-w-[160px] truncate">{v.ad_name}</td>
                    <td colSpan={7} className="text-center py-2 px-2 text-muted-foreground text-[10px]">Sem dados de video</td>
                    <td className="py-2 px-2">
                      <Badge className="text-[8px] bg-muted text-muted-foreground">Sem dados</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-2.5">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

