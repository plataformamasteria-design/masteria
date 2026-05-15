"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from "recharts";

interface FunnelData { avgP25: number; avgP50: number; avgP75: number; avgP100: number; avgCostPerResult: number; adCount: number }

export function FunnelRetentionMap() {
  const { queryString } = useDateFilter();
  const [data, setData] = useState<Record<string, FunnelData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meta-funnel?${queryString}`).then((r) => r.json()).then((d) => {
      setData(d.data || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [queryString]);

  if (loading) return <Card><CardContent className="h-[300px] flex items-center justify-center"><div className="h-48 w-full bg-muted animate-pulse rounded" /></CardContent></Card>;

  const chartData = ["P25", "P50", "P75", "P100"].map((label) => ({
    etapa: label,
    Topo: data["Topo"]?.[`avg${label}` as keyof FunnelData] as number || 0,
    Meio: data["Meio"]?.[`avg${label}` as keyof FunnelData] as number || 0,
    Fundo: data["Fundo"]?.[`avg${label}` as keyof FunnelData] as number || 0,
  }));

  const hasData = Object.values(data).some((d) => d.adCount > 0);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Retenção por Etapa do Funil</CardTitle></CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados de funil no período</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <XAxis dataKey="etapa" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v.toFixed(0) + "%"} />
                <Tooltip formatter={(v) => formatPercent(Number(v))} />
                <ReferenceLine y={3} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "Benchmark 3%", fill: "#94a3b8", fontSize: 10, position: "right" }} />
                <Legend />
                <Bar dataKey="Topo" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Meio" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Fundo" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {(["Topo", "Meio", "Fundo"] as const).map((stage) => {
                const d = data[stage];
                if (!d || d.adCount === 0) return null;
                return (
                  <div key={stage} className="p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">{stage}</p>
                    <p className="text-sm font-bold">{d.adCount} anúncios</p>
                    <p className="text-[10px] text-muted-foreground">Custo/resultado: {formatCurrency(d.avgCostPerResult)}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
