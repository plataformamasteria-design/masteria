
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '../ui/badge';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import type { DateRange } from 'react-day-picker';

type AgentPerformanceData = {
    id: string;
    name: string;
    resolved: number;
    avatarUrl?: string | null;
}

interface AgentPerformanceTableProps {
    dateRange?: DateRange;
}

export function AgentPerformanceTable({ dateRange }: AgentPerformanceTableProps): JSX.Element {
    const [performanceData, setPerformanceData] = useState<AgentPerformanceData[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);

    useEffect(() => {
      const fetchData = async (): Promise<void> => {
        setLoading(true);
        try {
          const params = new URLSearchParams();
          if (dateRange?.from) params.set('startDate', dateRange.from.toISOString());
          if (dateRange?.to) params.set('endDate', dateRange.to.toISOString());

          const res = await fetch(`/api/v1/dashboard/stats?${params.toString()}`);
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Falha ao carregar dados de performance.');
          }
          const data = await res.json();
          setPerformanceData(data.agentPerformance || []);
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') console.debug(error);
          notify.error('Erro no Ranking', (error as Error).message);
          setPerformanceData([]);
        } finally {
          setLoading(false);
        }
      };
      void fetchData();
    }, [dateRange, notify]);


    if (loading) {
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                     <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                           <Skeleton className="h-4 w-3/4" />
                        </div>
                        <Skeleton className="h-4 w-1/4" />
                     </div>
                ))}
            </div>
        )
    }
    
    if (performanceData.length === 0) {
        return <p className="text-sm text-center py-4 text-muted-foreground">Nenhum dado de atendente encontrado para este período.</p>
    }

    return (
        <div className="w-full">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Atendente</TableHead>
                        <TableHead className="text-right">Atendimentos Resolvidos</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {performanceData.map((agent, index) => (
                        <TableRow key={agent.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Badge variant="secondary" className="hidden sm:block">{index + 1}</Badge>
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={agent.avatarUrl || ''} alt={agent.name} data-ai-hint="avatar user" />
                                        <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{agent.name}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{agent.resolved}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
