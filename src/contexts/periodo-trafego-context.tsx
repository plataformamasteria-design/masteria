"use client";
/**
 * PeriodoTrafegoContext — Estado global de período para o módulo de marketing/tráfego.
 * Todas as páginas de tráfego usam este contexto ao invés de estado local.
 * Persiste no localStorage com key 'masteria-trafego-periodo'.
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";

const STORAGE_KEY = "masteria-trafego-periodo";

export type PeriodoPreset = "month" | "7" | "14" | "30" | "90" | "custom";

export interface PeriodoTrafegoState {
  periodo: PeriodoPreset;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  label: string;
}

interface PeriodoTrafegoContextType extends PeriodoTrafegoState {
  setPeriodo: (p: PeriodoPreset) => void;
  setDataInicio: (d: string) => void;
  setDataFim: (d: string) => void;
  /** Status filter (kept global for convenience) */
  statusFiltro: string;
  setStatusFiltro: (s: string) => void;
  /** "Somente com dados" toggle */
  somenteComDados: boolean;
  setSomenteComDados: (v: boolean) => void;
  /** Campanha filter */
  campanhaFiltro: string;
  setCampanhaFiltro: (c: string) => void;
}

const LABELS: Record<PeriodoPreset, string> = {
  month: "Este mês",
  "7": "7 dias",
  "14": "14 dias",
  "30": "30 dias",
  "90": "3 meses",
  custom: "Personalizado",
};

function getHoje(): string {
  return new Date().toISOString().split("T")[0];
}

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function calcDates(preset: PeriodoPreset): { dataInicio: string; dataFim: string } {
  const hoje = getHoje();
  if (preset === "month") return { dataInicio: getMonthStart(), dataFim: hoje };
  if (preset === "custom") return { dataInicio: hoje, dataFim: hoje };
  const d = new Date();
  d.setDate(d.getDate() - Number(preset));
  return { dataInicio: d.toISOString().split("T")[0], dataFim: hoje };
}

const PeriodoTrafegoCtx = createContext<PeriodoTrafegoContextType | undefined>(undefined);

export function PeriodoTrafegoProvider({ children }: { children: ReactNode }) {
  const [periodo, setPeriodoState] = useState<PeriodoPreset>("30");
  const [dataInicio, setDataInicioState] = useState(() => calcDates("30").dataInicio);
  const [dataFim, setDataFimState] = useState(getHoje);
  const [statusFiltro, setStatusFiltro] = useState("ACTIVE");
  const [somenteComDados, setSomenteComDados] = useState(true);
  const [campanhaFiltro, setCampanhaFiltro] = useState("all");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.periodo) {
          const p = parsed.periodo as PeriodoPreset;
          setPeriodoState(p);
          if (p === "custom" && parsed.dataInicio && parsed.dataFim) {
            setDataInicioState(parsed.dataInicio);
            setDataFimState(parsed.dataFim);
          } else {
            const dates = calcDates(p);
            setDataInicioState(dates.dataInicio);
            setDataFimState(dates.dataFim);
          }
          if (parsed.statusFiltro) setStatusFiltro(parsed.statusFiltro);
        }
      }
    } catch { /* ignore parse errors */ }
    setHydrated(true);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ periodo, dataInicio, dataFim, statusFiltro }));
    } catch { /* ignore */ }
  }, [periodo, dataInicio, dataFim, statusFiltro, hydrated]);

  const setPeriodo = useCallback((p: PeriodoPreset) => {
    setPeriodoState(p);
    if (p !== "custom") {
      const dates = calcDates(p);
      setDataInicioState(dates.dataInicio);
      setDataFimState(dates.dataFim);
    }
  }, []);

  const setDataInicio = useCallback((d: string) => {
    setDataInicioState(d);
    setPeriodoState("custom");
  }, []);

  const setDataFim = useCallback((d: string) => {
    setDataFimState(d);
    setPeriodoState("custom");
  }, []);

  const label = LABELS[periodo];

  const value = useMemo(() => ({
    periodo, dataInicio, dataFim, label,
    setPeriodo, setDataInicio, setDataFim,
    statusFiltro, setStatusFiltro,
    somenteComDados, setSomenteComDados,
    campanhaFiltro, setCampanhaFiltro,
  }), [periodo, dataInicio, dataFim, label, setPeriodo, setDataInicio, setDataFim, statusFiltro, somenteComDados, campanhaFiltro]);

  return (
    <PeriodoTrafegoCtx.Provider value={value}>
      {children}
    </PeriodoTrafegoCtx.Provider>
  );
}

export function usePeriodoTrafego(): PeriodoTrafegoContextType {
  const ctx = useContext(PeriodoTrafegoCtx);
  if (!ctx) throw new Error("usePeriodoTrafego must be used within PeriodoTrafegoProvider");
  return ctx;
}
