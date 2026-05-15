"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import { subDays, format } from "date-fns";
import { usePeriodoTrafego } from "@/contexts/periodo-trafego-context";

export type AdIntelligenceTab =
  | "overview"
  | "alertas"
  | "recomendacoes"
  | "benchmark"
  | "estrategia";

interface AdIntelligenceContextData {
  activeTab: AdIntelligenceTab;
  setActiveTab: (tab: AdIntelligenceTab) => void;
  objectiveFilter: string;
  setObjectiveFilter: (obj: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;

  // Period derived from global PeriodoTrafegoContext
  period: { since: string; until: string; prevSince: string; prevUntil: string };

  // Legacy compat: datePreset/setDatePreset are no-ops now (period comes from layout)
  datePreset: string;
  setDatePreset: (preset: string) => void;
  customSince: string;
  customUntil: string;
  setCustomSince: (date: string) => void;
  setCustomUntil: (date: string) => void;

  // AI State
  fullReport: any | null;
  setFullReport: (report: any | null) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
}

const AdContext = createContext<AdIntelligenceContextData | undefined>(undefined);

export function AdIntelligenceProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<AdIntelligenceTab>("overview");
  const [objectiveFilter, setObjectiveFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fullReport, setFullReport] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Read from global period context
  const { dataInicio, dataFim } = usePeriodoTrafego();

  const period = useMemo(() => {
    const since = dataInicio;
    const until = dataFim;

    const dtSince = new Date(since);
    const dtUntil = new Date(until);
    const msDiff = dtUntil.getTime() - dtSince.getTime();
    const days = Math.floor(msDiff / 86400000) + 1;

    const prevUntilDt = subDays(dtSince, 1);
    const prevSinceDt = subDays(prevUntilDt, days - 1);

    return {
      since,
      until,
      prevSince: format(prevSinceDt, "yyyy-MM-dd"),
      prevUntil: format(prevUntilDt, "yyyy-MM-dd"),
    };
  }, [dataInicio, dataFim]);

  return (
    <AdContext.Provider value={{
      activeTab, setActiveTab,
      objectiveFilter, setObjectiveFilter,
      statusFilter, setStatusFilter,
      period,
      // Legacy compat stubs — period is now controlled by global context
      datePreset: "global", setDatePreset: () => {},
      customSince: dataInicio, customUntil: dataFim,
      setCustomSince: () => {}, setCustomUntil: () => {},
      fullReport, setFullReport,
      isGenerating, setIsGenerating,
    }}>
      {children}
    </AdContext.Provider>
  );
}

export function useAdIntelligence() {
  const ctx = useContext(AdContext);
  if (!ctx) throw new Error("useAdIntelligence must be used within AdIntelligenceProvider");
  return ctx;
}
