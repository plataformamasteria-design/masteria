"use client";

import { useAdIntelligence } from "./ai-context";
import { Activity, BellRing, Cpu, Target, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "recomendacoes", label: "Plano de Ação", icon: Cpu },
  { id: "benchmark", label: "Benchmark", icon: Target },
  { id: "alertas", label: "Alertas", icon: BellRing },
  { id: "estrategia", label: "Estrategia BETA", icon: BarChart3 },
] as const;

export function AdIntelligenceTabs() {
  const { activeTab, setActiveTab } = useAdIntelligence();

  return (
    <div className="flex gap-2 p-1 overflow-x-auto scrollbar-hide border-b border-border pb-3">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all whitespace-nowrap",
              isActive 
                ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(0,153,255,0.1)]" 
                : "text-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-black/5 dark:bg-white/5 border border-transparent"
            )}
          >
            <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-foreground/60")} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
