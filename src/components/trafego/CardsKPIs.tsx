"use client";

import { useState, useEffect, useCallback } from "react";
import { CardKPI } from "./CardKPI";
import { cn } from "@/lib/utils";

type Modo = "midia" | "funil" | "receita";

interface CardsKPIsProps {
  mesReferencia: string;
  dataInicio?: string;
  dataFim?: string;
}

const MODOS: { value: Modo; label: string }[] = [
  { value: "midia", label: "Midia" },
  { value: "funil", label: "Funil" },
  { value: "receita", label: "Receita" },
];

const LS_KEY = "trafego_kpis_modo";

function getInitialModo(): Modo {
  if (typeof window === "undefined") return "midia";
  const saved = localStorage.getItem(LS_KEY);
  if (saved === "midia" || saved === "funil" || saved === "receita") return saved;
  return "midia";
}

export function CardsKPIs({ mesReferencia, dataInicio, dataFim }: CardsKPIsProps) {
  const [modo, setModo] = useState<Modo>(getInitialModo);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  const fetchKpis = useCallback(async (m: Modo) => {
    setLoading(true);
    try {
      // Passar since/until explícitos para garantir mesma fonte de dados de todas as telas
      const dateParams = dataInicio && dataFim ? `&since=${dataInicio}&until=${dataFim}` : "";
      const res = await fetch(`/api/marketing/kpis-trafego?mesReferencia=${mesReferencia}&modo=${m}${dateParams}`);
      const json = await res.json();
      if (!json.error) setData(json);
    } catch (err) {
      console.error("[CardsKPIs] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [mesReferencia, dataInicio, dataFim]);

  useEffect(() => {
    fetchKpis(modo);
  }, [modo, fetchKpis]);

  function handleModoChange(newModo: Modo) {
    if (newModo === modo) return;
    localStorage.setItem(LS_KEY, newModo);
    setTransitioning(true);
    setTimeout(() => {
      setModo(newModo);
      setTransitioning(false);
    }, 100);
  }

  const cards = data?.cards || [];
  const atribuicaoCompleta = data?.atribuicao_completa ?? true;

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center gap-1 mb-4 p-1 bg-muted/50 rounded-lg w-fit">
        {MODOS.map((m) => (
          <button
            key={m.value}
            onClick={() => handleModoChange(m.value)}
            className={cn(
              "px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
              modo === m.value
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className={cn(
        "grid grid-cols-2 lg:grid-cols-4 gap-3 transition-opacity duration-200",
        transitioning && "opacity-0"
      )}>
        {loading
          ? Array.from({ length: modo === "midia" ? 10 : modo === "funil" ? 9 : 8 }).map((_, i) => (
              <CardKPI
                key={i}
                id=""
                label=""
                valor={null}
                tipo="inteiro"
                tendencia={{ valor_anterior: null, variacao_pct: null, direcao: "flat" }}
                tooltip=""
                fonte=""
                requer_atribuicao={false}
                atribuicaoCompleta={true}
                loading
              />
            ))
          : cards.map((card: any) => (
              <CardKPI
                key={card.id}
                {...card}
                atribuicaoCompleta={atribuicaoCompleta}
              />
            ))
        }
      </div>
    </div>
  );
}

