"use client";

import { Tooltip } from "@/components/ui/tooltip";
import { AlertTriangle, TrendingUp, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

export type AlertLevel = "critico" | "atencao" | "oportunidade" | "sem_dados";

interface ConjuntoAlertResult {
  level: AlertLevel;
  motivo: string;
}

interface ConjuntoAlertBadgeProps {
  alert: ConjuntoAlertResult;
}

const ALERT_CONFIG: Record<AlertLevel, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  critico: { bg: "bg-red-500/15", text: "text-red-400", icon: AlertTriangle, label: "Critico" },
  atencao: { bg: "bg-yellow-500/15", text: "text-yellow-400", icon: AlertTriangle, label: "Atencao" },
  oportunidade: { bg: "bg-emerald-500/15", text: "text-emerald-400", icon: TrendingUp, label: "Oportunidade" },
  sem_dados: { bg: "bg-muted", text: "text-muted-foreground", icon: MinusCircle, label: "Sem dados" },
};

export function calcConjuntoAlert(
  spend: number,
  leads: number,
  qualificados: number,
  cpl: number,
  metaCpl: number,
  taxaQualif: number,
  mediaContaTaxaQualif: number
): ConjuntoAlertResult {
  // Sem dados
  if (spend < 5) {
    return { level: "sem_dados", motivo: `Investimento insuficiente (${formatCurrency(spend)})` };
  }

  // Critico
  if (spend > 100 && qualificados === 0) {
    return { level: "critico", motivo: `${formatCurrency(spend)} investidos sem nenhum qualificado` };
  }
  if (spend > 50 && leads === 0) {
    return { level: "critico", motivo: `${formatCurrency(spend)} investidos sem nenhum lead gerado` };
  }
  if (metaCpl > 0 && cpl > metaCpl * 2 && leads > 0) {
    return { level: "critico", motivo: `CPL ${formatCurrency(cpl)} — mais de 2x a meta (${formatCurrency(metaCpl)})` };
  }

  // Atencao
  if (spend > 30 && leads === 0) {
    return { level: "atencao", motivo: `${formatCurrency(spend)} investidos sem leads` };
  }
  if (metaCpl > 0 && cpl > metaCpl * 1.3 && cpl <= metaCpl * 2 && leads > 0) {
    return { level: "atencao", motivo: `CPL ${formatCurrency(cpl)} — acima da meta (${formatCurrency(metaCpl)})` };
  }

  // Oportunidade
  if (taxaQualif > mediaContaTaxaQualif * 1.5 && leads >= 3) {
    return { level: "oportunidade", motivo: `Taxa qualificacao ${taxaQualif.toFixed(0)}% — acima da media da conta` };
  }
  if (metaCpl > 0 && cpl < metaCpl * 0.7 && leads >= 3) {
    return { level: "oportunidade", motivo: `CPL ${formatCurrency(cpl)} — abaixo da meta (${formatCurrency(metaCpl)})` };
  }

  return { level: "sem_dados", motivo: "Dados insuficientes para classificar" };
}

export function ConjuntoAlertBadge({ alert }: ConjuntoAlertBadgeProps) {
  const config = ALERT_CONFIG[alert.level];
  const Icon = config.icon;

  return (
    <Tooltip content={alert.motivo}>
      <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium cursor-help", config.bg, config.text)}>
        <Icon size={10} />
        {config.label}
      </span>
    </Tooltip>
  );
}

export function ConjuntoAlertSummary({ alerts }: { alerts: ConjuntoAlertResult[] }) {
  const criticos = alerts.filter(a => a.level === "critico").length;
  const atencao = alerts.filter(a => a.level === "atencao").length;
  const oportunidades = alerts.filter(a => a.level === "oportunidade").length;

  if (criticos === 0 && atencao === 0 && oportunidades === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 text-[11px] bg-muted/20 rounded-lg border border-border/30">
      {criticos > 0 && (
        <span className="text-red-400 flex items-center gap-1">
          <AlertTriangle size={12} /> {criticos} conjunto{criticos > 1 ? "s" : ""} critico{criticos > 1 ? "s" : ""}
        </span>
      )}
      {atencao > 0 && (
        <span className="text-yellow-400 flex items-center gap-1">
          <AlertTriangle size={12} /> {atencao} com CPL acima da meta
        </span>
      )}
      {oportunidades > 0 && (
        <span className="text-emerald-400 flex items-center gap-1">
          <TrendingUp size={12} /> {oportunidades} com performance acima da media
        </span>
      )}
    </div>
  );
}

export type { ConjuntoAlertResult };
