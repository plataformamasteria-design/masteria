// src/app/(main)/dashboard/loading.tsx
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <PageHeader
        title="Dashboard"
        description="Bem-vindo de volta! Aqui está uma visão geral da sua conta."
      >
        <Skeleton className="h-10 w-[300px]" />
      </PageHeader>
      
      {/* StatsCards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>

      {/* Main Charts Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Skeleton className="lg:col-span-3 h-[350px]" />
        <Skeleton className="lg:col-span-2 h-[350px]" />
      </div>

      {/* Secondary Charts Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-[350px]" />
        <Skeleton className="lg:col-span-1 h-[350px]" />
      </div>

      {/* Bottom Cards Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
