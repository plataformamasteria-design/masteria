import { useEffect, useState, useRef, useCallback } from "react";
import { supabase as supabaseOriginal } from "@/integrations/supabase/client";
const supabase = supabaseOriginal as any;
import AppShell from "@/components/AppShell";
import PagePermissionGuard from "@/components/PagePermissionGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Bot, TrendingUp, DollarSign, Target, RefreshCw, AlertCircle, UserPlus, MessageSquare, Heart, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import FunnelVisualization from "@/components/pipeline/FunnelVisualization";
import AgentPerformanceAnalysis from "@/components/dashboard/AgentPerformanceAnalysis";
import WeeklyAttendanceChart from "@/components/dashboard/WeeklyAttendanceChart";
import BillingAlertsWidget from "@/components/dashboard/BillingAlertsWidget";
import AgendaAlertsWidget from "@/components/dashboard/AgendaAlertsWidget";
import FinancialWidget from "@/components/dashboard/FinancialWidget";
import CRMPipelineWidget from "@/components/dashboard/CRMPipelineWidget";
import TagDistributionWidget from "@/components/dashboard/TagDistributionWidget";
import TeamPerformanceWidget from "@/components/dashboard/TeamPerformanceWidget";
import ChatMetricsWidget from "@/components/dashboard/ChatMetricsWidget";
import RevenueOverviewWidget from "@/components/dashboard/RevenueOverviewWidget";
import SalesFunnelWidget from "@/components/dashboard/SalesFunnelWidget";
import CloserRankingWidget from "@/components/dashboard/CloserRankingWidget";
import TrendWidget from "@/components/dashboard/TrendWidget";
import FinancialForecastWidget from "@/components/dashboard/FinancialForecastWidget";
import ActivityGoalsWidget from "@/components/dashboard/ActivityGoalsWidget";
import { useOrganization } from "@/contexts/OrganizationContext";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { useTranslation } from "react-i18next";

