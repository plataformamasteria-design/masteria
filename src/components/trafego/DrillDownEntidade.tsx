"use client";

import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, formatRoas } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePeriodoTrafego } from "@/contexts/periodo-trafego-context";
import type { MetricaEntidade } from "@/lib/metricas/por-entidade";

interface DrillDownEntidadeProps {
  item: MetricaEntidade | null;
  nivel: "campaign" | "adset" | "ad";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoricoMes {
  mes: string;
  investimento: number;
  roas_cash: number | null;
  leads: number;
  contratos_novos: number;
}

interface FilhoItem {
  id: string;
  nome: string;
  investimento: number;
  leads: number;
  cpl: number | null;
  contratos_novos: number;
  roas_cash: number | null;
}

export function DrillDownEntidade({ item, nivel, open, onOpenChange }: DrillDownEntidadeProps) {
  const filters = usePeriodoTrafego();
  const [historico, setHistorico] = useState<HistoricoMes[]>([]);
  const [filhos, setFilhos] = useState<FilhoItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    loadDetails();
  }, [open, item?.id, filters.dataInicio, filters.dataFim]);

  async function loadDetails() {
    if (!item) return;
    setLoading(true);

    // Load 6 months history
    const meses = getLast6Months();
    const nivelFilho = nivel === "campaign" ? "adset" : nivel === "adset" ? "ad" : null;

    const historicoPromises = meses.map(async (mes) => {
      try {
        const [y, m] = mes.split("-").map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const di = `${mes}-01`;
        const df = `${mes}-${String(lastDay).padStart(2, "0")}`;
        const res = await fetch(`/api/marketing/inteligencia-por-entidade?nivel=${nivel}&dataInicio=${di}&dataFim=${df}&status=todos&spendMinimo=0`);
        const json = await res.json();
        const found = json.itens?.find((i: MetricaEntidade) => i.id === item.id);
        return {
          mes: mes.slice(5), // "MM"
          investimento: found?.investimento || 0,
          roas_cash: found?.roas_cash ?? null,
          leads: found?.leads || 0,
          contratos_novos: found?.contratos_novos || 0,
        };
      } catch {
        return { mes: mes.slice(5), investimento: 0, roas_cash: null, leads: 0, contratos_novos: 0 };
      }
    });

    // Load children using the SAME period as the parent table
    let filhosData: FilhoItem[] = [];
    if (nivelFilho) {
      try {
        const params = new URLSearchParams({
          nivel: nivelFilho,
          dataInicio: filters.dataInicio,
          dataFim: filters.dataFim,
          status: "todos",
          spendMinimo: "0",
        });
        const res = await fetch(`/api/marketing/inteligencia-por-entidade?${params}`);
        const json = await res.json();
        filhosData = (json.itens || [])
          .filter((i: MetricaEntidade) => i.parent_id === item.id)
          .map((i: MetricaEntidade) => ({
            id: i.id,
            nome: i.nome,
            investimento: i.investimento,
            leads: i.leads,
            cpl: i.cpl,
            contratos_novos: i.contratos_novos,
            roas_cash: i.roas_cash,
          }))
          .sort((a: FilhoItem, b: FilhoItem) => b.investimento - a.investimento);
      } catch { /* empty */ }
    }

    const hist = await Promise.all(historicoPromises);
    setHistorico(hist);
    setFilhos(filhosData);
    setLoading(false);
  }

  if (!item) return null;

  const nivelFilhoLabel = nivel === "campaign" ? "Conjuntos" : nivel === "adset" ? "Anuncios" : "Leads atribuidos";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[550px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm font-bold truncate pr-8">{item.nome}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <Badge className={cn("text-[9px]", item.status === "ativo" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>
              {item.status === "ativo" ? "Ativo" : "Pausado"}
            </Badge>
            {!item.atribuicao_completa && (
              <Badge className="text-[9px] bg-amber-500/10 text-amber-500">Atribuicao parcial</Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-4 space-y-6 px-1">
            {/* Mini cards */}
            <div className="grid grid-cols-2 gap-3">
              <MiniCard label="Investimento" value={formatCurrency(item.investimento)} />
              <MiniCard label="Leads" value={String(item.leads)} />
              <MiniCard label="Contratos" value={String(item.contratos_novos)} color={item.contratos_novos > 0 ? "text-emerald-400" : undefined} />
              <MiniCard label="ROAS Cash" value={formatRoas(item.roas_cash)} color={item.roas_cash && item.roas_cash >= 1 ? "text-emerald-400" : item.roas_cash && item.roas_cash < 1 ? "text-red-400" : undefined} />
            </div>

            {/* Historico chart */}
            {historico.length > 1 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Histórico (6 meses)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={historico}>
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number, name: string) => [name === "investimento" ? formatCurrency(v) : formatRoas(v), name === "investimento" ? "Investimento" : "ROAS Cash"]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line yAxisId="left" type="monotone" dataKey="investimento" stroke="#6366f1" strokeWidth={2} dot={false} name="Investimento" />
                    <Line yAxisId="right" type="monotone" dataKey="roas_cash" stroke="#22c55e" strokeWidth={2} dot={false} name="ROAS Cash" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Children list */}
            {filhos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{nivelFilhoLabel} ({filhos.length})</p>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {filhos.map(filho => (
                    <div key={filho.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20 dark:bg-white/[0.02] hover:bg-muted/40 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate" title={filho.nome}>{filho.nome}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatCurrency(filho.investimento)} · {filho.leads} leads
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <div className="text-right">
                          <p className="text-[9px] text-muted-foreground">CPL</p>
                          <p className="text-[11px] font-medium">{filho.cpl !== null ? formatCurrency(filho.cpl) : "\u2014"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-muted-foreground">ROAS</p>
                          <p className={cn("text-[11px] font-medium", filho.roas_cash && filho.roas_cash >= 1 ? "text-emerald-400" : "")}>
                            {formatRoas(filho.roas_cash)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nivel === "ad" && (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">
                  {item.leads} leads atribuidos a este anuncio
                </p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MiniCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={cn("text-lg font-bold mt-0.5", color)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function getLast6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}


