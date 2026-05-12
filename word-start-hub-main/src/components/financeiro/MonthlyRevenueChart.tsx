import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { format, parseISO, eachDayOfInterval, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { useOrganization } from "@/contexts/OrganizationContext";
import { TrendingUp } from "lucide-react";

interface MonthlyRevenueChartProps {
  dateRange: DateRange;
}

function MonthlyRevenueChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        <div className="h-4 w-48 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

export function MonthlyRevenueChart({ dateRange }: MonthlyRevenueChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchRevenueData();
    }

    const channel = supabase
      .channel('monthly-revenue-chart')
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

      if (!dateRange.from || !dateRange.to) {
        setData([]);
        return;
      }

      // Get all days in the selected range
      const days = eachDayOfInterval({
        start: startOfDay(dateRange.from),
        end: startOfDay(dateRange.to),
      });

      const { data: transactions } = await (supabase as any)
        .from('transactions')
        .select('amount, purchase_date, created_at')
        .eq('organization_id', currentOrganization.id)
        .gte('purchase_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('purchase_date', format(dateRange.to, 'yyyy-MM-dd'));

      let accumulated = 0;
      const revenueByDay = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayRevenue = transactions
          ?.filter(t => {
            const dateStr = t.purchase_date || t.created_at;
            return format(parseISO(dateStr), 'yyyy-MM-dd') === dayStr;
          })
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        accumulated += dayRevenue;

        return {
          day: format(day, 'dd/MM', { locale: ptBR }),
          receita: dayRevenue,
          acumulado: accumulated,
        };
      });

      setData(revenueByDay);
    } catch (error) {
      console.error('Error fetching monthly revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm">{label}</p>
          <p className="text-sm text-primary">
            Dia: R$ {payload[0]?.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-muted-foreground">
            Acumulado: R$ {payload[1]?.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <MonthlyRevenueChartSkeleton />;
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Receita do Período
        </CardTitle>
        <CardDescription>
          {dateRange.from && dateRange.to
            ? `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`
            : 'Selecione um período'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            receita: {
              label: "Receita Diária",
              color: "hsl(var(--primary))",
            },
            acumulado: {
              label: "Acumulado",
              color: "hsl(var(--chart-2))",
            },
          }}
          className="h-[300px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 10 }}
                interval={Math.max(Math.floor(data.length / 8), 0)}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                width={60}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="receita" 
                stroke="hsl(var(--primary))" 
                fillOpacity={1}
                fill="url(#colorReceita)"
                strokeWidth={2}
              />
              <Area 
                type="monotone" 
                dataKey="acumulado" 
                stroke="hsl(var(--chart-2))" 
                fillOpacity={1}
                fill="url(#colorAcumulado)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
