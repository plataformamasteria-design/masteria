"use client";

import { useState, useEffect } from "react";
import { TIPOS_FUNIL, type TipoFunil } from "@/components/marketing/FunilCampanhaConfig";
import { cn } from "@/lib/utils";
import { LayoutGrid, MessageCircle, FileText, Video } from "lucide-react";

const STORAGE_KEY = "trafego_funil_filtro";

export type FunilFilterValue = TipoFunil | "todos" | "nao_classificado";

const MAIN_FILTERS: { value: FunilFilterValue; label: string; icon: typeof LayoutGrid; color: string; activeColor: string }[] = [
  { value: "todos", label: "Todos os Funis", icon: LayoutGrid, color: "text-muted-foreground", activeColor: "from-indigo-500 to-violet-500 text-white" },
  { value: "mensagens", label: "Mensagens", icon: MessageCircle, color: "text-blue-400", activeColor: "from-blue-500 to-cyan-500 text-white" },
  { value: "formulario", label: "Formulário", icon: FileText, color: "text-emerald-400", activeColor: "from-emerald-500 to-teal-500 text-white" },
  { value: "webinar", label: "Webinar", icon: Video, color: "text-purple-400", activeColor: "from-purple-500 to-fuchsia-500 text-white" },
];

const EXTRA_FILTERS: { value: FunilFilterValue; label: string }[] = [
  ...TIPOS_FUNIL.filter((t) => !["mensagens", "formulario", "webinar"].includes(t.value)).map((t) => ({ value: t.value as FunilFilterValue, label: t.label })),
  { value: "nao_classificado", label: "Nao classificado" },
];

export function useFunilFilter() {
  const [filtro, setFiltro] = useState<FunilFilterValue>("todos");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && [...MAIN_FILTERS, ...EXTRA_FILTERS].some((o) => o.value === saved)) {
      setFiltro(saved as FunilFilterValue);
    }
  }, []);

  const setFilter = (v: FunilFilterValue) => {
    setFiltro(v);
    localStorage.setItem(STORAGE_KEY, v);
  };

  return { filtro, setFilter };
}

export function FunilFilterBar({ value, onChange, countByFunil }: {
  value: FunilFilterValue;
  onChange: (v: FunilFilterValue) => void;
  countByFunil?: Record<string, { campanhas: number; leads: number }>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {MAIN_FILTERS.map((opt) => {
          const Icon = opt.icon;
          const active = value === opt.value;
          const counts = countByFunil?.[opt.value];
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-semibold flex-1",
                active
                  ? `bg-gradient-to-r ${opt.activeColor} border-transparent shadow-lg shadow-primary/10`
                  : "border-border bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border/80"
              )}
            >
              <Icon size={16} className={active ? "text-white/90" : opt.color} />
              <span>{opt.label}</span>
              {counts && counts.campanhas > 0 && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto",
                  active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {counts.campanhas}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Extra filters — collapsed row for less common types */}
      {EXTRA_FILTERS.length > 0 && (
        <div className="flex gap-1.5">
          {EXTRA_FILTERS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-lg border transition-all",
                value === opt.value
                  ? "bg-white/[0.08] text-foreground border-primary/30"
                  : "border-border/50 text-muted-foreground/70 hover:text-muted-foreground hover:bg-white/[0.04]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

