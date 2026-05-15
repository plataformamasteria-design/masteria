"use client";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPercent } from "@/lib/format";
import { useDateFilter } from "@/contexts/DateFilterContext";
import type { CreativeWithMetrics, CreativeScore } from "@/lib/types/metaVideo";

const SCORE_COLORS: Record<CreativeScore["color"], string> = {
  green: "bg-green-500/20 text-green-400",
  blue: "bg-blue-500/20 text-blue-400",
  yellow: "bg-yellow-500/20 text-yellow-400",
  red: "bg-red-500/20 text-red-400",
};

export function CreativeLibrary() {
  const { queryString } = useDateFilter();
  const [ads, setAds] = useState<CreativeWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterScore, setFilterScore] = useState("all");
  const [sortBy, setSortBy] = useState("score");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meta-video?${queryString}`).then((r) => r.json()).then((d) => {
      setAds(d.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [queryString]);

  const filtered = useMemo(() => {
    let result = ads;
    if (filterScore !== "all") result = result.filter((a) => a.score.label === filterScore);
    result = [...result].sort((a, b) => {
      if (sortBy === "score") return b.score.score - a.score.score;
      if (sortBy === "hookRate") return b.metrics.hookRate - a.metrics.hookRate;
      return b.spend - a.spend;
    });
    return result;
  }, [ads, filterScore, sortBy]);

  if (loading) return <Card><CardContent className="py-8"><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />)}</div></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Biblioteca de Criativos ({ads.length})</CardTitle>
          <div className="flex gap-2">
            <select value={filterScore} onChange={(e) => setFilterScore(e.target.value)} className="text-xs bg-transparent border rounded-lg px-2 py-1">
              <option value="all">Todos os scores</option>
              <option value="Excelente">Excelente</option>
              <option value="Bom">Bom</option>
              <option value="Atenção">Atenção</option>
              <option value="Crítico">Crítico</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-xs bg-transparent border rounded-lg px-2 py-1">
              <option value="score">Score</option>
              <option value="hookRate">Hook Rate</option>
              <option value="spend">Investido</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum criativo encontrado</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((ad) => (
              <div key={ad.id} className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-medium truncate max-w-[180px]" title={ad.name}>{ad.name}</p>
                  <Badge className={`text-[9px] shrink-0 ${SCORE_COLORS[ad.score.color]}`}>{ad.score.score} {ad.score.label}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{ad.campaignName}</p>
                <div className="flex items-center gap-3">
                  <div>
                    <p className={`text-lg font-bold ${ad.metrics.hookRate >= 40 ? "text-emerald-400" : ad.metrics.hookRate >= 25 ? "text-green-400" : ad.metrics.hookRate >= 15 ? "text-yellow-400" : "text-red-400"}`}>
                      {formatPercent(ad.metrics.hookRate)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Hook Rate</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{formatPercent(ad.metrics.completionRate)}</p>
                    <p className="text-[9px] text-muted-foreground">Completion</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{ad.metrics.totalPlays.toLocaleString("pt-BR")}</p>
                    <p className="text-[9px] text-muted-foreground">Plays</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
