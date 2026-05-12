import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/AppShell";
import PagePermissionGuard from "@/components/PagePermissionGuard";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import SalesIntelligencePanel from "@/components/dashboard/SalesIntelligencePanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  Save, Users, Target, DollarSign, BarChart3, Calculator,
  RefreshCw, TrendingUp, TrendingDown, Calendar, ArrowRight,
  Eye, Pencil, ChevronLeft, ChevronRight, Zap, AlertTriangle,
  CheckCircle2, XCircle, Phone, HandCoins, PieChart as PieChartIcon, ArrowDownRight, Megaphone, Leaf,
  Activity, ShieldCheck, Lightbulb, ArrowUpRight
} from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, LineChart, Line, Legend, AreaChart, Area, RadialBarChart, RadialBar,
  FunnelChart, Funnel, LabelList, PieChart, Pie, Cell
} from "recharts";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserCheck, UserX, Clock, Star } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CloserPerformanceTab from "@/components/diagnostics/CloserPerformanceTab";
import type { DiagnosticData, EnrichedMonthData, CloserStats, AdSegmentedData, HealthScore } from "./diagnostics/types";
import { LOSS_LABELS, STATUS_COLORS, PLATFORMS, fmt, getMonthName, getMonthShort } from "./diagnostics/utils";
import { useDiagnosticMetrics } from "./diagnostics/hooks/useDiagnosticMetrics";
import { FunnelStep } from "./diagnostics/components/FunnelStep";
import { SourcesTabContent } from "./diagnostics/components/SourcesTabContent";
import { EnrichedDataCards } from "./diagnostics/components/EnrichedDataCards";
import { OverviewCards } from "./diagnostics/components/OverviewCards";
import { FunnelAndAccounting } from "./diagnostics/components/FunnelAndAccounting";
import { CampaignsAndFinancials } from "./diagnostics/components/CampaignsAndFinancials";
import { TrendAndSummary } from "./diagnostics/components/TrendAndSummary";

export default function DiagnosticoLeads() {
  const {
    currentOrganization, loading, syncing, saving,
    data, selectedYear, setSelectedYear, selectedMonthIdx, setSelectedMonthIdx,
    editMode, setEditMode, enrichedData,
    lifetimeMode, setLifetimeMode, trueLifetimeMode, setTrueLifetimeMode,
    orgFunnels, selectedFunnelId, setSelectedFunnelId,
    funnelStageData, campaignList, orgUsers, commissions, savingCommission, saveCommission,
    adSegmented, lifetimeAdSegmented, months, lifetimeData, selectedData, prevMonthData,
    selectedEnriched, healthScore, smartAlerts, projection, fetchTrueLifetime,
    syncAllMonths, updateField, saveAll, currentAdSeg, trendData, totals
  } = useDiagnosticMetrics();

  const d = selectedData;
  const p = prevMonthData;
  if (loading) {
    return (
      <AppShell>
        <div className="p-6 space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="grid grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-80" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PagePermissionGuard page="dashboard">
        <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Diagnóstico de Leads</h1>
              <p className="text-xs text-muted-foreground">Análise completa do funil de vendas com dados reais da plataforma</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant={trueLifetimeMode ? "default" : "outline"} size="sm" onClick={() => { setTrueLifetimeMode(!trueLifetimeMode); setLifetimeMode(false); }}>
                🏠 Vitalício
              </Button>
              <Button variant={lifetimeMode && !trueLifetimeMode ? "default" : "outline"} size="sm" onClick={() => { setLifetimeMode(!lifetimeMode); setTrueLifetimeMode(false); }}>
                📊 Ano {selectedYear}
              </Button>
              <Button variant="outline" size="sm" onClick={syncAllMonths} disabled={syncing}>
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", syncing && "animate-spin")} />
                Sync
              </Button>
              <Button size="sm" onClick={saveAll} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Salvar
              </Button>
            </div>
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedYear(y => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Badge variant="secondary" className="text-sm font-bold px-3">{selectedYear}</Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedYear(y => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Month Selector */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {months.map((m, idx) => {
              const monthData = data[idx];
              const hasData = monthData && (monthData.total_leads > 0 || monthData.ad_spend > 0);
              return (
                <button
                  key={m}
                  onClick={() => { setSelectedMonthIdx(idx); setLifetimeMode(false); setTrueLifetimeMode(false); }}
                  className={cn(
                    "flex flex-col items-center px-3 py-2 rounded-lg text-xs border transition-all min-w-[52px]",
                    idx === selectedMonthIdx && !lifetimeMode && !trueLifetimeMode
                      ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                      : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                  )}
                >
                  <span className="font-bold">{getMonthShort(m)}</span>
                  {hasData && <span className="text-[10px] opacity-80 mt-0.5">{monthData.total_leads}L</span>}
                </button>
              );
            })}
          </div>

          {/* Month Detail View */}
          <Tabs defaultValue="overview" className="w-full space-y-6">
            <TabsList className="bg-muted/50 p-1 w-full max-w-lg mx-auto flex mb-4">
              <TabsTrigger value="overview" className="flex-1">Visão Geral</TabsTrigger>
              <TabsTrigger value="sources" className="flex-1">Origem dos Leads</TabsTrigger>
              <TabsTrigger value="agents" className="flex-1">Agentes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-0 border-none p-0 outline-none">
              <OverviewCards
                d={d}
                p={p as any}
                currentAdSeg={currentAdSeg as any}
                healthScore={healthScore as any}
                smartAlerts={smartAlerts as any[]}
                projection={projection as any}
                lifetimeMode={lifetimeMode}
                trueLifetimeMode={trueLifetimeMode}
                selectedYear={selectedYear as any}
                editMode={editMode}
                setEditMode={setEditMode}
                getMonthName={getMonthName as any}
                fmt={fmt}
              />

              <FunnelAndAccounting
                d={d}
                selectedEnriched={selectedEnriched}
                editMode={editMode}
                updateField={updateField}
                orgUsers={orgUsers as any[]}
                healthScore={healthScore as any}
                fmt={fmt}
              />

              <CampaignsAndFinancials
                d={d}
                campaignList={campaignList as any[]}
                fmt={fmt}
              />

              {/* Enriched Data */}
              {selectedEnriched && (
                <EnrichedDataCards
                  d={d}
                  selectedEnriched={selectedEnriched}
                  orgUsers={orgUsers}
                  commissions={commissions as any}
                  setCommissions={setCommissions as any}
                  saveCommission={saveCommission}
                  savingCommission={savingCommission}
                  fmt={fmt}
                />
              )}

              <TrendAndSummary
                selectedYear={selectedYear as any}
                orgFunnels={orgFunnels}
                selectedFunnelId={selectedFunnelId}
                setSelectedFunnelId={setSelectedFunnelId}
                funnelStageData={funnelStageData}
                trendData={trendData as any[]}
                totals={totals}
                fmt={fmt}
              />

              {/* Inteligência Comercial com IA */}
              <SalesIntelligencePanel orgId={currentOrganization?.id} />
            </TabsContent>

            <TabsContent value="sources" className="space-y-4 mt-0 border-none p-0 outline-none">
              <SourcesTabContent
                currentAdSeg={currentAdSeg as any}
                trendData={trendData as any[]}
                d={d}
                fmt={fmt}
              />
            </TabsContent>

            <TabsContent value="agents" className="mt-0 border-none p-0 outline-none">
              <CloserPerformanceTab
                organizationId={currentOrganization?.id || ''}
                selectedMonth={months[selectedMonthIdx]}
              />
            </TabsContent>
          </Tabs>
        </div>
      </PagePermissionGuard>
    </AppShell>
  );
}
