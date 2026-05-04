'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  trend?: 'up' | 'down';
  loading?: boolean;
  className?: string;
}

export function KPICard({
  title,
  value,
  change,
  icon: Icon,
  trend,
  loading = false,
  className,
}: KPICardProps) {
  const getTrendBadgeVariant = () => {
    if (!trend) return 'secondary';
    return trend === 'up' ? 'default' : 'destructive';
  };

  return (
    <Card className={cn('transition-all duration-300 hover:shadow-lg', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold animate-in fade-in-50 duration-300">
              {value}
            </div>
            {change !== undefined && (
              <div className="mt-2 flex items-center gap-1">
                <Badge variant={getTrendBadgeVariant()} className="text-xs">
                  <span className="flex items-center gap-1">
                    {trend === 'up' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : trend === 'down' ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : null}
                    {Math.abs(change)}%
                  </span>
                </Badge>
                <span className="text-xs text-muted-foreground">vs período anterior</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
