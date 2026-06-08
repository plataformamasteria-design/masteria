'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Megaphone, ArrowRight, Send, Clock, CheckCircle, AlertCircle,
  BarChart3,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { cn } from '@/lib/utils';
import type { Campaign } from '@/lib/types';
import type { DateRange } from 'react-day-picker';

interface CampaignWithStats extends Campaign {
  sent?: number;
  read?: number;
}

const STATUS_CFG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  SENDING:   { label: 'Enviando',  icon: Send,         color: 'text-emerald-400' },
  SCHEDULED: { label: 'Agendada', icon: Clock,        color: 'text-cyan-400'    },
  QUEUED:    { label: 'Na Fila',  icon: Clock,        color: 'text-amber-400'   },
  PENDING:   { label: 'Pendente', icon: AlertCircle,  color: 'text-zinc-400'    },
  COMPLETED: { label: 'Concluída', icon: CheckCircle, color: 'text-blue-400'    },
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; fill: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs space-y-1">
      <p className="text-zinc-600 dark:text-zinc-400 font-medium truncate max-w-[160px]">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill }}>{p.name}: {p.value.toLocaleString('pt-BR')}</p>
      ))}
    </div>
  );
};

interface Props { dateRange?: DateRange; }

export function CampaignsWithPerformance({ dateRange }: Props) {
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'chart'>('list');
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (dateRange?.from) params.set('startDate', dateRange.from.toISOString());
        if (dateRange?.to) params.set('endDate', dateRange.to.toISOString());

        const res = await fetch(`/api/v1/campaigns?${params.toString()}`);
        if (!res.ok) throw new Error('Falha ao buscar campanhas');
        const result = await res.json();
        const resultData = result.data || result;
        const campaignsList = Array.isArray(resultData) ? resultData : [];
        const data: CampaignWithStats[] = campaignsList.slice(0, 5);
        setCampaigns(data);
      } catch (err) {
        notify.error('Erro', (err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, [dateRange, notify]);

  const chartData = campaigns.map(c => ({
    name: c.name.length > 20 ? c.name.slice(0, 18) + '…' : c.name,
    Enviadas: c.sent ?? 0,
    Lidas: c.read ?? 0,
  }));

  const hasChartData = chartData.some(d => d.Enviadas > 0 || d.Lidas > 0);

  return (
    <div className="glass-card p-6 h-full flex flex-col gap-4 animate-fade-slide-up stagger-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Megaphone className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="label-kpi">Campanhas do Período</p>
            <p className="text-foreground dark:text-white font-semibold text-sm mt-0.5">
              {loading ? '—' : `${campaigns.length} campanha${campaigns.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/5">
            {(['list', 'chart'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 text-xs font-medium transition-all ${view === v ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
              >
                {v === 'list' ? 'Lista' : 'Gráfico'}
              </button>
            ))}
          </div>
          <Link href="/campanhas" className="flex items-center gap-1 text-xs text-muted-foreground dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
            Ver <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : view === 'list' ? (
          <div className="space-y-2.5">
            {campaigns.length > 0 ? (
              campaigns.map(campaign => {
                const cfg = STATUS_CFG[campaign.status] || STATUS_CFG.PENDING;
                const StatusIcon = cfg.icon;
                const progress = campaign.status === 'SENDING' && campaign.progress != null ? campaign.progress : null;

                return (
                  <div
                    key={campaign.id}
                    className="rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] px-3.5 py-2.5 flex flex-col gap-1.5 hover:border-emerald-500/10 hover:bg-emerald-500/[0.02] transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground dark:text-white truncate flex-1">{campaign.name}</p>
                      <div className={cn('flex items-center gap-1 text-xs font-medium shrink-0', cfg.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </div>
                    </div>

                    {progress !== null ? (
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-xs text-muted-foreground dark:text-zinc-500">
                          <span>Progresso</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500/80 to-emerald-400/60 transition-all duration-700"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-zinc-600">
                        <span>
                          {campaign.createdAt
                            ? new Date(campaign.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                            : '—'}
                        </span>
                        {campaign.sent != null && (
                          <span>{campaign.sent.toLocaleString('pt-BR')} enviadas</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-8 gap-2">
                <Megaphone className="h-8 w-8 text-zinc-700" />
                <p className="text-xs text-muted-foreground dark:text-zinc-600">Nenhuma campanha no período</p>
                <Link href="/campanhas" className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors">
                  Criar campanha →
                </Link>
              </div>
            )}
          </div>
        ) : hasChartData ? (
          <div className="min-h-[200px]">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={2}>
                <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Enviadas" radius={[4, 4, 0, 0]} fill="hsl(161 79% 39% / 0.6)" />
                <Bar dataKey="Lidas" radius={[4, 4, 0, 0]} fill="hsl(161 79% 39% / 0.25)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-8 gap-2">
            <BarChart3 className="h-8 w-8 text-zinc-700" />
            <p className="text-xs text-muted-foreground dark:text-zinc-600">Sem dados de desempenho disponíveis</p>
          </div>
        )}
      </div>
    </div>
  );
}
