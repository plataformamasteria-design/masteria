'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Bot, MessageSquare, CheckCircle2, TrendingUp,
  Loader2, ArrowRight, AlertCircle, RefreshCw, Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';

interface AIMetricsData {
  summary: {
    totalPersonas: number;
    totalAIMessages: number;
    recentAIMessages7Days: number;
    activeAIConversations: number;
    successRate: number;
    successCount: number;
    errorCount: number;
    totalAttempts: number;
  };
  dailyActivity: Array<{ date: string; count: number }>;
  topPersonas: Array<{ personaId: string; personaName: string; model: string; messageCount: number }>;
}

const MiniKpi = ({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: React.ElementType }) => (
  <div className="flex-1 rounded-2xl p-4 bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 shadow-sm dark:shadow-none flex flex-col gap-1 min-w-0">
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-emerald-400" />
      <p className="label-kpi">{label}</p>
    </div>
    <p className="font-outfit text-2xl font-black text-zinc-900 dark:text-white leading-tight tabular-nums">
      {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
    </p>
    {sub && <p className="text-xs text-zinc-500">{sub}</p>}
  </div>
);

export function AIPerformanceSection() {
  const [data, setData] = useState<AIMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const _notify = useMemo(() => createToastNotifier(toast), [toast]);

  const fetchMetrics = async () => {
    const controller = new AbortController();
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/ia/metrics', { signal: controller.signal });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Falha ao carregar métricas de IA.');
      }
      setData(await res.json());
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  };

  useEffect(() => { fetchMetrics(); }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <AlertCircle className="h-8 w-8 text-red-500/60" />
        <p className="text-sm text-zinc-500 text-center max-w-sm">{error}</p>
        <button onClick={fetchMetrics} className="flex items-center gap-2 text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
        </button>
      </div>
    );
  }

  if (!data || (data.summary.totalPersonas === 0 && data.summary.totalAIMessages === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <Bot className="h-10 w-10 text-zinc-700" />
        <p className="text-sm text-zinc-600">Nenhum agente de IA configurado ainda</p>
        <Link href="/agentes-ia" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
          Criar meu primeiro agente →
        </Link>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Sparkles className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="label-kpi">Inteligência Artificial</p>
            <h2 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">Agentes de IA</h2>
          </div>
        </div>
        <Link
          href="/agentes-ia"
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-emerald-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-emerald-500/5 border border-transparent hover:border-emerald-500/10"
        >
          Ver Todos os Agentes <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* 4 KPI cards only */}
      <div className="flex flex-wrap gap-3">
        <MiniKpi label="Agentes Ativos"    value={summary.totalPersonas}           sub="Total criados"                       icon={Bot}            />
        <MiniKpi label="Mensagens IA"      value={summary.totalAIMessages}         sub={`${summary.recentAIMessages7Days} nos últimos 7d`} icon={MessageSquare}  />
        <MiniKpi label="Taxa de Sucesso"   value={`${summary.successRate}%`}       sub={`${summary.successCount} ok / ${summary.errorCount} erros`} icon={CheckCircle2}  />
        <MiniKpi label="Conversas Ativas"  value={summary.activeAIConversations}   sub="Com IA respondendo agora"            icon={TrendingUp}     />
      </div>
    </div>
  );
}
