import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Brain, DollarSign, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cn } from "@/lib/utils";

interface Forecast {
  reference_month: string;
  predicted_revenue: number;
  predicted_new_clients: number;
  predicted_churn: number;
  confidence_score: number;
}

interface FinancialMetricsSummary {
  avg_ltv: number;
  avg_churn_risk: number;
  total_revenue: number;
  avg_ticket: number;
  total_clients: number;
}

export default function FinancialForecastWidget() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [metrics, setMetrics] = useState<FinancialMetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: forecastData }, { data: metricsData }] = await Promise.all([
          (supabase as any)
            .from("financial_forecasts")
            .select("reference_month, predicted_revenue, predicted_new_clients, predicted_churn, confidence_score")
            .eq("organization_id", orgId)
            .order("reference_month", { ascending: false })
            .limit(3),
          (supabase as any)
            .from("lead_financial_metrics")
            .select("ltv_estimated, churn_risk, total_revenue, avg_ticket, purchase_count")
            .eq("organization_id", orgId),
        ]);

        setForecasts(forecastData || []);

        if (metricsData && metricsData.length > 0) {
          const total = metricsData.length;
          setMetrics({
            avg_ltv: metricsData.reduce((s: number, m: any) => s + Number(m.ltv_estimated || 0), 0) / total,
            avg_churn_risk: metricsData.reduce((s: number, m: any) => s + Number(m.churn_risk || 0), 0) / total,
            total_revenue: metricsData.reduce((s: number, m: any) => s + Number(m.total_revenue || 0), 0),
            avg_ticket: metricsData.reduce((s: number, m: any) => s + Number(m.avg_ticket || 0), 0) / total,
            total_clients: metricsData.filter((m: any) => Number(m.purchase_count || 0) > 0).length,
          });
        }
      } catch (e) {
        console.error("[FinancialForecastWidget]", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orgId]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2"><Skeleton className="h-5 w-52" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  const hasData = (forecasts.length > 0 || metrics);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-500" />
          Forecast & Métricas Financeiras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasData ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhum dado financeiro disponível ainda
          </p>
        ) : (
          <>
            {/* LTV & Churn Summary */}
            {metrics && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-[10px] font-medium text-muted-foreground">LTV Médio</span>
                  </div>
                  <p className="text-sm font-bold">{fmt(metrics.avg_ltv)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className={cn("h-3.5 w-3.5", metrics.avg_churn_risk > 50 ? "text-rose-500" : "text-amber-500")} />
                    <span className="text-[10px] font-medium text-muted-foreground">Risco Churn</span>
                  </div>
                  <p className={cn("text-sm font-bold", metrics.avg_churn_risk > 50 ? "text-rose-500" : metrics.avg_churn_risk > 30 ? "text-amber-500" : "text-emerald-500")}>
                    {metrics.avg_churn_risk.toFixed(0)}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-[10px] font-medium text-muted-foreground">Clientes Ativos</span>
                  </div>
                  <p className="text-sm font-bold">{metrics.total_clients}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-[10px] font-medium text-muted-foreground">Ticket Médio</span>
                  </div>
                  <p className="text-sm font-bold">{fmt(metrics.avg_ticket)}</p>
                </div>
              </div>
            )}

            {/* Forecasts */}
            {forecasts.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Projeções</p>
                {forecasts.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors border border-border/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{f.reference_month}</p>
                      <p className="text-sm font-bold text-emerald-500">{fmt(f.predicted_revenue)}</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <div className="flex items-center gap-1 justify-end">
                        <Users className="h-3 w-3 text-blue-400" />
                        <span className="text-[10px]">+{f.predicted_new_clients} novos</span>
                      </div>
                      {f.predicted_churn > 0 && (
                        <div className="flex items-center gap-1 justify-end">
                          <TrendingDown className="h-3 w-3 text-rose-400" />
                          <span className="text-[10px] text-rose-400">-{f.predicted_churn} churn</span>
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {f.confidence_score}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
