'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Zap, ArrowRight, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface AutomationRule {
  id: string;
  name: string;
  isActive: boolean;
  triggerEvent: string;
  createdAt: string;
}

interface AutomationExecution {
  id: string;
  ruleName?: string;
  status: 'success' | 'error' | 'running';
  executedAt: string;
}

interface AutomationStats {
  totalRules: number;
  activeRules: number;
  recentExecutions: AutomationExecution[];
}

const statusIcon = (status: string) => {
  if (status === 'success') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (status === 'error') return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  return <Clock className="h-3.5 w-3.5 text-amber-400 animate-pulse" />;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

export function AutomationsWidget() {
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [rulesRes, execRes] = await Promise.all([
          fetch('/api/v1/automations'),
          fetch('/api/v1/automation-logs?limit=5').catch(() => null),
        ]);

        const rules: AutomationRule[] = rulesRes.ok ? await rulesRes.json() : [];
        const activeRules = rules.filter(r => r.isActive).length;

        let recentExecutions: AutomationExecution[] = [];
        if (execRes?.ok) {
          const execData = await execRes.json();
          // API returns { logs: [...], pagination: {...} }
          const logs: Array<{ id: string; level: string; ruleName?: string; createdAt: string }> = execData.logs || [];
          recentExecutions = logs.slice(0, 4).map(e => ({
            id: e.id,
            ruleName: e.ruleName || 'Automação',
            status: (e.level === 'ERROR' ? 'error' : e.level === 'WARN' ? 'running' : 'success') as 'success' | 'error' | 'running',
            executedAt: e.createdAt,
          }));
        }

        setStats({ totalRules: rules.length, activeRules, recentExecutions });
      } catch {
        setStats({ totalRules: 0, activeRules: 0, recentExecutions: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="glass-card p-6 h-full flex flex-col gap-4 animate-fade-slide-up stagger-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="label-kpi">Automações</p>
            <p className="text-white font-semibold text-sm mt-0.5">
              {loading ? '—' : `${stats?.activeRules ?? 0} ativas`}
            </p>
          </div>
        </div>
        <Link
          href="/automacoes"
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
        >
          Ver <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
          <p className="text-2xl font-black font-outfit text-white">{loading ? '—' : stats?.totalRules}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Total</p>
        </div>
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3 text-center">
          <p className="text-2xl font-black font-outfit text-emerald-400">{loading ? '—' : stats?.activeRules}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Ativas</p>
        </div>
      </div>

      {/* Recent executions */}
      <div className="flex-1">
        <p className="text-xs text-zinc-600 font-semibold mb-2 tracking-wide uppercase">Últimas execuções</p>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-white/5 animate-pulse mb-2" />
          ))
        ) : stats?.recentExecutions.length ? (
          <div className="space-y-2">
            {stats.recentExecutions.map(exec => (
              <div key={exec.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors">
                {statusIcon(exec.status)}
                <span className="text-xs text-zinc-300 flex-1 truncate">{exec.ruleName}</span>
                <span className="text-xs text-zinc-600 shrink-0">{timeAgo(exec.executedAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-600 text-center py-3">Sem execuções recentes</p>
        )}
      </div>
    </div>
  );
}
