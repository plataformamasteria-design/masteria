import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Users, Target, TrendingDown, Percent } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cn } from "@/lib/utils";

interface FinancialSummaryProps {
  dateRange: DateRange;
}

interface SummaryData {
  totalRevenue: number;
  periodRevenue: number;
  averageTicket: number;
  totalClients: number;
  totalTransactions: number;
  previousPeriodRevenue: number;
}

function SummaryCardSkeleton() {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-32 bg-muted animate-pulse rounded mb-2" />
        <div className="h-3 w-20 bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

export function FinancialSummary({ dateRange }: FinancialSummaryProps) {
  const [data, setData] = useState<SummaryData>({
    totalRevenue: 0,
    periodRevenue: 0,
    averageTicket: 0,
    totalClients: 0,
    totalTransactions: 0,
    previousPeriodRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchSummary();
    }

    const channel = supabase
      .channel('financial-summary')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchSummary)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, fetchSummary)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange, currentOrganization?.id]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      
      if (!currentOrganization?.id) return;

      // Total revenue (all time)
      const { data: totalData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('organization_id', currentOrganization.id);
      const totalRevenue = totalData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // Period revenue
      const periodStart = dateRange.from || startOfMonth(new Date());
      const periodEnd = dateRange.to || endOfMonth(new Date());
      
      const { data: periodData } = await supabase
        .from('transactions')
        .select('amount, chat_id')
        .eq('organization_id', currentOrganization.id)
        .gte('purchase_date', format(periodStart, 'yyyy-MM-dd'))
        .lte('purchase_date', format(periodEnd, 'yyyy-MM-dd'));
      
      const periodRevenue = periodData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalTransactions = periodData?.length || 0;

      // Previous period revenue (for comparison)
      const periodDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
      const prevPeriodEnd = new Date(periodStart);
      prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);
      const prevPeriodStart = new Date(prevPeriodEnd);
      prevPeriodStart.setDate(prevPeriodStart.getDate() - periodDays);
      
      const { data: prevPeriodData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('organization_id', currentOrganization.id)
        .gte('purchase_date', format(prevPeriodStart, 'yyyy-MM-dd'))
        .lte('purchase_date', format(prevPeriodEnd, 'yyyy-MM-dd'));
      const previousPeriodRevenue = prevPeriodData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // Total clients from clients table
      const { count: clientCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id);
      const totalClients = clientCount || 0;

      // Average ticket based on period transactions
      const averageTicket = totalTransactions > 0 ? periodRevenue / totalTransactions : 0;

      setData({
        totalRevenue,
        periodRevenue,
        averageTicket,
        totalClients,
        totalTransactions,
        previousPeriodRevenue,
      });
    } catch (error) {
      console.error('Error fetching financial summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const periodChange = data.previousPeriodRevenue > 0
    ? ((data.periodRevenue - data.previousPeriodRevenue) / data.previousPeriodRevenue) * 100
    : data.periodRevenue > 0 ? 100 : 0;

  const cards = [
    {
      title: "Receita Total",
      value: data.totalRevenue,
      icon: DollarSign,
      description: "Acumulado geral",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Receita do Período",
      value: data.periodRevenue,
      icon: periodChange >= 0 ? TrendingUp : TrendingDown,
      description: `${periodChange >= 0 ? '+' : ''}${periodChange.toFixed(1)}% vs período anterior`,
      color: periodChange >= 0 ? "text-green-500" : "text-red-500",
      bgColor: periodChange >= 0 ? "bg-green-500/10" : "bg-red-500/10",
    },
    {
      title: "Ticket Médio",
      value: data.averageTicket,
      icon: Target,
      description: `${data.totalTransactions} transações no período`,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Total de Clientes",
      value: data.totalClients,
      icon: Users,
      description: "Clientes cadastrados",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      isCount: true,
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SummaryCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <Card 
          key={card.title} 
          className="relative overflow-hidden hover:shadow-lg transition-all duration-300 animate-fade-in"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={cn("p-2 rounded-lg", card.bgColor)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {card.isCount ? (
                card.value.toLocaleString('pt-BR')
              ) : (
                `R$ ${card.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
