"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { FunilComarka } from "@/components/trafego/FunilComarka";
import { CardsKPIs } from "@/components/trafego/CardsKPIs";
import { BarChart3, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdIntelligence } from "./ai-context";

const LS_KEY = "trafego_ad_intel_secao_beta_aberta";

export function EstrategiaTab() {
  const { period } = useAdIntelligence();
  const mesReferencia = period.since.slice(0, 7);

  // Detectar se o período cruza meses (ex: 30 dias pode pegar abril+maio)
  const mesFim = period.until.slice(0, 7);
  const crossasMeses = mesReferencia !== mesFim;

  const [aberta, setAberta] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(LS_KEY) !== "false";
  });

  function toggle() {
    const next = !aberta;
    setAberta(next);
    localStorage.setItem(LS_KEY, String(next));
  }

  return (
    <div className="space-y-6">
      {/* Header colapsavel */}
      <button onClick={toggle} className="w-full flex items-center justify-between group">
        <div className="flex items-center gap-3">
          <BarChart3 size={18} className="text-primary" />
          <h2 className="text-base font-bold">Análise Estratégica de Aquisição</h2>
          <Badge className="bg-accent/15 text-accent border-accent/30 text-[10px]">BETA</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground hidden md:inline" title="Esta seção é informativa e adicional. Os números nas outras páginas de Tráfego permanecem como fonte oficial.">
            Métricas de aquisição cruzadas com investimento Meta
          </span>
          <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", !aberta && "-rotate-90")} />
        </div>
      </button>

      {aberta && (
        <div className="space-y-8">
          {/* Funil de Aquisição */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Funil de Aquisição Comarka
            </h3>
            <FunilComarka
              mesReferencia={crossasMeses ? undefined : mesReferencia}
              dataInicio={crossasMeses ? new Date(period.since) : undefined}
              dataFim={crossasMeses ? new Date(period.until) : undefined}
            />
          </div>

          {/* KPIs Estrategicos */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              KPIs Estrategicos
            </h3>
            <CardsKPIs mesReferencia={mesReferencia} dataInicio={period.since} dataFim={period.until} />
          </div>
        </div>
      )}
    </div>
  );
}


