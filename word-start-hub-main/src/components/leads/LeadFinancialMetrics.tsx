import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertTriangle, Calendar, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  chatId: string;
  organizationId: string;
}

interface Metrics {
  ltv_estimated: number;
  churn_risk: number;
  total_revenue: number;
  avg_ticket: number;
  purchase_count: number;
  total_meetings: number;
  revenue_per_meeting: number;
  first_purchase_at: string | null;
  last_purchase_at: string | null;
}

export default function LeadFinancialMetrics({ chatId, organizationId }: Props) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    if (!chatId || !organizationId) return;
    (supabase as any)
      .from("lead_financial_metrics")
      .select("*")
      .eq("chat_id", chatId)
      .eq("organization_id", organizationId)
      .maybeSingle()
      .then(({ data }: any) => setMetrics(data));
  }, [chatId, organizationId]);

  if (!metrics) return null;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const churnColor = metrics.churn_risk > 70 ? "text-rose-500" : metrics.churn_risk > 40 ? "text-amber-500" : "text-emerald-500";

  return (
    <div className="space-y-2 pt-2 border-t border-border/30">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Métricas Financeiras</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-3 w-3 text-emerald-500" />
          <span className="text-[10px] text-muted-foreground">LTV:</span>
          <span className="text-[10px] font-bold">{fmt(metrics.ltv_estimated)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className={cn("h-3 w-3", churnColor)} />
          <span className="text-[10px] text-muted-foreground">Churn:</span>
          <span className={cn("text-[10px] font-bold", churnColor)}>{metrics.churn_risk}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShoppingCart className="h-3 w-3 text-blue-500" />
          <span className="text-[10px] text-muted-foreground">Compras:</span>
          <span className="text-[10px] font-bold">{metrics.purchase_count}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-amber-500" />
          <span className="text-[10px] text-muted-foreground">Ticket:</span>
          <span className="text-[10px] font-bold">{fmt(metrics.avg_ticket)}</span>
        </div>
      </div>
    </div>
  );
}
