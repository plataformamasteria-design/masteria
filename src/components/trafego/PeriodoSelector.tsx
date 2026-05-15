"use client";
/**
 * PeriodoSelector — Componente único de seleção de período para o módulo Tráfego.
 * Usa o contexto global PeriodoTrafegoContext.
 * Renderizado uma vez no layout, afeta todas as páginas.
 */
import { usePeriodoTrafego, type PeriodoPreset } from "@/contexts/periodo-trafego-context";
import { cn } from "@/lib/utils";

const PRESETS: { value: PeriodoPreset; label: string }[] = [
  { value: "month", label: "Este mês" },
  { value: "7", label: "7d" },
  { value: "14", label: "14d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
  { value: "custom", label: "Personalizado" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Somente Ativos" },
  { value: "all", label: "Todos os Status" },
  { value: "PAUSED", label: "Pausados" },
  { value: "CAMPAIGN_PAUSED", label: "Campanha Pausada" },
  { value: "ADSET_PAUSED", label: "Conjunto Pausado" },
];

export function PeriodoSelector() {
  const { periodo, dataInicio, dataFim, setPeriodo, setDataInicio, setDataFim, statusFiltro, setStatusFiltro } = usePeriodoTrafego();

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Period presets */}
      <div className="flex bg-muted rounded-lg p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriodo(p.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              periodo === p.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date pickers */}
      {periodo === "custom" && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="text-xs bg-transparent border rounded px-2 py-1.5 w-[130px]"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="text-xs bg-transparent border rounded px-2 py-1.5 w-[130px]"
          />
        </div>
      )}

      {/* Status filter */}
      <select
        value={statusFiltro}
        onChange={(e) => setStatusFiltro(e.target.value)}
        className="text-xs bg-transparent border rounded-lg px-3 py-1.5"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
