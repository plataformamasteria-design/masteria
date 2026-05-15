"use client";
import { useState } from "react";
import { useDateFilter, type PresetOption, type StatusFilter } from "@/contexts/DateFilterContext";
import { cn } from "@/lib/utils";

const PRESETS: { value: PresetOption; label: string }[] = [
  { value: "this_month", label: "Este mês" },
  { value: "this_week", label: "Esta semana" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7d", label: "Últimos 7 dias" },
  { value: "last_14d", label: "Últimos 14 dias" },
  { value: "last_30d", label: "Últimos 30 dias" },
  { value: "custom", label: "Personalizado..." },
];

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "ativo", label: "Ativos" },
  { value: "pausado", label: "Pausados" },
  { value: "todos", label: "Todos" },
];

function fmtDate(d: string) { return d.split("-").reverse().join("/"); }

export function VideoDateFilter() {
  const { preset, setPreset, setCustomRange, statusFilter, setStatusFilter, resolvedSince, resolvedUntil } = useDateFilter();
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customError, setCustomError] = useState("");

  function applyCustom() {
    if (!customSince || !customUntil) { setCustomError("Preencha ambas as datas"); return; }
    if (customUntil < customSince) { setCustomError("Data final anterior à inicial"); return; }
    const diffDays = (new Date(customUntil).getTime() - new Date(customSince).getTime()) / 86400000;
    if (diffDays > 90) { setCustomError("Intervalo máximo de 90 dias"); return; }
    if (customUntil > new Date().toISOString().split("T")[0]) { setCustomError("Data futura não permitida"); return; }
    setCustomError("");
    setCustomRange({ since: customSince, until: customUntil });
    setShowCustom(false);
  }

  function handlePreset(p: PresetOption) {
    if (p === "custom") { setShowCustom(true); return; }
    setShowCustom(false);
    setPreset(p);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <select value={preset} onChange={(e) => handlePreset(e.target.value as PresetOption)}
          className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
          {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <div className="flex bg-muted rounded-lg p-0.5">
          {STATUS_TABS.map((t) => (
            <button key={t.value} onClick={() => setStatusFilter(t.value)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                statusFilter === t.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">{fmtDate(resolvedSince)} a {fmtDate(resolvedUntil)}</span>
      </div>
      {showCustom && (
        <div className="flex items-end gap-2 p-3 bg-muted/30 rounded-lg border">
          <div className="space-y-1"><label className="text-[10px] text-muted-foreground">De</label><input type="date" value={customSince} onChange={(e) => setCustomSince(e.target.value)} max={new Date().toISOString().split("T")[0]} className="text-xs bg-transparent border rounded px-2 py-1.5 w-[130px]" /></div>
          <div className="space-y-1"><label className="text-[10px] text-muted-foreground">Até</label><input type="date" value={customUntil} onChange={(e) => setCustomUntil(e.target.value)} max={new Date().toISOString().split("T")[0]} className="text-xs bg-transparent border rounded px-2 py-1.5 w-[130px]" /></div>
          <button onClick={applyCustom} className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md">Aplicar</button>
          {customError && <span className="text-[10px] text-red-400">{customError}</span>}
        </div>
      )}
    </div>
  );
}
