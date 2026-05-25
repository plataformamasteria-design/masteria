// src/components/kanban/funnel-report.tsx
// Aba de Relatório / Diagnóstico completo do funil Kanban.
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, TrendingUp, TrendingDown, Clock, MessageCircle, Award,
  Loader2, BarChart2, Calendar, AlertCircle, CheckCircle2, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReportData {
  boardName: string;
  period: { from: string; to: string };
  summary: {
    totalLeads: number;
    leadsInPeriod: number;
    advanced: number;
    wins: number;
    losses: number;
  };
  byStage: Array<{
    stageId: string;
    stageName: string;
    stageType: string;
    total: number;
    inPeriod: number;
    avgMinutesInStage: number | null;
  }>;
  response: {
    avgFirstContactMinutes: number | null;
    p50: number | null;
    p90: number | null;
    noContactCount: number;
    withContactCount: number;
  };
  byAgent: Array<{
    userId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    leadCount: number;
  }>;
  timeline: Array<{ date: string; entries: number; advances: number }>;
}

type Period = 'today' | '7d' | '30d' | '90d' | 'custom';

function formatMinutes(min: number | null): string {
  if (min === null) return '—';
  if (min < 60) return `${Math.round(min)}min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h${m > 0 ? ` ${m}m` : ''}`;
}

function MetricCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border/50 rounded-xl p-4 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={cn('h-4 w-4', color || 'text-muted-foreground')} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold tracking-tight', color || 'text-foreground')}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function StageBar({ stage, maxTotal }: { stage: ReportData['byStage'][0]; maxTotal: number }) {
  const pct = maxTotal > 0 ? Math.round((stage.total / maxTotal) * 100) : 0;
  const color = stage.stageType === 'WIN' ? 'bg-emerald-500' : stage.stageType === 'LOSS' ? 'bg-red-400' : 'bg-primary';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground font-medium truncate max-w-[160px]">{stage.stageName}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {stage.avgMinutesInStage !== null && (
            <span className="text-muted-foreground">{formatMinutes(stage.avgMinutesInStage)} média</span>
          )}
          <span className="font-bold text-foreground">{stage.total}</span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function FunnelReport({ boardId }: { boardId: string }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let from = '';
      let to   = '';
      const now = new Date();

      if (period === 'today') {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
        to   = now.toISOString().split('T')[0];
      } else if (period === '7d') {
        from = new Date(now.getTime() - 7  * 86400000).toISOString().split('T')[0];
        to   = now.toISOString().split('T')[0];
      } else if (period === '30d') {
        from = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
        to   = now.toISOString().split('T')[0];
      } else if (period === '90d') {
        from = new Date(now.getTime() - 90 * 86400000).toISOString().split('T')[0];
        to   = now.toISOString().split('T')[0];
      } else if (period === 'custom' && customFrom && customTo) {
        from = customFrom;
        to   = customTo;
      } else {
        return; // custom sem datas preenchidas
      }

      const res = await fetch(`/api/v1/kanbans/${boardId}/report?from=${from}&to=${to}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar relatório.');
    } finally {
      setLoading(false);
    }
  }, [boardId, period, customFrom, customTo]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Hoje'    },
    { key: '7d',    label: '7 dias'  },
    { key: '30d',   label: '30 dias' },
    { key: '90d',   label: '90 dias' },
    { key: 'custom',label: 'Custom'  },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchReport}>Tentar novamente</Button>
      </div>
    );
  }

  if (!data) return null;

  const maxStageTotal = Math.max(...data.byStage.map(s => s.total), 1);
  const conversionRate = data.summary.totalLeads > 0
    ? Math.round((data.summary.wins / data.summary.totalLeads) * 100)
    : 0;
  const lossRate = data.summary.totalLeads > 0
    ? Math.round((data.summary.losses / data.summary.totalLeads) * 100)
    : 0;
  const contactRate = (data.response.withContactCount + data.response.noContactCount) > 0
    ? Math.round((data.response.withContactCount / (data.response.withContactCount + data.response.noContactCount)) * 100)
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-auto">
      {/* Período */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                period === p.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:bg-muted',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground" />
            <span className="text-muted-foreground text-xs">até</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground" />
            <Button size="sm" variant="outline" onClick={fetchReport} className="h-8 text-xs">Aplicar</Button>
          </div>
        )}
      </div>

      {/* Métricas de Visão Geral */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" /> Visão Geral do Período
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard icon={Users}        label="Leads totais"    value={data.summary.totalLeads} />
          <MetricCard icon={Calendar}     label="Entradas"        value={data.summary.leadsInPeriod} sub="no período selecionado" color="text-blue-500" />
          <MetricCard icon={TrendingUp}   label="Avançaram"       value={data.summary.advanced} sub="mudaram de etapa" color="text-violet-500" />
          <MetricCard icon={CheckCircle2} label="Conversões"      value={`${conversionRate}%`} sub={`${data.summary.wins} vendas`} color="text-emerald-500" />
          <MetricCard icon={XCircle}      label="Perdas"          value={`${lossRate}%`}        sub={`${data.summary.losses} perdidos`} color="text-red-400" />
        </div>
      </section>

      {/* Atendimento */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" /> Diagnóstico de Atendimento
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={Clock}         label="1º contato médio" value={formatMinutes(data.response.avgFirstContactMinutes)} color="text-amber-500" />
          <MetricCard icon={Clock}         label="Mediana (P50)"    value={formatMinutes(data.response.p50)} sub="50% respondido em" />
          <MetricCard icon={Clock}         label="P90"              value={formatMinutes(data.response.p90)} sub="90% respondido em" />
          <MetricCard icon={MessageCircle} label="Taxa de contato"  value={`${contactRate}%`} sub={`${data.response.noContactCount} sem contato`} color="text-blue-500" />
        </div>
        {data.response.noContactCount > 0 && (
          <div className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>{data.response.noContactCount} leads</strong> ainda não receberam nenhuma mensagem.
            </p>
          </div>
        )}
      </section>

      {/* Funil por Etapa */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-violet-500" /> Distribuição por Etapa
        </h3>
        <div className="bg-card border border-border/50 rounded-xl p-4 space-y-4">
          {data.byStage.map(stage => (
            <StageBar key={stage.stageId} stage={stage} maxTotal={maxStageTotal} />
          ))}
        </div>
      </section>

      {/* Agentes */}
      {data.byAgent.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-blue-500" /> Performance por Agente
          </h3>
          <div className="bg-card border border-border/50 rounded-xl divide-y divide-border/30">
            {data.byAgent.map((agent, i) => (
              <div key={agent.userId} className="flex items-center gap-3 p-3">
                <span className="text-[11px] text-muted-foreground w-5 text-center font-bold">{i + 1}</span>
                {agent.avatarUrl ? (
                  <img src={agent.avatarUrl} alt={agent.name} className="w-7 h-7 rounded-full object-cover ring-1 ring-border" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center ring-1 ring-border text-[11px] font-bold text-primary">
                    {(agent.name || agent.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{agent.name || agent.email}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-bold">{agent.leadCount}</span>
                  <span className="text-xs text-muted-foreground">leads</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
