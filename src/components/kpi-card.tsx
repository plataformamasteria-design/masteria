import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  previousValue?: string;
  trend?: "up" | "down" | "neutral";
  /** Quando true, queda é boa (verde) e aumento é ruim (vermelho). Usar para CPL, CPC, CAC, CPQL, No-Show. */
  inverseLogic?: boolean;
  className?: string;
  size?: "primary" | "secondary";
}

export function KpiCard({ title, value, previousValue, trend, inverseLogic, className, size = "primary" }: KpiCardProps) {
  const isPrimary = size === "primary";

  // Determinar se a direção é "boa": para métricas inversas, queda = bom
  const isGood = inverseLogic
    ? trend === "down"
    : trend === "up";
  const isBad = inverseLogic
    ? trend === "up"
    : trend === "down";

  const trendColor =
    isGood ? "text-emerald-500 dark:text-emerald-400" :
      isBad ? "text-red-500 dark:text-red-400" :
        "text-muted-foreground/50";

  const trendBg =
    isGood ? "bg-emerald-500/10 dark:bg-emerald-500/10" :
      isBad ? "bg-red-500/10 dark:bg-red-500/10" :
        "bg-muted/50";

  return (
    <Card className={cn(
      "overflow-hidden",
      isPrimary ? "" : "dark:bg-white/[0.02] bg-muted/30",
      className
    )}>
      {/* Gradient top accent line */}
      <div className="h-[2px] w-full gradient-primary opacity-40 group-hover/card:opacity-80 transition-opacity duration-300" />
      <CardContent className={cn(isPrimary ? "p-5" : "p-4")}>
        <p className={cn(
          "mb-2.5 uppercase tracking-[0.15em] font-medium",
          isPrimary ? "text-[10px] text-muted-foreground/70" : "text-[9px] text-muted-foreground/60"
        )}>
          {title}
        </p>
        <p className={cn("font-bold tracking-tight", isPrimary ? "text-3xl" : "text-xl")}>
          {value}
        </p>
        {previousValue !== undefined && (
          <div className="flex items-center gap-2 mt-3">
            <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium", trendBg, trendColor)}>
              {trend === "up" && <TrendingUp size={11} />}
              {trend === "down" && <TrendingDown size={11} />}
              {trend === "neutral" && <Minus size={11} />}
              <span>Ant: {previousValue}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
