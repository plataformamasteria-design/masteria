"use client";
import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

export type PresetOption = "this_month" | "this_week" | "yesterday" | "last_7d" | "last_14d" | "last_30d" | "custom";
export type StatusFilter = "todos" | "ativo" | "pausado";

interface DateFilterState {
  preset: PresetOption;
  setPreset: (p: PresetOption) => void;
  customRange: { since: string; until: string } | null;
  setCustomRange: (range: { since: string; until: string }) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  resolvedSince: string;
  resolvedUntil: string;
  queryString: string;
}

function today(): string { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
function firstOfMonth(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
function mondayThisWeek(): string { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); return d.toISOString().split("T")[0]; }

function resolveDates(preset: PresetOption, customRange: { since: string; until: string } | null): { since: string; until: string } {
  switch (preset) {
    case "this_month": return { since: firstOfMonth(), until: today() };
    case "this_week": return { since: mondayThisWeek(), until: today() };
    case "yesterday": return { since: daysAgo(1), until: daysAgo(1) };
    case "last_7d": return { since: daysAgo(7), until: today() };
    case "last_14d": return { since: daysAgo(14), until: today() };
    case "last_30d": return { since: daysAgo(30), until: today() };
    case "custom": return customRange || { since: daysAgo(30), until: today() };
    default: return { since: daysAgo(30), until: today() };
  }
}

const DateFilterContext = createContext<DateFilterState | null>(null);

export function DateFilterProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetRaw] = useState<PresetOption>("this_month");
  const [customRange, setCustomRangeRaw] = useState<{ since: string; until: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ativo");

  const setPreset = (p: PresetOption) => { setPresetRaw(p); if (p !== "custom") setCustomRangeRaw(null); };
  const setCustomRange = (range: { since: string; until: string }) => { setCustomRangeRaw(range); setPresetRaw("custom"); };

  const resolved = useMemo(() => resolveDates(preset, customRange), [preset, customRange]);
  const statusParam = statusFilter === "ativo" ? "ACTIVE" : statusFilter === "pausado" ? "PAUSED" : "ALL";
  const queryString = `since=${resolved.since}&until=${resolved.until}&status=${statusParam}`;

  return (
    <DateFilterContext.Provider value={{
      preset, setPreset, customRange, setCustomRange,
      statusFilter, setStatusFilter,
      resolvedSince: resolved.since, resolvedUntil: resolved.until,
      queryString,
    }}>
      {children}
    </DateFilterContext.Provider>
  );
}

export function useDateFilter() {
  const ctx = useContext(DateFilterContext);
  if (!ctx) throw new Error("useDateFilter must be inside DateFilterProvider");
  return ctx;
}
