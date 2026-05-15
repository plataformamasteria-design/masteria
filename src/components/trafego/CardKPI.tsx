"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Lock, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIRECAO_POSITIVA } from "@/lib/metricas/direcao-positiva";
import { ATRIBUICAO_INICIO_LABEL } from "@/lib/atribuicao";

interface CardKPIProps {
  id: string;
  label: string;
  valor: number | null;
  tipo: "moeda" | "inteiro" | "percentual" | "multiplicador" | "meses";
  tendencia: {
    valor_anterior: number | null;
    variacao_pct: number | null;
    direcao: "up" | "down" | "flat";
  };
  benchmark?: {
    ideal_min: number;
    ideal_max: number;
    status: "verde" | "amarelo" | "vermelho";
  };
  tooltip: string;
  fonte: string;
  requer_atribuicao: boolean;
  atribuicaoCompleta: boolean;
  loading?: boolean;
  detalhe?: string;
}

function formatValor(valor: number | null, tipo: CardKPIProps["tipo"]): string {
  if (valor == null) return "\u2014";
  switch (tipo) {
    case "moeda":
      if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1)}M`;
      if (valor >= 10_000) return `R$ ${(valor / 1_000).toFixed(1)}k`;
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(valor);
    case "inteiro":
      return new Intl.NumberFormat("pt-BR").format(Math.round(valor));
    case "percentual":
      return `${valor.toFixed(1)}%`;
    case "multiplicador":
      return `${valor.toFixed(2)}x`;
    case "meses":
      return `${valor.toFixed(1)} meses`;
    default:
      return String(valor);
  }
}

export function CardKPI(props: CardKPIProps) {
  const {
    id, label, valor, tipo, tendencia: tend, benchmark,
    tooltip, fonte, requer_atribuicao, atribuicaoCompleta, loading, detalhe,
  } = props;

  const bloqueado = requer_atribuicao && !atribuicaoCompleta;
  const direcaoPositiva = DIRECAO_POSITIVA[id] || "up";

  // Determinar cor da tendencia baseada na direcao positiva da metrica
  let trendColor = "text-muted-foreground/50";
  let trendBg = "bg-muted/50";
  if (tend.variacao_pct != null && tend.direcao !== "flat" && direcaoPositiva !== "flat") {
    const isGood =
      (direcaoPositiva === "up" && tend.direcao === "up") ||
      (direcaoPositiva === "down" && tend.direcao === "down");
    trendColor = isGood ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400";
    trendBg = isGood ? "bg-emerald-500/10" : "bg-red-500/10";
  }

  // Benchmark dot color
  const benchmarkDot = benchmark
    ? benchmark.status === "verde" ? "bg-emerald-500"
      : benchmark.status === "amarelo" ? "bg-yellow-500"
        : "bg-red-500"
    : null;

  if (loading) {
    return (
      <Card className="overflow-hidden animate-pulse">
        <div className="h-[2px] w-full bg-muted" />
        <CardContent className="p-4">
          <div className="h-3 w-20 bg-muted rounded mb-3" />
          <div className="h-8 w-28 bg-muted rounded mb-2" />
          <div className="h-4 w-16 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "overflow-hidden relative transition-opacity duration-200",
      bloqueado && "opacity-60"
    )}>
      <div className="h-[2px] w-full gradient-primary opacity-40" />
      <CardContent className="p-4">
        {/* Label + tooltip */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-[0.15em] font-medium text-muted-foreground/70">
            {label}
          </p>
          <div className="flex items-center gap-1">
            {benchmarkDot && (
              <span className={cn("w-1.5 h-1.5 rounded-full", benchmarkDot)} title={`Benchmark: ${benchmark!.ideal_min}-${benchmark!.ideal_max}`} />
            )}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info size={12} className="text-muted-foreground/40 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  <p>{tooltip}</p>
                  <p className="text-muted-foreground mt-1">Fonte: {fonte}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Valor principal */}
        <p className="text-2xl font-bold tracking-tight">
          {formatValor(valor, tipo)}
        </p>
        {detalhe && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{detalhe}</p>
        )}

        {/* Tendencia */}
        {tend.variacao_pct != null && (
          <div className="flex items-center gap-2 mt-2">
            <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium", trendBg, trendColor)}>
              {tend.direcao === "up" && <TrendingUp size={11} />}
              {tend.direcao === "down" && <TrendingDown size={11} />}
              {tend.direcao === "flat" && <Minus size={11} />}
              <span>{tend.variacao_pct > 0 ? "+" : ""}{tend.variacao_pct.toFixed(1)}%</span>
            </div>
            {tend.valor_anterior != null && (
              <span className="text-[10px] text-muted-foreground/50">
                ant: {formatValor(tend.valor_anterior, tipo)}
              </span>
            )}
          </div>
        )}
      </CardContent>

      {/* Overlay bloqueado */}
      {bloqueado && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-[2px] rounded-lg">
          <Lock size={16} className="text-muted-foreground/60 mb-1" />
          <p className="text-[10px] text-muted-foreground/60 text-center px-4">
            Indisponivel antes de {ATRIBUICAO_INICIO_LABEL}
          </p>
        </div>
      )}
    </Card>
  );
}
