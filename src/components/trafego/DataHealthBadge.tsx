"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type HealthStatus = "verified" | "warning" | "inconsistent";

interface DataHealthBadgeProps {
  status: HealthStatus;
  fonte: string;
  ultimaAtualizacao?: string;
  formula?: string;
  mensagem?: string;
}

const STATUS_CONFIG: Record<HealthStatus, { dot: string; label: string }> = {
  verified: { dot: "bg-emerald-500", label: "Dado verificado" },
  warning: { dot: "bg-yellow-500", label: "Verificar fonte" },
  inconsistent: { dot: "bg-red-500", label: "Dado inconsistente" },
};

export function DataHealthBadge({
  status,
  fonte,
  ultimaAtualizacao,
  formula,
  mensagem,
}: DataHealthBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-medium tracking-wide transition-colors",
              status === "verified" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
              status === "warning" && "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
              status === "inconsistent" && "bg-red-500/10 text-red-400 border border-red-500/20",
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
            {config.label}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs space-y-1">
          <p><span className="font-semibold">Fonte:</span> {fonte}</p>
          {formula && <p><span className="font-semibold">Calculado como:</span> {formula}</p>}
          {ultimaAtualizacao && <p><span className="font-semibold">Última atualização:</span> {ultimaAtualizacao}</p>}
          {mensagem && <p className="text-muted-foreground">{mensagem}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export type { HealthStatus, DataHealthBadgeProps };
