"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle, AlertCircle } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface TimestampData {
  ultima_atualizacao: string;
  minutos_atras: number;
}

/**
 * Exibe "Atualizado às HH:MM • X min atrás" com badges de freshness.
 * Fonte: MAX(updated_at) de ads_performance no período.
 * > 2h: badge amarelo "Pode estar desatualizado"
 * > 4h: badge vermelho "Sync com atraso"
 */
export function InvestimentoTimestamp({ className }: { className?: string }) {
  const { data } = useSWR<TimestampData>(
    "/api/marketing/data-freshness",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000, refreshInterval: 60000 }
  );

  // Listen for sync events to refresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("comarka-sync-done", handler);
    return () => window.removeEventListener("comarka-sync-done", handler);
  }, []);

  if (!data?.ultima_atualizacao) return null;

  const dt = new Date(data.ultima_atualizacao);
  const hora = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const min = data.minutos_atras;

  const label = min < 60
    ? `${min} min atrás`
    : min < 1440
      ? `${Math.floor(min / 60)}h atrás`
      : `${Math.floor(min / 1440)}d atrás`;

  const isWarning = min > 120; // > 2h
  const isCritical = min > 240; // > 4h

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock size={10} />
        Atualizado às {hora} &bull; {label}
      </span>
      {isCritical && (
        <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
          <AlertCircle size={10} /> Sync com atraso
        </span>
      )}
      {isWarning && !isCritical && (
        <span className="inline-flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">
          <AlertTriangle size={10} /> Pode estar desatualizado
        </span>
      )}
    </div>
  );
}

