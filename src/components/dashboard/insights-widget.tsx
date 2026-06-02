'use client';

import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, TrendingDown, AlertCircle, RefreshCw, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';

interface InsightsData {
  insights: string[];
  status: 'positive' | 'neutral' | 'critical';
  period: { from: string; to: string };
  generatedAt: string;
}

const STATUS_CONFIG = {
  positive: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400', label: 'Período positivo', labelColor: 'text-emerald-400', dotColor: 'bg-emerald-400' },
  neutral: { border: 'border-zinc-500/20', bg: 'bg-zinc-500/5', iconBg: 'bg-zinc-500/10', iconColor: 'text-zinc-400', label: 'Análise do período', labelColor: 'text-zinc-400', dotColor: 'bg-zinc-400' },
  critical: { border: 'border-red-500/20', bg: 'bg-red-500/5', iconBg: 'bg-red-500/10', iconColor: 'text-red-400', label: 'Requer atenção', labelColor: 'text-red-400', dotColor: 'bg-red-400' },
};

function parseInsight(insight: string) {
  // If explicitly has positive emojis or words and no negative emojis
  const isPositive = /🚀|📈|🟢|🌟|🎯|🔥|\+/.test(insight) && !/🔴|📉|⚠️|🚨|🔻/.test(insight);
  // If explicitly has negative emojis
  const isNegative = /🔴|📉|⚠️|🚨|🔻/.test(insight);
  
  const cleanText = insight.replace(/^(🚀|📈|🟢|🌟|🎯|🔥|🔴|📉|⚠️|🚨|🔻|🔵|ℹ️|🔺)\s*/, '');
  
  return {
    text: cleanText,
    type: isNegative ? 'negative' : (isPositive ? 'positive' : 'neutral')
  };
}

export function DashboardInsightsWidget() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/dashboard/insights');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInsights(); }, []);

  const cfg = STATUS_CONFIG[data?.status ?? 'neutral'];
  const genDate = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  const parsedInsights = data?.insights?.map(parseInsight) || [];
  const positiveInsights = parsedInsights.filter(i => i.type === 'positive');
  const negativeInsights = parsedInsights.filter(i => i.type === 'negative' || i.type === 'neutral');

  return (
    <div className={`glass-card border ${cfg.border} animate-fade-slide-up stagger-2 overflow-hidden`}>
      {/* Header row */}
      <div className="w-full flex items-center justify-between px-5 py-4">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left flex-1 min-w-0"
        >
          <div className={`p-2 rounded-xl ${cfg.iconBg} border ${cfg.border} shrink-0`}>
            <Sparkles className={`h-4 w-4 ${cfg.iconColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-foreground dark:text-white font-bold text-sm">Insights Semanais</span>
              <span className={`text-xs font-semibold ${cfg.labelColor} px-2 py-0.5 rounded-full ${cfg.bg} border ${cfg.border}`}>
                {cfg.label}
              </span>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dotColor} opacity-50`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dotColor}`} />
              </span>
            </div>
            {genDate && (
              <p className="text-xs text-muted-foreground dark:text-zinc-600 mt-0.5">Atualizado em {genDate}</p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchInsights}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-zinc-500 hover:text-zinc-800 dark:text-zinc-600 dark:hover:text-zinc-400"
            title="Atualizar insights"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setCollapsed(v => !v)} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground dark:text-zinc-600 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`}
            />
          </button>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="px-5 pb-5">
          {loading ? (
            <div className="flex items-center gap-3 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground dark:text-zinc-600" />
              <span className="text-sm text-muted-foreground dark:text-zinc-600">Analisando dados do período...</span>
            </div>
          ) : parsedInsights.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Positive Insights Column */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Destaques Positivos</span>
                </div>
                {positiveInsights.length > 0 ? positiveInsights.map((insight, i) => (
                  <div
                    key={`pos-${i}`}
                    className="flex gap-3 items-start rounded-xl px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 text-sm text-emerald-900 dark:text-emerald-100 leading-relaxed animate-fade-slide-up"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="flex-1">{insight.text}</span>
                  </div>
                )) : (
                  <div className="rounded-xl px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-sm text-zinc-500">
                    Nenhum destaque positivo no período.
                  </div>
                )}
              </div>

              {/* Negative Insights Column */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-widest">Pontos de Atenção</span>
                </div>
                {negativeInsights.length > 0 ? negativeInsights.map((insight, i) => (
                  <div
                    key={`neg-${i}`}
                    className="flex gap-3 items-start rounded-xl px-4 py-3 bg-red-500/5 border border-red-500/20 text-sm text-red-900 dark:text-red-100 leading-relaxed animate-fade-slide-up"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <TrendingDown className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <span className="flex-1">{insight.text}</span>
                  </div>
                )) : (
                  <div className="rounded-xl px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-sm text-zinc-500">
                    Nenhum ponto de atenção crítico detectado.
                  </div>
                )}
              </div>
              
            </div>
          ) : (
            <p className="text-sm text-muted-foreground dark:text-zinc-600 py-3">Nenhum insight disponível para o período.</p>
          )}
        </div>
      )}
    </div>
  );
}
