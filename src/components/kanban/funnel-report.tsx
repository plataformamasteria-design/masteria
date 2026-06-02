// src/components/kanban/funnel-report.tsx
// Aba de Relatório / Diagnóstico completo do funil Kanban.
'use client';

import { useState, useEffect } from 'react';
import {
  Users, TrendingUp, Clock, MessageCircle, Award,
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

function MetricCard({ icon: Icon, label, value, sub, color, glowColor }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string; glowColor?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-white/[0.02] border border-white/5 rounded-3xl p-5 md:p-6 flex flex-col justify-between gap-2 shadow-2xl backdrop-blur-md transition-all hover:bg-white/[0.04] group`}>
      {glowColor && (
        <div className={`absolute -top-10 -right-10 w-32 h-32 opacity-10 group-hover:opacity-20 blur-3xl transition-opacity duration-500 rounded-full ${glowColor}`} />
      )}
      <div className="relative z-10 flex items-center justify-between mb-2">
        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={cn("p-2 rounded-xl bg-white/[0.03] border border-white/5 shadow-inner", color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="relative z-10">
        <p className={cn('text-3xl md:text-4xl font-black tracking-tighter drop-shadow-md', color || 'text-foreground')}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground font-medium mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function StageBar({ stage, maxTotal }: { stage: ReportData['byStage'][0]; maxTotal: number }) {
  const pct = maxTotal > 0 ? Math.round((stage.total / maxTotal) * 100) : 0;
  
  let colorClass = 'shadow-[0_0_10px_rgba(255,255,255,0.2)]';
  let gradientClass = 'from-zinc-400 to-zinc-600';
  let textClass = 'text-foreground';
  
  if (stage.stageType === 'WIN') {
    colorClass = 'shadow-[0_0_15px_rgba(16,185,129,0.5)]';
    gradientClass = 'from-emerald-400 to-emerald-600';
    textClass = 'text-emerald-400';
  } else if (stage.stageType === 'LOSS') {
    colorClass = 'shadow-[0_0_15px_rgba(239,68,68,0.5)]';
    gradientClass = 'from-red-400 to-red-600';
    textClass = 'text-red-400';
  }

  return (
    <div className="group space-y-2 p-3.5 rounded-2xl bg-white/[0.01] hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/5">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-foreground/90 font-semibold truncate pr-4">{stage.stageName}</span>
        <div className="flex items-center gap-4 flex-shrink-0">
          {stage.avgMinutesInStage !== null && (
            <span className="text-muted-foreground/60 text-[10px] uppercase tracking-wider font-semibold">{formatMinutes(stage.avgMinutesInStage)}</span>
          )}
          <span className={cn("font-black text-[13px]", textClass)}>{stage.total}</span>
        </div>
      </div>
      <div className="h-2.5 bg-black/40 rounded-full overflow-hidden shadow-inner border border-white/5">
        <div className={cn(`h-full rounded-full transition-all bg-gradient-to-r ${gradientClass} ${colorClass}`)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Helpers de data ────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function buildDateRange(
  period: Period,
  customFrom: string,
  customTo: string,
): { from: string; to: string } | null {
  const now = new Date();
  if (period === 'today') {
    const day = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    return { from: day, to: day };
  }
  if (period === '7d')  return { from: toDateStr(new Date(now.getTime() - 7  * 86400000)), to: toDateStr(now) };
  if (period === '30d') return { from: toDateStr(new Date(now.getTime() - 30 * 86400000)), to: toDateStr(now) };
  if (period === '90d') return { from: toDateStr(new Date(now.getTime() - 90 * 86400000)), to: toDateStr(now) };
  if (period === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo };
  return null;
}

// ── Componente principal ────────────────────────────────────────────────────────
export function FunnelReport({ boardId }: { boardId: string }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const range = buildDateRange(period, customFrom, customTo);
    if (!range) return;

    let cancelled = false;
    setLoading(true);
    setError('');

    fetch(`/api/v1/kanbans/${boardId}/report?from=${range.from}&to=${range.to}`)
      .then(res => {
        if (!res.ok) return res.text().then(t => Promise.reject(new Error(t)));
        return res.json();
      })
      .then((json: ReportData) => {
        if (!cancelled) setData(json);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || 'Erro ao carregar relatório.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [boardId, period, refreshKey]);

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today',  label: 'Hoje'    },
    { key: '7d',     label: '7 dias'  },
    { key: '30d',    label: '30 dias' },
    { key: '90d',    label: '90 dias' },
    { key: 'custom', label: 'Custom'  },
  ];

  const maxStageTotal = data ? Math.max(...data.byStage.map(s => s.total), 1) : 1;
  const conversionRate = data && data.summary.totalLeads > 0
    ? Math.round((data.summary.wins / data.summary.totalLeads) * 100) : 0;
  const lossRate = data && data.summary.totalLeads > 0
    ? Math.round((data.summary.losses / data.summary.totalLeads) * 100) : 0;
  const contactRate = data && (data.response.withContactCount + data.response.noContactCount) > 0
    ? Math.round((data.response.withContactCount / (data.response.withContactCount + data.response.noContactCount)) * 100)
    : 0;

  return (
    <div className="p-4 md:p-8 space-y-8 overflow-auto min-h-full">
      {/* HEADER DE FILTROS: Floating Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-3xl backdrop-blur-md">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-2"><BarChart2 className="inline w-4 h-4 mr-1" /> Filtro:</span>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold transition-all border',
                period === p.key
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                  : 'bg-white/[0.03] text-muted-foreground border-transparent hover:bg-white/[0.08] hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="h-9 px-3 text-xs rounded-xl border border-white/10 bg-zinc-900/50 text-foreground focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            <span className="text-muted-foreground text-xs font-medium">até</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="h-9 px-3 text-xs rounded-xl border border-white/10 bg-zinc-900/50 text-foreground focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            <Button
              size="sm"
              onClick={() => setRefreshKey(k => k + 1)}
              disabled={!customFrom || !customTo}
              className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              Aplicar
            </Button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64 bg-white/[0.01] rounded-3xl border border-white/5">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-500/50" />
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center bg-white/[0.01] rounded-3xl border border-white/5">
          <AlertCircle className="h-12 w-12 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
          <p className="text-sm font-medium text-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} className="rounded-full border-white/10 hover:bg-white/5">
            Tentar novamente
          </Button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-8">
          {/* TOP ROW: CORE METRICS (HERO) */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
            <MetricCard icon={Users} label="Leads Totais" value={data.summary.totalLeads} />
            <MetricCard icon={Calendar} label="Entradas (Período)" value={data.summary.leadsInPeriod} />
            <MetricCard icon={TrendingUp} label="Avançaram" value={data.summary.advanced} sub="mudaram de etapa" />
            <MetricCard icon={CheckCircle2} label="Conversões (WIN)" value={`${conversionRate}%`} sub={`${data.summary.wins} vendas`} color="text-emerald-400" glowColor="bg-emerald-500" />
            <MetricCard icon={XCircle} label="Perdas (LOSS)" value={`${lossRate}%`} sub={`${data.summary.losses} descartados`} />
          </div>

          {/* MIDDLE ROW: BENTO SPLIT (STAGES vs DIAGNOSTICS) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* LEFT BOX: Distribuição por Estágios (Span 8) */}
            <div className="xl:col-span-7 2xl:col-span-8 flex flex-col bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
              <h3 className="text-sm font-black tracking-wider text-foreground mb-6 flex items-center gap-2 uppercase">
                <TrendingUp className="h-5 w-5 text-emerald-500 drop-shadow-[0_0_8px_currentColor]" /> Distribuição do Pipeline
              </h3>
              <div className="flex-1 space-y-1 pr-2">
                {data.byStage.map(stage => (
                  <StageBar key={stage.stageId} stage={stage} maxTotal={maxStageTotal} />
                ))}
              </div>
            </div>

            {/* RIGHT BOX: Diagnóstico de Atendimento (Span 4) */}
            <div className="xl:col-span-5 2xl:col-span-4 flex flex-col gap-6">
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex-1 flex flex-col">
                <h3 className="text-sm font-black tracking-wider text-foreground mb-6 flex items-center gap-2 uppercase flex-shrink-0">
                  <Clock className="h-5 w-5 text-emerald-500 drop-shadow-[0_0_8px_currentColor]" /> SLA e Atendimento
                </h3>
                <div className="grid grid-cols-1 grid-rows-4 gap-4 flex-1">
                  <MetricCard icon={Clock} label="1º Contato" value={formatMinutes(data.response.avgFirstContactMinutes)} sub="Tempo médio de resposta" />
                  <MetricCard icon={MessageCircle} label="Taxa de Contato" value={`${contactRate}%`} sub={`${data.response.noContactCount} leads sem contato`} />
                  <MetricCard icon={Clock} label="Mediana" value={formatMinutes(data.response.p50)} sub="50% dos leads respondidos" />
                  <MetricCard icon={Clock} label="Cauda (P90)" value={formatMinutes(data.response.p90)} sub="90% dos leads respondidos" />
                </div>
                {data.response.noContactCount > 0 && (
                  <div className="mt-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 drop-shadow-[0_0_10px_currentColor]" />
                    <p className="text-xs text-red-200 leading-relaxed font-medium">
                      Atenção: <strong className="text-white text-sm">{data.response.noContactCount} leads</strong> ainda não receberam interação humana ou automação na primeira etapa.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: Agent Leaderboard */}
          {data.byAgent.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
              <h3 className="text-sm font-black tracking-wider text-foreground mb-6 flex items-center gap-2 uppercase">
                <Award className="h-5 w-5 text-emerald-500 drop-shadow-[0_0_8px_currentColor]" /> Leaderboard da Equipe
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.byAgent.map((agent, i) => (
                  <div key={agent.userId} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.04] transition-all group">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-inner",
                      i === 0 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]" :
                      i === 1 ? "bg-slate-300/20 text-slate-300 border border-slate-300/30" :
                      i === 2 ? "bg-orange-700/20 text-orange-400 border border-orange-700/30" :
                      "bg-zinc-800 text-zinc-400 border border-white/5"
                    )}>
                      #{i + 1}
                    </div>
                    {agent.avatarUrl ? (
                      <img src={agent.avatarUrl} alt={agent.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-emerald-500/50 transition-all" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center ring-2 ring-white/10 text-sm font-bold text-white group-hover:ring-emerald-500/50 transition-all">
                        {(agent.name || agent.email || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{agent.name || agent.email.split('@')[0]}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Users className="h-3 w-3 text-muted-foreground/70" />
                        <span className="text-[11px] font-bold text-emerald-400">{agent.leadCount}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">leads</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
