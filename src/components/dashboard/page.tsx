
// src/components/dashboard/page.tsx
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { DateRange } from 'react-day-picker';
import { subDays, startOfDay } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Loader2 } from 'lucide-react';

const ChartSkeleton = () => (
  <div className="h-[300px] w-full animate-pulse bg-muted rounded-md flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

const AIPerformanceSection = dynamic(
  () => import('@/components/dashboard/ai-performance-section').then(mod => mod.AIPerformanceSection),
  {
    ssr: false,
    loading: ChartSkeleton
  }
);

const StatsCards = dynamic(
  () => import('@/components/analytics/stats-cards').then(mod => mod.StatsCards),
  { ssr: false, loading: ChartSkeleton }
);

const AttendanceTrendChart = dynamic(
  () => import('@/components/analytics/attendance-trend-chart').then(mod => mod.AttendanceTrendChart),
  { ssr: false, loading: ChartSkeleton }
);

const CampaignPerformanceChart = dynamic(
  () => import('@/components/analytics/campaign-performance-chart').then(mod => mod.CampaignPerformanceChart),
  { ssr: false, loading: ChartSkeleton }
);


export default function DashboardClient() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(new Date(), 29)),
    to: new Date(),
  });

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 pb-20 md:pb-6">
      <div className="col-span-full flex items-center justify-between w-full">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <div className="hidden sm:block">
          <DateRangePicker onDateChange={setDateRange} initialDate={dateRange} />
        </div>
      </div>

      <div className="col-span-full">
        <StatsCards dateRange={dateRange} />
      </div>

      <Card className="col-span-full lg:col-span-8 card-glow-hover bg-card/60 backdrop-blur-2xl border-white/[0.05] shadow-2xl rounded-2xl relative overflow-hidden flex flex-col" onMouseMove={handleCardMouseMove}>
        <CardHeader>
          <CardTitle className="text-lg font-bold">Tendência de Atendimentos</CardTitle>
          <CardDescription>Atendimentos iniciados vs. resolvidos no período.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-[300px]">
          <AttendanceTrendChart dateRange={dateRange} />
        </CardContent>
      </Card>

      <Card className="col-span-full lg:col-span-4 card-glow-hover bg-card/60 backdrop-blur-2xl border-white/[0.05] shadow-2xl rounded-2xl relative overflow-hidden flex flex-col" onMouseMove={handleCardMouseMove}>
        <CardHeader>
          <CardTitle className="text-lg font-bold">Desempenho das Campanhas</CardTitle>
          <CardDescription>
            Comparativo de mensagens enviadas vs. lidas nas últimas campanhas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-[300px]">
          <CampaignPerformanceChart />
        </CardContent>
      </Card>

      <div className="col-span-full card-glow-hover bg-card/60 backdrop-blur-2xl border border-white/[0.05] shadow-2xl rounded-2xl relative overflow-hidden p-6" onMouseMove={handleCardMouseMove}>
        <AIPerformanceSection />
      </div>
    </div>
  );
}
