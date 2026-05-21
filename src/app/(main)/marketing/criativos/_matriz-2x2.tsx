"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatPercent } from "@/lib/format";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { Loader2, TrendingUp, Pause, Search, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface Creative {
  ad_id: string;
  ad_name: string;
  format: string;
  spend: number;
  cpl: number | null;
  taxa_qualificacao: number;
  ltv_medio: number | null;
  leads_qualificados: number;
  leads_totais: number;
  cpql: number | null;
  reunioes_geradas: number;
}

interface ScatterPoint {
  x: number; // CPL
  y: number; // Taxa Qualificacao
  z: number; // Spend (for bubble size)
  ltv: number;
  name: string;
  ad_id: string;
  quadrant: "escalar" | "otimizar" | "investigar" | "pausar";
  creative: Creative;
}

const QUADRANT_CONFIG = {
  escalar: { label: "ESCALAR", icon: <TrendingUp size={12} />, color: "text-green-400", bg: "bg-green-500/10 border-green-500/30", desc: "Baixo CPL + alta qualificacao" },
  otimizar: { label: "OTIMIZAR", icon: <Wrench size={12} />, color: "text-accent", bg: "bg-accent/10 border-accent/30", desc: "CPL alto mas qualificacao boa" },
  investigar: { label: "INVESTIGAR", icon: <Search size={12} />, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", desc: "CPL baixo mas qualificacao ruim" },
  pausar: { label: "PAUSAR", icon: <Pause size={12} />, color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", desc: "CPL alto e qualificacao ruim" },
};

function ltvToColor(ltv: number, maxLtv: number): string {
  if (maxLtv === 0) return "#6b7280";
  const ratio = Math.min(ltv / maxLtv, 1);
  // Red to green gradient
  const r = Math.round(239 * (1 - ratio) + 34 * ratio);
  const g = Math.round(68 * (1 - ratio) + 197 * ratio);
  const b = Math.round(68 * (1 - ratio) + 94 * ratio);
  return `rgb(${r},${g},${b})`;
}

export default function Matriz2x2Tab() {
  const [data, setData] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ScatterPoint | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ point: ScatterPoint; action: "escalar" | "pausar" } | null>(null);

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

  const { points, medianCpl, medianQual, maxLtv, quadrantCounts } = useMemo(() => {
    const withCpl = data.filter(c => c.cpl != null && c.cpl > 0 && c.spend > 0);
    if (withCpl.length === 0) return { points: [], medianCpl: 0, medianQual: 0, maxLtv: 0, quadrantCounts: { escalar: 0, otimizar: 0, investigar: 0, pausar: 0 } };

    const cpls = withCpl.map(c => c.cpl!).sort((a, b) => a - b);
    const quals = withCpl.map(c => c.taxa_qualificacao).sort((a, b) => a - b);
    const medCpl = cpls[Math.floor(cpls.length / 2)];
    const medQual = quals[Math.floor(quals.length / 2)];
    const mLtv = Math.max(...withCpl.map(c => c.ltv_medio || 0));

    const counts = { escalar: 0, otimizar: 0, investigar: 0, pausar: 0 };

    const pts: ScatterPoint[] = withCpl.map(c => {
      const cpl = c.cpl!;
      const qual = c.taxa_qualificacao;
      let quadrant: ScatterPoint["quadrant"];
      if (cpl <= medCpl && qual >= medQual) quadrant = "escalar";
      else if (cpl > medCpl && qual >= medQual) quadrant = "otimizar";
      else if (cpl <= medCpl && qual < medQual) quadrant = "investigar";
      else quadrant = "pausar";
      counts[quadrant]++;

      return {
        x: cpl, y: qual, z: c.spend,
        ltv: c.ltv_medio || 0,
        name: c.ad_name, ad_id: c.ad_id,
        quadrant, creative: c,
      };
    });

    return { points: pts, medianCpl: medCpl, medianQual: medQual, maxLtv: mLtv, quadrantCounts: counts };
  }, [data]);

  const handlePointClick = useCallback((point: ScatterPoint) => {
    setSelectedPoint(point);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;
  if (error) return <Card><CardContent className="py-12 text-center text-destructive text-sm">{error}</CardContent></Card>;
  if (points.length === 0) return <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Dados insuficientes para gerar a matriz. Necessario CPL e leads qualificados.</CardContent></Card>;

  return (
    <div className="space-y-4">
      {/* Quadrant summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["escalar", "otimizar", "investigar", "pausar"] as const).map(q => (
          <Card key={q} className={QUADRANT_CONFIG[q].bg}>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={QUADRANT_CONFIG[q].color}>{QUADRANT_CONFIG[q].icon}</span>
                <p className={cn("text-xs font-bold", QUADRANT_CONFIG[q].color)}>{QUADRANT_CONFIG[q].label}</p>
              </div>
              <p className="text-2xl font-bold">{quadrantCounts[q]}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{QUADRANT_CONFIG[q].desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scatter chart */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold">Matriz de Qualidade de Criativos</p>
              <p className="text-[10px] text-muted-foreground">Tamanho = investimento | Cor = LTV medio (vermelho=baixo, verde=alto)</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>Mediana CPL: <strong className="text-foreground">{formatCurrency(medianCpl)}</strong></span>
              <span>Mediana Qual: <strong className="text-foreground">{formatPercent(medianQual)}</strong></span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={450}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                type="number" dataKey="x" name="CPL"
                label={{ value: "CPL (R$) — menor e melhor", position: "bottom", offset: 10, style: { fill: "#9ca3af", fontSize: 11 } }}
                tickFormatter={(v: number) => `R$${v.toFixed(0)}`}
                tick={{ fill: "#9ca3af", fontSize: 10 }}
              />
              <YAxis
                type="number" dataKey="y" name="Taxa Qualificacao"
                label={{ value: "Taxa Qualificacao (%)", angle: -90, position: "insideLeft", offset: 10, style: { fill: "#9ca3af", fontSize: 11 } }}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                tick={{ fill: "#9ca3af", fontSize: 10 }}
              />
              <ZAxis type="number" dataKey="z" range={[40, 400]} name="Investimento" />
              <ReferenceLine x={medianCpl} stroke="rgba(255,255,255,0.2)" strokeDasharray="5 5" />
              <ReferenceLine y={medianQual} stroke="rgba(255,255,255,0.2)" strokeDasharray="5 5" />
              <Scatter
                data={points}
                onClick={(entry: { payload?: ScatterPoint }) => {
                  if (entry?.payload) handlePointClick(entry.payload);
                }}
                onMouseEnter={(entry: { payload?: ScatterPoint }) => {
                  if (entry?.payload) setHoveredPoint(entry.payload);
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {points.map((p, i) => (
                  <Cell key={i} fill={ltvToColor(p.ltv, maxLtv)} fillOpacity={0.8} stroke={ltvToColor(p.ltv, maxLtv)} strokeWidth={1} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>

          {/* Hover tooltip */}
          {hoveredPoint && (
            <div className="absolute z-50 bg-card border rounded-lg p-3 shadow-lg text-xs max-w-[240px] pointer-events-none" style={{ top: "50%", right: 24 }}>
              <p className="font-semibold truncate">{hoveredPoint.name}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-muted-foreground">
                <span>CPL:</span><span className="text-foreground font-mono">{formatCurrency(hoveredPoint.x)}</span>
                <span>Qualificacao:</span><span className="text-foreground font-mono">{formatPercent(hoveredPoint.y)}</span>
                <span>Investimento:</span><span className="text-foreground font-mono">{formatCurrency(hoveredPoint.z)}</span>
                <span>LTV Medio:</span><span className="text-foreground font-mono">{hoveredPoint.ltv > 0 ? formatCurrency(hoveredPoint.ltv) : "—"}</span>
              </div>
              <Badge className={cn("mt-2 text-[9px]", QUADRANT_CONFIG[hoveredPoint.quadrant].bg, QUADRANT_CONFIG[hoveredPoint.quadrant].color)}>
                {QUADRANT_CONFIG[hoveredPoint.quadrant].label}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedPoint} onOpenChange={(open) => { if (!open) setSelectedPoint(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base truncate">{selectedPoint?.name}</DialogTitle>
          </DialogHeader>
          {selectedPoint && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs">CPL</span><p className="font-mono font-bold">{formatCurrency(selectedPoint.x)}</p></div>
                <div><span className="text-muted-foreground text-xs">Taxa Qualificacao</span><p className="font-mono font-bold">{formatPercent(selectedPoint.y)}</p></div>
                <div><span className="text-muted-foreground text-xs">CPQL</span><p className="font-mono font-bold">{selectedPoint.creative.cpql != null ? formatCurrency(selectedPoint.creative.cpql) : "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Investimento</span><p className="font-mono font-bold">{formatCurrency(selectedPoint.z)}</p></div>
                <div><span className="text-muted-foreground text-xs">Leads Qualificados</span><p className="font-mono font-bold">{selectedPoint.creative.leads_qualificados}</p></div>
                <div><span className="text-muted-foreground text-xs">Reunioes</span><p className="font-mono font-bold">{selectedPoint.creative.reunioes_geradas}</p></div>
                <div><span className="text-muted-foreground text-xs">LTV Medio</span><p className="font-mono font-bold">{selectedPoint.ltv > 0 ? formatCurrency(selectedPoint.ltv) : "—"}</p></div>
              </div>

              <Badge className={cn("text-xs", QUADRANT_CONFIG[selectedPoint.quadrant].bg, QUADRANT_CONFIG[selectedPoint.quadrant].color)}>
                {QUADRANT_CONFIG[selectedPoint.quadrant].icon}
                <span className="ml-1">{QUADRANT_CONFIG[selectedPoint.quadrant].label}</span>
                <span className="ml-1.5 font-normal">— {QUADRANT_CONFIG[selectedPoint.quadrant].desc}</span>
              </Badge>

              <div className="flex gap-2 pt-2">
                {selectedPoint.quadrant === "escalar" || selectedPoint.quadrant === "otimizar" ? (
                  <Button className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => setConfirmAction({ point: selectedPoint, action: "escalar" })}>
                    <TrendingUp size={14} /> Escalar
                  </Button>
                ) : null}
                {selectedPoint.quadrant === "pausar" || selectedPoint.quadrant === "investigar" ? (
                  <Button variant="destructive" className="flex-1 gap-1.5" onClick={() => setConfirmAction({ point: selectedPoint, action: "pausar" })}>
                    <Pause size={14} /> Pausar
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar acao</DialogTitle>
          </DialogHeader>
          {confirmAction && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja <strong className={confirmAction.action === "escalar" ? "text-green-400" : "text-destructive"}>
                  {confirmAction.action === "escalar" ? "ESCALAR" : "PAUSAR"}
                </strong> o criativo <strong>&quot;{confirmAction.point.name}&quot;</strong>?
              </p>
              <p className="text-[11px] text-muted-foreground">
                {confirmAction.action === "escalar"
                  ? "Isso vai aumentar o orcamento deste criativo. A acao sera executada via Meta Ads API."
                  : "Isso vai pausar este criativo no Meta Ads. A acao pode ser revertida depois."}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmAction(null)}>Cancelar</Button>
                <Button
                  className={cn("flex-1", confirmAction.action === "escalar" ? "bg-green-600 hover:bg-green-700" : "")}
                  variant={confirmAction.action === "pausar" ? "destructive" : "default"}
                  onClick={() => {
                    // TODO: integrate with Meta Ads API for real action
                    setConfirmAction(null);
                    setSelectedPoint(null);
                  }}
                >
                  Confirmar {confirmAction.action === "escalar" ? "Escalar" : "Pausar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