interface Funnel {
  id: string;
  name: string;
  visualization_type: "funnel" | "pie" | "bar" | "kanban";
  tag_order: string[];
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Stats {
  totalLeads: number;
  newLeads7d: number;
  activeConversations: number;
  clientes: number;
  activeRobots: number;
  conversionRate: number;
  totalRevenue: number;
  averageTicket: number;
  pendingTasks: number;
}

const Dashboard = () => {
  console.log("Vite Force Flush - UI Rendered");
  const { t } = useTranslation();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date()
  });
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0, newLeads7d: 0, activeConversations: 0, clientes: 0,
    activeRobots: 0, conversionRate: 0, totalRevenue: 0, averageTicket: 0, pendingTasks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentOrganization } = useOrganization();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchFunnels = useCallback(async () => {
    let query = supabase.from("funnels").select("*");
    if (currentOrganization?.id) query = query.eq('organization_id', currentOrganization.id);
    const { data } = await query.order("created_at", { ascending: false });
    setFunnels((data || []) as Funnel[]);
  }, [currentOrganization?.id]);

  const fetchTags = useCallback(async () => {
    let query = supabase.from("tags").select("*");
    if (currentOrganization?.id) query = query.eq('organization_id', currentOrganization.id);
    const { data } = await query.order("order_position", { ascending: true });
    setTags(data || []);
  }, [currentOrganization?.id]);

  const calculateStats = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const orgFilter = currentOrganization?.id ? { organization_id: currentOrganization.id } : {};
      const startDate = dateRange?.from ? startOfDay(dateRange.from).toISOString() : null;
      const endDate = dateRange?.to ? endOfDay(dateRange.to).toISOString() : null;

      let totalLeadsQuery = supabase.from("chats").select("*", { count: "exact", head: true }).match(orgFilter);
      if (startDate) totalLeadsQuery = totalLeadsQuery.gte("created_at", startDate);
      if (endDate) totalLeadsQuery = totalLeadsQuery.lte("created_at", endDate);
      const { count: totalLeads } = await totalLeadsQuery;

      let newLeadsQuery = supabase.from("chats").select("*", { count: "exact", head: true }).match(orgFilter);
      if (startDate) newLeadsQuery = newLeadsQuery.gte("created_at", startDate);
      if (endDate) newLeadsQuery = newLeadsQuery.lte("created_at", endDate);
      const { count: newLeads7d } = await newLeadsQuery;

      let messagesQuery = supabase.from("messages").select("chat_id");
      if (startDate) messagesQuery = messagesQuery.gte("created_at", startDate);
      if (endDate) messagesQuery = messagesQuery.lte("created_at", endDate);
      if (currentOrganization?.id) messagesQuery = messagesQuery.eq('organization_id', currentOrganization.id);
      const { data: activeChats } = await messagesQuery;
      const activeConversations = new Set(activeChats?.map(m => m.chat_id)).size;

      let tagsQuery = supabase.from("tags").select("id").ilike("name", "%cliente%");
      if (currentOrganization?.id) tagsQuery = tagsQuery.eq('organization_id', currentOrganization.id);
      const { data: clienteTags } = await tagsQuery;
      let clientes = 0;
      if (clienteTags && clienteTags.length > 0) {
        let chatTagsQuery = supabase.from("chat_tags").select("*", { count: "exact", head: true }).in("tag_id", clienteTags.map(t => t.id));
        if (currentOrganization?.id) chatTagsQuery = chatTagsQuery.eq('organization_id', currentOrganization.id);
        if (startDate) chatTagsQuery = chatTagsQuery.gte("assigned_at", startDate);
        if (endDate) chatTagsQuery = chatTagsQuery.lte("assigned_at", endDate);
        const { count } = await chatTagsQuery;
        clientes = count || 0;
      }

      const { count: activeRobots } = await supabase.from("chats").select("*", { count: "exact", head: true }).match(orgFilter).eq("agent_off", false);
      const conversionRate = (totalLeads || 0) > 0 ? (clientes / (totalLeads || 1)) * 100 : 0;

      let transactionsQuery = supabase.from("transactions").select("amount");
      if (currentOrganization?.id) transactionsQuery = transactionsQuery.eq('organization_id', currentOrganization.id);
      if (startDate) transactionsQuery = transactionsQuery.gte("created_at", startDate);
      if (endDate) transactionsQuery = transactionsQuery.lte("created_at", endDate);
      const { data: transactions } = await transactionsQuery;
      const totalRevenue = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const averageTicket = transactions && transactions.length > 0 ? totalRevenue / transactions.length : 0;

      let tasksQuery = supabase.from("tasks").select("*", { count: "exact", head: true }).eq("completed", false);
      if (currentOrganization?.id) tasksQuery = tasksQuery.eq('organization_id', currentOrganization.id);
      const { count: pendingTasks } = await tasksQuery;

      setStats({
        totalLeads: totalLeads || 0, newLeads7d: newLeads7d || 0, activeConversations, clientes,
        activeRobots: activeRobots || 0, conversionRate: Number(conversionRate.toFixed(1)),
        totalRevenue, averageTicket, pendingTasks: pendingTasks || 0,
      });
    } catch (error) {
      console.error("Error calculating stats:", error);
      setError(t('dashboard.errorLoading'));
    } finally {
      setLoading(false);
      setIsFirstLoad(false);
    }
  }, [currentOrganization?.id, dateRange, t]);

  const debouncedCalculateStats = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { calculateStats(false); }, 500);
  }, [calculateStats]);

  const handleRefresh = useCallback(() => { calculateStats(true); }, [calculateStats]);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    fetchFunnels(); fetchTags(); calculateStats(true);
    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, debouncedCalculateStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, debouncedCalculateStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_tags' }, debouncedCalculateStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, debouncedCalculateStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, debouncedCalculateStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_resolutions' }, debouncedCalculateStats)
      .subscribe();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); supabase.removeChannel(channel); };
  }, [currentOrganization?.id, fetchFunnels, fetchTags, calculateStats, debouncedCalculateStats]);

  const statCards = [
    { title: t('dashboard.totalLeads'), value: stats.totalLeads.toString(), icon: Users, description: t('dashboard.inSelectedPeriod'), color: "text-blue-600" },
    { title: t('dashboard.newLeads'), value: stats.newLeads7d.toString(), icon: UserPlus, description: t('dashboard.inSelectedPeriod'), color: "text-cyan-600" },
    { title: t('dashboard.activeConversations'), value: stats.activeConversations.toString(), icon: MessageSquare, description: t('dashboard.inSelectedPeriod'), color: "text-violet-600" },
    { title: t('dashboard.clients'), value: stats.clientes.toString(), icon: Heart, description: t('dashboard.convertedInPeriod'), color: "text-green-600" },
    { title: t('dashboard.activeRobots'), value: stats.activeRobots.toString(), icon: Bot, description: t('dashboard.currentState'), color: "text-emerald-600" },
    { title: t('dashboard.conversionRate'), value: `${stats.conversionRate}%`, icon: TrendingUp, description: t('dashboard.leadsToClients'), color: "text-purple-600" },
    { title: t('dashboard.totalRevenue'), value: `R$ ${stats.totalRevenue.toLocaleString('pt-BR')}`, icon: DollarSign, description: t('dashboard.inSelectedPeriod'), color: "text-amber-600" },
    { title: t('dashboard.averageTicket'), value: `R$ ${stats.averageTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, icon: Target, description: t('dashboard.perTransaction'), color: "text-orange-600" },
    { title: t('dashboard.pendingTasks'), value: stats.pendingTasks.toString(), icon: ListTodo, description: t('dashboard.currentState'), color: "text-indigo-600" }
  ];

  const showSkeleton = loading && isFirstLoad;

  const iconColors = [
    'bg-blue-500/20 text-blue-500', 'bg-cyan-500/20 text-cyan-500',
    'bg-violet-500/20 text-violet-500', 'bg-green-500/20 text-green-500',
    'bg-emerald-500/20 text-emerald-500', 'bg-purple-500/20 text-purple-500',
    'bg-amber-500/20 text-amber-500', 'bg-orange-500/20 text-orange-500',
    'bg-indigo-500/20 text-indigo-500',
  ];

  const glowColors = [
    'group-hover:shadow-blue-500/20', 'group-hover:shadow-cyan-500/20',
    'group-hover:shadow-violet-500/20', 'group-hover:shadow-green-500/20',
    'group-hover:shadow-emerald-500/20', 'group-hover:shadow-purple-500/20',
    'shadow-amber-500/10 group-hover:shadow-amber-500/30', 'shadow-orange-500/10 group-hover:shadow-orange-500/30',
    'group-hover:shadow-indigo-500/20',
  ];

  return (
    <AppShell>
      <PagePermissionGuard page="dashboard">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight gradient-text">{t('dashboard.title')}</h1>
              <p className="text-muted-foreground text-sm md:text-base mt-1">{t('dashboard.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
              <Button onClick={handleRefresh} disabled={loading} size="sm" className="w-fit">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                <span className="ml-2 hidden sm:inline">{t('dashboard.refresh')}</span>
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="glass border-destructive/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {/* 1. COMPACT KPI HEADER BAR */}
          <div className="flex overflow-x-auto gap-3 w-full bg-card/40 backdrop-blur-xl rounded-2xl border border-white/5 p-2 shadow-sm relative custom-scrollbar">
            {statCards.map((card, idx) => (
              <div key={idx} className="flex-shrink-0 min-w-[140px] md:min-w-[160px] flex flex-col gap-0.5 relative group px-3 border-r border-white/5 last:border-0 hover:bg-white/5 rounded-lg transition-colors py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <card.icon className={cn("w-3.5 h-3.5 shrink-0", card.color)} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{card.title}</span>
                </div>
                {showSkeleton ? (
                  <Skeleton className="h-7 w-20 bg-white/5" />
                ) : (
                  <span className="text-xl md:text-2xl font-black tracking-tighter truncate leading-none text-foreground/90">{card.value}</span>
                )}
                <span className="text-[9px] text-muted-foreground/60 hidden xl:block truncate mt-1.5 font-medium">{card.description}</span>
              </div>
            ))}
          </div>

          {/* 2. BENTO GRID: Financials & Primary Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* Left Column: Financial Consolidation (Span 3) */}
            <div className="xl:col-span-3 flex flex-col gap-4">
              <RevenueOverviewWidget startDate={dateRange?.from} endDate={dateRange?.to} />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
                <FinancialForecastWidget />
                <FinancialWidget dateRange={dateRange} />
              </div>
            </div>

            {/* Middle Column: Funnel & Alerts (Span 6) */}
            <div className="xl:col-span-6 flex flex-col gap-4">
              <SalesFunnelWidget startDate={dateRange?.from} endDate={dateRange?.to} />
              {funnels.length > 0 && (
                <Card className="glass overflow-hidden h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground uppercase">{funnels[0].name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FunnelVisualization funnel={funnels[0]} tags={tags} dateRange={dateRange} />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Trends & Alerts (Span 3) */}
            <div className="xl:col-span-3 flex flex-col gap-4">
              <TrendWidget />
              <BillingAlertsWidget />
              <AgendaAlertsWidget />
            </div>
          </div>

          {/* 3. TABBED DATA MODULES FOR WIDGETS */}
          <Card className="glass overflow-hidden rounded-2xl border-white/5 mt-2">
            <div className="p-4 md:p-6 pb-2">
              <Tabs defaultValue="rankings" className="w-full">
                <TabsList className="bg-transparent border-b border-white/10 w-full justify-start overflow-auto h-auto p-0 pb-3 rounded-none mb-4 gap-6 custom-scrollbar">
                  <TabsTrigger value="rankings" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:text-primary">Efetividade & Closers</TabsTrigger>
                  <TabsTrigger value="operations" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:text-primary">Operação & Equipe</TabsTrigger>
                </TabsList>

                {/* Tab 1: Rankings & Conversão */}
                <TabsContent value="rankings" className="mt-0 pt-2 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-6 outline-none">
                  <CloserRankingWidget startDate={dateRange?.from} endDate={dateRange?.to} />
                  <TeamPerformanceWidget dateRange={dateRange} />
                  <AgentPerformanceAnalysis dateRange={dateRange} />
                </TabsContent>

                {/* Tab 2: Operação & Atendimentos */}
                <TabsContent value="operations" className="mt-0 pt-2 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-6 outline-none">
                  <CRMPipelineWidget />
                  <ChatMetricsWidget dateRange={dateRange} />
                  <div className="grid grid-cols-1 gap-4 xl:gap-6">
                    <WeeklyAttendanceChart dateRange={dateRange} />
                    <ActivityGoalsWidget />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </Card>
        </div>
      </PagePermissionGuard>
    </AppShell>
  );
};

export default Dashboard;
