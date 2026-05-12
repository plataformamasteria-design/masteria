import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useOrganization } from "@/contexts/OrganizationContext";
import { BarChart3 } from "lucide-react";

interface RevenueChartProps {
  dateRange: DateRange;
}

function RevenueChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

export function RevenueChart({ dateRange }: RevenueChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchRevenueData();
    }

    const channel = supabase
      .channel('revenue-chart')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchRevenueData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange, currentOrganization?.id]);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      
      if (!currentOrganization?.id) return;

      // Get last 12 months
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const date = startOfMonth(subMonths(new Date(), i));
        months.push({
          date,
          label: format(date, 'MMM/yy', { locale: ptBR }),
          month: format(date, 'yyyy-MM'),
        });
      }

      const { data: transactions } = await (supabase as any)
        .from('transactions')
        .select('amount, purchase_date, created_at')
        .eq('organization_id', currentOrganization.id)
        .gte('purchase_date', format(months[0].date, 'yyyy-MM-dd'));

      const revenueByMonth = months.map(({ label, month }) => {
        const monthRevenue = transactions
          ?.filter(t => {
            const dateStr = t.purchase_date || t.created_at;
            return format(parseISO(dateStr), 'yyyy-MM') === month;
          })
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        return {
          month: label,
          receita: monthRevenue,
        };
      });

      setData(revenueByMonth);
    } catch (error) {
      console.error('Error fetching revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <RevenueChartSkeleton />;
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Receita por Mês
        </CardTitle>
        <CardDescription>Últimos 12 meses</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            receita: {
              label: "Receita",
              color: "hsl(var(--primary))",
            },
          }}
          className="h-[300px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                width={60}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                cursor={{ fill: 'hsl(var(--muted))' }}
              />
              <Bar 
                dataKey="receita" 
                fill="var(--color-receita)" 
                radius={[8, 8, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
