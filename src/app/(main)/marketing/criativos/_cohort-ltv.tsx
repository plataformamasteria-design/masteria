"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CohortEntry {
  mes_entrada: string;
  clientes: number;
  ltv_3m: number;
  ltv_6m: number;
  ltv_12m: number;
  mrr_medio: number;
}

interface Creative {
  ad_id: string;
  ad_name: string;
  spend: number;
  cpl: number | null;
  cpql: number | null;
  leads_qualificados: number;
  fechamentos: number;
  ltv_medio: number | null;
  mrr_medio: number | null;
  cohorts: CohortEntry[];
}

export default function CohortLtvTab() {
  const [data, setData] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const withCohorts = useMemo(() =>
    data.filter(c => c.cohorts && c.cohorts.length > 0),
    [data]
  );

  const selected = useMemo(() => {
    if (selectedId) return withCohorts.find(c => c.ad_id === selectedId) || null;
    return null;
  }, [withCohorts, selectedId]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;
  if (error) return <Card><CardContent className="py-12 text-center text-destructive text-sm">{error}</CardContent></Card>;
  if (withCohorts.length === 0) return (
    <Card>
      <CardContent className="py-12">
        <div className="max-w-md mx-auto text-center space-y-4">
          <p className="text-lg font-semibold">Cohort LTV — Em breve</p>
          <div className="bg-muted/30 rounded-lg p-4 text-left space-y-3">
            <p className="text-sm text-muted-foreground">
              Para ativar o Cohort LTV, os fechamentos precisam ser registrados com o ad_id de origem no momento do contrato.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-semibold">Como fazer:</p>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Ao fechar um cliente no CRM, registrar o campo &quot;criativo_origem&quot;</li>
                <li>O sistema cruzara automaticamente o MRR gerado com o criativo que gerou o lead</li>
              </ol>
            </div>
            <div className="flex gap-2 pt-2">
              <a href="/crm" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors border border-primary/30 rounded-lg px-3 py-1.5">
                Ir para CRM
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Creative-level summary */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-semibold mb-1">LTV por Criativo</p>
          <p className="text-[10px] text-muted-foreground mb-3">
            Criativos com clientes fechados — ordenados por LTV medio decrescente
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criativo</TableHead>
                <TableHead className="text-right">Fechamentos</TableHead>
                <TableHead className="text-right">LTV Medio</TableHead>
                <TableHead className="text-right">MRR Medio</TableHead>
                <TableHead className="text-right">Investimento</TableHead>
                <TableHead className="text-right">CPQL</TableHead>
                <TableHead className="text-right">ROI (LTV/Invest)</TableHead>
                <TableHead className="text-center">Cohorts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withCohorts
                .sort((a, b) => (b.ltv_medio || 0) - (a.ltv_medio || 0))
                .map(c => {
                  const roi = c.spend > 0 && c.ltv_medio ? ((c.ltv_medio * c.fechamentos) / c.spend) : null;
                  return (
                    <TableRow
                      key={c.ad_id}
                      className={cn("cursor-pointer", selected?.ad_id === c.ad_id && "bg-primary/5")}
                      onClick={() => setSelectedId(c.ad_id)}
                    >
                      <TableCell className="max-w-[200px]">
                        <p className="text-xs font-medium truncate">{c.ad_name}</p>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">{c.fechamentos}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{c.ltv_medio != null ? formatCurrency(c.ltv_medio) : "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{c.mrr_medio != null ? formatCurrency(c.mrr_medio) : "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCurrency(c.spend)}</TableCell>
                      <TableCell className="text-right">
                        {c.cpql != null ? (
                          <span className={cn("font-mono text-xs font-bold",
                            c.cpql <= 50 ? "text-green-400" : c.cpql <= 100 ? "text-accent" : c.cpql <= 200 ? "text-yellow-400" : "text-destructive"
                          )}>{formatCurrency(c.cpql)}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {roi != null ? (
                          <span className={cn("font-mono text-xs font-bold",
                            roi >= 3 ? "text-green-400" : roi >= 1.5 ? "text-accent" : roi >= 1 ? "text-yellow-400" : "text-destructive"
                          )}>{roi.toFixed(1)}x</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">{c.cohorts.length} meses</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Selected creative cohort detail */}
      {selected && (
        <Card className="border-primary/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-semibold mb-1">Cohort: {selected.ad_name}</p>
            <p className="text-[10px] text-muted-foreground mb-3">
              LTV acumulado por mes de entrada do cliente
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes de Entrada</TableHead>
                  <TableHead className="text-right">Clientes</TableHead>
                  <TableHead className="text-right">LTV 3 meses</TableHead>
                  <TableHead className="text-right">LTV 6 meses</TableHead>
                  <TableHead className="text-right">LTV 12 meses</TableHead>
                  <TableHead className="text-right">MRR Medio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected.cohorts.map(ch => (
                  <TableRow key={ch.mes_entrada}>
                    <TableCell className="text-xs font-medium capitalize">{formatMonthLabel(ch.mes_entrada)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{ch.clientes}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(ch.ltv_3m)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(ch.ltv_6m)}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">{formatCurrency(ch.ltv_12m)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(ch.mrr_medio)}</TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell className="text-xs">Total / Media</TableCell>
                  <TableCell className="text-right font-mono text-xs">{selected.cohorts.reduce((s, c) => s + c.clientes, 0)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatCurrency(avg(selected.cohorts.map(c => c.ltv_3m)))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatCurrency(avg(selected.cohorts.map(c => c.ltv_6m)))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatCurrency(avg(selected.cohorts.map(c => c.ltv_12m)))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatCurrency(avg(selected.cohorts.map(c => c.mrr_medio)))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

