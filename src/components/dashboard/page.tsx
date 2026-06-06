
// src/components/dashboard/page.tsx
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { DateRange } from 'react-day-picker';
import { subDays, startOfDay } from 'date-fns';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/contexts/session-context';

// ─── Skeleton ──────────────────────────────────────────────────────────────
const ChartSkeleton = () => (
  <div className="h-full min-h-[180px] w-full rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 animate-pulse flex items-center justify-center">
    <Loader2 className="h-5 w-5 animate-spin text-zinc-400 dark:text-zinc-700" />
  </div>
);

// ─── Dynamic imports ────────────────────────────────────────────────────────
const QuickActionsBar = dynamic(
  () => import('@/components/dashboard/quick-actions-widget').then(m => m.QuickActionsBar),
  { ssr: false }
);

const DashboardInsightsWidget = dynamic(
  () => import('@/components/dashboard/insights-widget').then(m => m.DashboardInsightsWidget),
  { ssr: false, loading: () => <div className="h-16 animate-pulse rounded-2xl bg-black/[0.02] dark:bg-white/[0.02]" /> }
);

const StatsCards = dynamic(
  () => import('@/components/analytics/stats-cards').then(m => m.StatsCards),
  { ssr: false, loading: () => <div className="h-28 animate-pulse rounded-2xl bg-black/[0.02] dark:bg-white/[0.02]" /> }
);

const AttendanceTrendChart = dynamic(
  () => import('@/components/analytics/attendance-trend-chart').then(m => m.AttendanceTrendChart),
  { ssr: false, loading: ChartSkeleton }
);

const CampaignsWithPerformance = dynamic(
  () => import('@/components/dashboard/campaigns-with-performance').then(m => m.CampaignsWithPerformance),
  { ssr: false, loading: ChartSkeleton }
);

const ActiveAutomationsWidget = dynamic(
  () => import('@/components/dashboard/active-automations-widget').then(m => m.ActiveAutomationsWidget),
  { ssr: false, loading: ChartSkeleton }
);

const AIPerformanceSection = dynamic(
  () => import('@/components/dashboard/ai-performance-section').then(m => m.AIPerformanceSection),
  { ssr: false, loading: ChartSkeleton }
);

const LeadsByUserWidget = dynamic(
  () => import('@/components/dashboard/leads-by-user-widget').then(m => m.LeadsByUserWidget),
  { ssr: false, loading: ChartSkeleton }
);

const TrafficOverviewWidget = dynamic(
  () => import('@/components/dashboard/traffic-overview-widget').then(m => m.TrafficOverviewWidget),
  { ssr: false, loading: ChartSkeleton }
);

// ─── Greeting ───────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ─── Main ───────────────────────────────────────────────────────────────────
export default function DashboardClient() {
  const { session } = useSession();
  const userName = session?.userData?.name ? session.userData.name.split(' ')[0] : '';

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(new Date(), 29)),
    to: new Date(),
  });

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-8 font-outfit">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-slide-up stagger-1">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-glow-pulse" />
            <div className="absolute inset-0 rounded-full bg-emerald-400/40 blur-sm" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground dark:text-white leading-none">
              {getGreeting()}{userName ? `, ${userName}` : ''}<span className="text-emerald-500 dark:text-emerald-400">!</span>
            </h1>
            <p className="text-sm text-muted-foreground dark:text-zinc-500 mt-1">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        <div className="animate-fade-in stagger-2">
          <DateRangePicker onDateChange={setDateRange} initialDate={dateRange} />
        </div>
      </div>

      {/* ── 1. QUICK ACTIONS (full width, acima dos KPIs) ── */}
      <QuickActionsBar />

      {/* ── 2. INSIGHTS SEMANAIS ── */}
      <DashboardInsightsWidget />

      {/* ── 3. KPI BAR (6 cards — ícone verde, texto branco) ── */}
      <div className="animate-fade-slide-up stagger-3">
        <StatsCards dateRange={dateRange} />
      </div>

      {/* ── 4. ATENDIMENTOS + CAMPANHAS (8+4) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Attendance trend chart */}
        <div className="lg:col-span-8 glass-card p-6 flex flex-col gap-3 animate-fade-slide-up stagger-4">
          <div>
            <p className="label-kpi">Atendimentos</p>
            <h2 className="text-lg font-bold text-foreground dark:text-white mt-0.5">Tendência no Período</h2>
            <p className="text-xs text-muted-foreground dark:text-zinc-500">Iniciados vs. resolvidos por dia</p>
          </div>
          <div className="flex-1 min-h-[240px]">
            <AttendanceTrendChart dateRange={dateRange} />
          </div>
        </div>

        {/* Campaigns unified (list + chart) */}
        <div className="lg:col-span-4">
          <CampaignsWithPerformance dateRange={dateRange} />
        </div>
      </div>

      {/* ── 5. AUTOMAÇÕES (fullwidth) ── */}
      <div className="animate-fade-slide-up stagger-5">
        <ActiveAutomationsWidget />
      </div>

      {/* ── 6. LEADS POR USUÁRIO (full width) ── */}
      <LeadsByUserWidget dateRange={dateRange} />

      {/* ── 7. AGENTES IA (4 KPIs apenas) ── */}
      <div className="glass-card p-6 animate-fade-slide-up stagger-7">
        <AIPerformanceSection />
      </div>

      {/* ── 8. TRÁFEGO PAGO (2 colunas) ── */}
      <TrafficOverviewWidget dateRange={dateRange} />

    </div>
  );
}
