"use client";

import { useState, useMemo } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  startOfDay, endOfDay, subMonths, subWeeks, subDays,
  addMonths, addWeeks, addDays, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type PeriodMode = "mes" | "semana" | "dia" | "custom";

export interface PeriodRange {
  start: Date;
  end: Date;
}

export interface PeriodFilter {
  mode: PeriodMode;
  setMode: (m: PeriodMode) => void;
  current: PeriodRange;
  previous: PeriodRange;
  label: string;
  compareLabel: string;
  next: () => void;
  prev: () => void;
  setCustom: (current: PeriodRange, previous: PeriodRange) => void;
  anchor: Date;
}

export function usePeriodFilter() {
  const [mode, setMode] = useState<PeriodMode>("mes");
  const [anchor, setAnchor] = useState(new Date());
  const [customCurrent, setCustomCurrent] = useState<PeriodRange | null>(null);
  const [customPrevious, setCustomPrevious] = useState<PeriodRange | null>(null);

  const { current, previous, label, compareLabel } = useMemo(() => {
    if (mode === "custom" && customCurrent && customPrevious) {
      return {
        current: customCurrent,
        previous: customPrevious,
        label: `${format(customCurrent.start, "dd/MM")} - ${format(customCurrent.end, "dd/MM/yyyy")}`,
        compareLabel: `${format(customPrevious.start, "dd/MM")} - ${format(customPrevious.end, "dd/MM")}`,
      };
    }

    let cur: PeriodRange;
    let prev: PeriodRange;
    let lbl: string;
    let cmp: string;

    if (mode === "mes") {
      cur = { start: startOfMonth(anchor), end: endOfMonth(anchor) };
      const prevMonth = subMonths(anchor, 1);
      prev = { start: startOfMonth(prevMonth), end: endOfMonth(prevMonth) };
      lbl = format(anchor, "MMMM 'de' yyyy", { locale: ptBR });
      cmp = format(prevMonth, "MMMM 'de' yyyy", { locale: ptBR });
    } else if (mode === "semana") {
      cur = { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
      const prevWeek = subWeeks(anchor, 1);
      prev = { start: startOfWeek(prevWeek, { weekStartsOn: 1 }), end: endOfWeek(prevWeek, { weekStartsOn: 1 }) };
      lbl = `${format(cur.start, "dd/MM")} - ${format(cur.end, "dd/MM")}`;
      cmp = `${format(prev.start, "dd/MM")} - ${format(prev.end, "dd/MM")}`;
    } else {
      cur = { start: startOfDay(anchor), end: endOfDay(anchor) };
      const prevDay = subDays(anchor, 1);
      prev = { start: startOfDay(prevDay), end: endOfDay(prevDay) };
      lbl = format(anchor, "dd 'de' MMMM", { locale: ptBR });
      cmp = format(prevDay, "dd 'de' MMMM", { locale: ptBR });
    }

    return { current: cur, previous: prev, label: lbl, compareLabel: cmp };
  }, [mode, anchor, customCurrent, customPrevious]);

  const next = () => {
    if (mode === "mes") setAnchor((a) => addMonths(a, 1));
    else if (mode === "semana") setAnchor((a) => addWeeks(a, 1));
    else if (mode === "dia") setAnchor((a) => addDays(a, 1));
  };

  const prev = () => {
    if (mode === "mes") setAnchor((a) => subMonths(a, 1));
    else if (mode === "semana") setAnchor((a) => subWeeks(a, 1));
    else if (mode === "dia") setAnchor((a) => subDays(a, 1));
  };

  const setCustom = (c: PeriodRange, p: PeriodRange) => {
    setCustomCurrent(c);
    setCustomPrevious(p);
    setMode("custom");
  };

  return { mode, setMode, current, previous, label, compareLabel, next, prev, setCustom, anchor };
}
