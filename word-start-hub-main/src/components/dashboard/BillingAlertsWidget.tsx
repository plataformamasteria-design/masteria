import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentAlert {
  id: string;
  reference_month: string;
  total_amount: number;
  status: string;
  due_date: string | null;
}

export default function BillingAlertsWidget() {
  const { currentOrganization } = useOrganization();
  const [alerts, setAlerts] = useState<PaymentAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const { data } = await (supabase as any)
        .from("payment_history")
        .select("id, reference_month, total_amount, status, due_date")
        .eq("organization_id", currentOrganization.id)
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: true })
        .limit(5);
      setAlerts(data || []);
    } catch (e) {
      console.error("Error fetching billing alerts:", e);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  if (loading || alerts.length === 0) return null;

  const hasOverdue = alerts.some(a => a.status === "overdue");

  return (
    <Card className={cn(
      "border-l-4 transition-all",
      hasOverdue
        ? "border-l-red-500 bg-red-500/5 border-red-500/20"
        : "border-l-amber-500 bg-amber-500/5 border-amber-500/20"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "p-2 rounded-xl shrink-0",
            hasOverdue ? "bg-red-500/10" : "bg-amber-500/10"
          )}>
            {hasOverdue
              ? <AlertTriangle className="h-5 w-5 text-red-500" />
              : <CreditCard className="h-5 w-5 text-amber-500" />
            }
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {hasOverdue ? "Cobranças em atraso" : "Cobranças pendentes"}
              </h3>
              <Badge variant="outline" className={cn(
                "text-[10px] font-bold",
                hasOverdue ? "border-red-500/30 text-red-500" : "border-amber-500/30 text-amber-500"
              )}>
                {alerts.length} {alerts.length === 1 ? "fatura" : "faturas"}
              </Badge>
            </div>
            <div className="space-y-1.5">
              {alerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {alert.status === "overdue"
                      ? <AlertTriangle className="h-3 w-3 text-red-500" />
                      : <Clock className="h-3 w-3 text-amber-500" />
                    }
                    <span className="text-muted-foreground">{alert.reference_month}</span>
                  </div>
                  <span className="font-bold">
                    R$ {Number(alert.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
