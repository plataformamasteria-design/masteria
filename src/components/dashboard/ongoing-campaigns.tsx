
'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Send, Clock, ArrowRight, Megaphone, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import type { Campaign } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  SENDING: { label: 'Enviando', icon: Send, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  SCHEDULED: { label: 'Agendada', icon: Clock, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  QUEUED: { label: 'Na Fila', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  PENDING: { label: 'Pendente', icon: AlertCircle, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
  COMPLETED: { label: 'Concluída', icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
};

export function OngoingCampaigns() {
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  const fetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Falha ao buscar campanhas.');
    const result = await response.json();
    return result.data || [];
  };

  const { data, isLoading: loading } = useSWR<Campaign[]>('/api/v1/campaigns', fetcher, {
    dedupingInterval: 30000,
    revalidateOnFocus: false,
    onError: (err) => notify.error('Erro', err.message)
  });

  const campaigns = data 
    ? data.filter((c: Campaign) => ['SENDING', 'SCHEDULED', 'QUEUED', 'PENDING', 'COMPLETED'].includes(c.status)).slice(0, 4)
    : [];

  return (
    <div className="glass-card p-6 h-full flex flex-col gap-4 animate-fade-slide-up stagger-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <Megaphone className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <p className="label-kpi">Campanhas</p>
            <p className="text-white font-semibold text-sm mt-0.5">
              {loading ? '—' : `${campaigns.length} ativa${campaigns.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <Link
          href="/campanhas"
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
        >
          Ver <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Campaign list */}
      <div className="flex-1 space-y-2.5">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
          ))
        ) : campaigns.length > 0 ? (
          campaigns.map(campaign => {
            const cfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = cfg.icon;
            const isSending = campaign.status === 'SENDING';
            const progress = isSending && campaign.progress !== undefined ? campaign.progress : null;

            return (
              <div
                key={campaign.id}
                className={`rounded-xl border ${cfg.border} ${cfg.bg} px-3.5 py-2.5 flex flex-col gap-1.5 transition-all hover:scale-[1.01]`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white truncate flex-1">{campaign.name}</p>
                  <div className={cn('flex items-center gap-1 text-xs font-medium shrink-0', cfg.color)}>
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </div>
                </div>

                {progress !== null ? (
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Progresso</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', cfg.bg.replace('/10', '/60'))}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ) : campaign.scheduledAt ? (
                  <p className="text-xs text-zinc-600">
                    {new Date(campaign.scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-6">
            <Megaphone className="h-8 w-8 text-zinc-700" />
            <p className="text-xs text-zinc-600">Nenhuma campanha ativa</p>
            <Link href="/campanhas" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
              Criar campanha →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
