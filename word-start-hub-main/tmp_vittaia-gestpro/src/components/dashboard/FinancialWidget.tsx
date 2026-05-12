import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, startOfDay, endOfDay, eachDayOfInterval, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

interface FinancialWidgetProps {
  dateRange?: DateRange;
}

export default function FinancialWidget({ dateRange }: FinancialWidgetProps) {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<{ day: string; income: number; expense: number }[]>([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);

  const dateRangeStr = JSON.stringify(dateRange);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const start = dateRange?.from ? startOfDay(dateRange.from) : startOfDay(subDays(new Date(), 7));
      const end = dateRange?.to ? endOfDay(dateRange.to) : endOfDay(new Date());

      const { data: transactions } = await (supabase as any)
        .from("transactions")
        .select("amount, type, created_at")
        .eq("organization_id", currentOrganization.id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      const days = eachDayOfInterval({ start, end });
      const byDay: Record<string, { income: number; expense: number }> = {};
      days.forEach(d => {
        byDay[format(d, "yyyy-MM-dd")] = { income: 0, expense: 0 };
      });

      let totalIncome = 0, totalExpense = 0;
      (transactions || []).forEach((t: any) => {
        const key = format(new Date(t.created_at), "yyyy-MM-dd");
        const amt = Math.abs(Number(t.amount));
        if (t.type === "income" || Number(t.amount) > 0) {
          if (byDay[key]) byDay[key].income += amt;
          totalIncome += amt;
        } else {
          if (byDay[key]) byDay[key].expense += amt;
          totalExpense += amt;
        }
      });

      const chartData = days.map(d => {
        const key = format(d, "yyyy-MM-dd");
        return {
          day: format(d, "dd/MM"),
          income: byDay[key]?.income || 0,
          expense: byDay[key]?.expense || 0,
        };
      });

      setData(chartData);
      setTotals({ income: totalIncome, expense: totalExpense, balance: totalIncome - totalExpense });
    } catch (e) {
      console.error("Financial widget error:", e);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, dateRangeStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs">
          <p className="font-bold mb-1">{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name === "income" ? "Receita" : "Despesa"}: R$ {Number(p.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="glass overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </div>
          <CardTitle className="text-lg font-bold">Resumo Financeiro</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 bg-muted/20" />)}
            </div>
            <Skeleton className="h-[160px] bg-muted/20" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] font-bold uppercase text-emerald-500/70">Receita</span>
                </div>
                <span className="text-lg font-black tracking-tight text-emerald-500">
                  R$ {totals.income.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                  <span className="text-[10px] font-bold uppercase text-red-500/70">Despesa</span>
                </div>
                <span className="text-lg font-black tracking-tight text-red-500">
                  R$ {totals.expense.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className={cn(
                "p-3 rounded-xl border",
                totals.balance >= 0
                  ? "bg-primary/5 border-primary/10"
                  : "bg-red-500/5 border-red-500/10"
              )}>
                <div className="flex items-center gap-1 mb-1">
                  {totals.balance >= 0
                    ? <TrendingUp className="h-3 w-3 text-primary" />
                    : <TrendingDown className="h-3 w-3 text-red-500" />
                  }
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Saldo</span>
                </div>
                <span className={cn(
                  "text-lg font-black tracking-tight",
                  totals.balance >= 0 ? "text-primary" : "text-red-500"
                )}>
                  R$ {totals.balance.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="income" stroke="hsl(var(--primary))" fill="url(#incomeGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#expenseGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
