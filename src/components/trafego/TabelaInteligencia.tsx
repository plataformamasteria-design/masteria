"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatPercent, formatRoas } from "@/lib/format";
import { ArrowUpDown, AlertTriangle, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePeriodoTrafego } from "@/contexts/periodo-trafego-context";
import type { MetricaEntidade, MetricasPorEntidadeResult } from "@/lib/metricas/por-entidade";

interface TabelaInteligenciaProps {
  nivel: "campaign" | "adset" | "ad";
  onRowClick?: (item: MetricaEntidade) => void;
}

const NIVEL_LABEL: Record<string, string> = {
  campaign: "Campanha",
  adset: "Conjunto",
  ad: "Anuncio",
};

export function TabelaInteligencia({ nivel, onRowClick }: TabelaInteligenciaProps) {
  const filters = usePeriodoTrafego();

  const [data, setData] = useState<MetricasPorEntidadeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFiltro, setStatusFiltro] = useState<"todos" | "ativo" | "pausado">("todos");
  const [spendMinimo, setSpendMinimo] = useState(0);
  const [busca, setBusca] = useState("");

  // Sort
  const [sortCol, setSortCol] = useState<string>("investimento");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        nivel,
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
        status: statusFiltro,
        spendMinimo: String(spendMinimo),
      });
      const res = await fetch(`/api/marketing/inteligencia-por-entidade?${params}`);
      if (!res.ok) throw new Error("Erro ao buscar dados");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
    setLoading(false);
  }, [nivel, filters.dataInicio, filters.dataFim, statusFiltro, spendMinimo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Listen for global sync events (triggered by SyncButton in visao-geral)
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("comarka-sync-done", handler);
    return () => window.removeEventListener("comarka-sync-done", handler);
  }, [fetchData]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const filteredItems = useMemo(() => {
    if (!data) return [];
    let items = data.itens;
    if (busca.trim()) {
      const term = busca.toLowerCase();
      items = items.filter(i => i.nome.toLowerCase().includes(term));
    }
    return [...items].sort((a, b) => {
      const va = (a as unknown as Record<string, number>)[sortCol] ?? 0;
      const vb = (b as unknown as Record<string, number>)[sortCol] ?? 0;
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [data, busca, sortCol, sortDir]);

  const columns = [
    { key: "nome", label: NIVEL_LABEL[nivel], align: "left" as const },
    { key: "investimento", label: "Investimento", format: (v: number) => formatCurrency(v) },
    { key: "leads", label: "Leads", format: (v: number) => String(v) },
    { key: "cpl", label: "CPL", format: (v: number | null) => v !== null ? formatCurrency(v) : "\u2014" },
    { key: "qualificados", label: "Qualif.", format: (v: number) => String(v) },
    { key: "taxa_qualificacao_pct", label: "Taxa Qual.", format: (v: number | null) => v !== null ? formatPercent(v) : "\u2014" },
    { key: "reunioes_agendadas", label: "Reun. Ag.", format: (v: number) => v > 0 ? String(v) : "\u2014" },
    { key: "reunioes_realizadas", label: "Reun. Feitas", format: (v: number) => v > 0 ? String(v) : "\u2014" },
    { key: "cprf", label: "CPRF", format: (v: number | null) => v !== null ? formatCurrency(v) : "\u2014" },
    { key: "mql", label: "MQL", format: (v: number) => v > 0 ? String(v) : "\u2014", tooltip: data?.mqlSqlConfig ? `MQL: ${data.mqlSqlConfig.mql.join(", ")} — configurável em /config` : undefined },
    { key: "taxa_mql_pct", label: "% MQL", format: (v: number | null) => v !== null && v > 0 ? formatPercent(v) : "\u2014" },
    { key: "custo_mql", label: "Custo/MQL", format: (v: number | null) => v !== null ? formatCurrency(v) : "\u2014" },
    { key: "sql", label: "SQL", format: (v: number) => v > 0 ? String(v) : "\u2014", tooltip: data?.mqlSqlConfig ? `SQL: ${data.mqlSqlConfig.sql.join(", ")} — configurável em /config` : undefined },
    { key: "taxa_sql_pct", label: "% SQL", format: (v: number | null) => v !== null && v > 0 ? formatPercent(v) : "\u2014" },
    { key: "custo_sql", label: "Custo/SQL", format: (v: number | null) => v !== null ? formatCurrency(v) : "\u2014" },
    { key: "no_show_pct", label: "No-show", format: (v: number | null) => v !== null ? formatPercent(v) : "\u2014" },
    { key: "contratos_novos", label: "Fechamentos", format: (v: number) => v > 0 ? String(v) : "\u2014" },
    { key: "taxa_fechamento_pct", label: "Tx. Fech.", format: (v: number | null) => v !== null ? formatPercent(v) : "\u2014" },
    { key: "mrr_gerado", label: "MRR", format: (v: number) => v > 0 ? formatCurrency(v) : "\u2014" },
    { key: "cac", label: "CAC", format: (v: number | null) => v !== null ? formatCurrency(v) : "\u2014" },
    { key: "roas_cash", label: "ROAS Cash", format: (v: number | null) => formatRoas(v) },
    { key: "roas_real", label: "ROAS Real", format: (v: number | null) => formatRoas(v) },
  ];

  // Color helpers
  function cellColor(col: string, value: unknown): string {
    if (value === null || value === undefined) return "";
    const v = Number(value);
    if (col === "roas_cash" || col === "roas_real") {
      if (v >= 2) return "text-emerald-500 dark:text-emerald-400";
      if (v >= 1) return "text-amber-500 dark:text-amber-400";
      if (v > 0) return "text-red-500 dark:text-red-400";
    }
    if (col === "no_show_pct" && v > 30) return "text-amber-500 dark:text-amber-400";
    if (col === "cprf" && v > 0 && v < 2000) return "text-emerald-500 dark:text-emerald-400";
    if (col === "cprf" && v > 5000) return "text-red-500 dark:text-red-400";
    if (col === "taxa_fechamento_pct" && v >= 10) return "text-emerald-500 dark:text-emerald-400";
    if (col === "taxa_fechamento_pct" && v > 0 && v < 5) return "text-red-500 dark:text-red-400";
    if (col === "cac" && v > 3000) return "text-red-500 dark:text-red-400";
    if (col === "mrr_gerado" && v > 0) return "text-emerald-500 dark:text-emerald-400";
    if (col === "contratos_novos" && v > 0) return "text-emerald-500 dark:text-emerald-400";
    return "";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando metricas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-red-400">
          <AlertTriangle className="mx-auto mb-2" size={20} />
          <p className="text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const totais = data?.totais;

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFiltro}
          onChange={e => setStatusFiltro(e.target.value as "todos" | "ativo" | "pausado")}
          className="text-xs bg-transparent border rounded-lg px-3 py-2"
        >
          <option value="todos">Todos</option>
          <option value="ativo">Ativos</option>
          <option value="pausado">Pausados</option>
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Spend min:</span>
          <input
            type="range"
            min={0}
            max={5000}
            step={100}
            value={spendMinimo}
            onChange={e => setSpendMinimo(Number(e.target.value))}
            className="w-24 h-1.5"
          />
          <span className="text-[10px] font-mono text-muted-foreground w-16">R$ {spendMinimo}</span>
        </div>
        <div className="relative flex-1 max-w-[200px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full text-xs bg-transparent border rounded-lg pl-8 pr-3 py-2"
          />
        </div>
      </div>

      {/* Attribution warning */}
      {totais && !totais.atribuicao_completa && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
          <AlertTriangle size={14} />
          <span className="text-xs">Periodo anterior a 04/2026 — atribuicao parcial (sem ad_id historico)</span>
        </div>
      )}

      {/* Table */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">Nenhum item com spend &gt; R$ {spendMinimo} no periodo selecionado</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  {/* TOTAL row sticky */}
                  {totais && (
                    <tr className="bg-muted/30 dark:bg-white/[0.03] border-b-2 border-primary/20 font-bold text-xs">
                      <td className="px-3 py-2 text-left sticky left-0 bg-muted/30 dark:bg-zinc-900/90 z-10">
                        TOTAL ({filteredItems.length})
                      </td>
                      {columns.slice(1).map(col => {
                        const val = (totais as unknown as Record<string, unknown>)[col.key];
                        return (
                          <td key={col.key} className={cn("px-3 py-2 text-right whitespace-nowrap", cellColor(col.key, val))}>
                            {col.format ? col.format(val as number) : String(val ?? "\u2014")}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2" />
                    </tr>
                  )}
                  <tr className="border-b border-border dark:border-white/[0.06] text-muted-foreground">
                    {columns.map(col => (
                      <th
                        key={col.key}
                        onClick={() => toggleSort(col.key)}
                        className={cn(
                          "px-3 py-2 font-medium text-[10px] uppercase tracking-wider cursor-pointer hover:text-foreground whitespace-nowrap",
                          col.align === "left" ? "text-left sticky left-0 bg-background z-10" : "text-right"
                        )}
                        title={col.tooltip}
                      >
                        {col.label}
                        {col.tooltip && <span className="text-[8px] text-muted-foreground/50 ml-0.5">ⓘ</span>}
                        {sortCol === col.key && <ArrowUpDown size={9} className="inline ml-0.5" />}
                      </th>
                    ))}
                    <th className="px-3 py-2 font-medium text-[10px] text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => (
                    <tr
                      key={item.id}
                      onClick={() => onRowClick?.(item)}
                      className={cn(
                        "border-b border-border dark:border-white/[0.06] hover:bg-muted/30 dark:hover:bg-white/[0.02] transition-colors",
                        onRowClick && "cursor-pointer"
                      )}
                    >
                      {columns.map(col => {
                        if (col.key === "nome") {
                          return (
                            <td key={col.key} className="px-3 py-2 text-xs font-medium max-w-[220px] truncate sticky left-0 bg-background z-10" title={item.nome}>
                              {item.nome}
                            </td>
                          );
                        }
                        const val = (item as unknown as Record<string, unknown>)[col.key];
                        return (
                          <td key={col.key} className={cn("px-3 py-2 text-right text-xs whitespace-nowrap", cellColor(col.key, val))}>
                            {col.format ? col.format(val as number) : String(val ?? "\u2014")}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center">
                        <Badge className={cn("text-[9px]", item.status === "ativo" ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                          {item.status === "ativo" ? "Ativo" : "Pausado"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

