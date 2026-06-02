'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { Users, ArrowRight, Trophy, TrendingUp } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

interface AgentLeads {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  leadCount: number;
}

interface BoardReport {
  boardId: string;
  boardName: string;
  byAgent: AgentLeads[];
  summary: { totalLeads: number };
}

interface LeadsByUserProps {
  dateRange?: DateRange;
}

const RANK_COLORS = ['text-amber-400', 'text-zinc-300', 'text-amber-600'];
const RANK_BG = ['bg-amber-500/10', 'bg-zinc-500/10', 'bg-amber-700/10'];

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export function LeadsByUserWidget({ dateRange }: LeadsByUserProps) {
  const [selectedBoardIdx, setSelectedBoardIdx] = useState(0);

  const fetcher = async () => {
    const boardsRes = await fetch('/api/v1/kanbans');
    if (!boardsRes.ok) throw new Error('Failed to fetch kanbans');
    const boards: Array<{ id: string; name: string; totalLeads: number }> = await boardsRes.json();

    const sortedBoards = [...boards].sort((a, b) => (b.totalLeads || 0) - (a.totalLeads || 0));

    const params = new URLSearchParams();
    if (dateRange?.from) params.set('from', dateRange.from.toISOString().split('T')[0]);
    if (dateRange?.to) params.set('to', dateRange.to.toISOString().split('T')[0]);

    const reportResults = await Promise.all(
      sortedBoards.slice(0, 3).map(async b => {
        try {
          const r = await fetch(`/api/v1/kanbans/${b.id}/report?${params.toString()}`);
          if (!r.ok) return null;
          return await r.json();
        } catch { return null; }
      })
    );

    return reportResults.filter(Boolean) as BoardReport[];
  };

  const key = ['/api/v1/kanbans/reports', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()];
  const { data: reports = [], isLoading: loading } = useSWR(key, fetcher, {
    dedupingInterval: 60000,
    revalidateOnFocus: false
  });

  const activeReport = reports[selectedBoardIdx];
  const agents = (activeReport?.byAgent ?? []).sort((a, b) => b.leadCount - a.leadCount);
  const maxLeads = Math.max(...agents.map(a => a.leadCount), 1);

  return (
    <div className="glass-card p-6 w-full animate-fade-slide-up stagger-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <Users className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <p className="label-kpi">Pipeline por Usuário</p>
            <h2 className="text-base font-bold text-foreground dark:text-white mt-0.5">
              Leads Atribuídos por Responsável
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Board tabs */}
          {reports.map((r, i) => (
            <button
              key={r.boardId}
              onClick={() => setSelectedBoardIdx(i)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                i === selectedBoardIdx
                  ? 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400'
                  : 'bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              {r.boardName}
            </button>
          ))}
          <Link
            href="/kanban"
            className="flex items-center gap-1 text-xs text-muted-foreground dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors ml-1"
          >
            Ver Pipeline <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Agents grid (horizontal columns) */}
      {loading ? (
        <div className="flex overflow-x-auto gap-3 pb-4 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-black/10 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 w-28 shrink-0 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : agents.length > 0 ? (
        <div className="flex overflow-x-auto gap-3 pb-4 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-black/10 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
          {agents.map((agent, i) => {
            const pct = Math.round((agent.leadCount / maxLeads) * 100);
            const isTop3 = i < 3;
            return (
              <div
                key={agent.userId}
                className={`flex flex-col items-center gap-2 rounded-xl p-3 border transition-all hover:scale-[1.02] shrink-0 w-28 ${
                  isTop3
                    ? 'bg-emerald-500/5 border-emerald-500/10'
                    : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5'
                }`}
              >
                {/* Rank badge */}
                {isTop3 && (
                  <div className={`self-end -mt-1 -mr-1 flex h-5 w-5 items-center justify-center rounded-full ${RANK_BG[i]} border border-black/5 dark:border-white/5`}>
                    <Trophy className={`h-3 w-3 ${RANK_COLORS[i]}`} />
                  </div>
                )}

                {/* Avatar */}
                <div className="relative h-10 w-10 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 border-2 border-black/10 dark:border-white/10 shrink-0">
                  {agent.avatarUrl ? (
                    <Image src={agent.avatarUrl} alt={agent.name} fill className="object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs font-bold text-emerald-400">
                      {getInitials(agent.name)}
                    </div>
                  )}
                </div>

                {/* Name */}
                <p className="text-xs font-semibold text-foreground dark:text-white text-center leading-tight line-clamp-2">
                  {agent.name.split(' ')[0]}
                </p>

                {/* Lead count */}
                <div className="text-center">
                  <p className="text-xl font-black font-outfit text-foreground dark:text-white tabular-nums">{agent.leadCount}</p>
                  <p className="text-[10px] text-muted-foreground dark:text-zinc-600">leads</p>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <TrendingUp className="h-8 w-8 text-zinc-700" />
          <p className="text-sm text-muted-foreground dark:text-zinc-600">Nenhum lead atribuído encontrado</p>
        </div>
      )}

      {/* Summary */}
      {activeReport && (
        <p className="text-xs text-muted-foreground dark:text-zinc-600 mt-4">
          {activeReport.summary.totalLeads} leads no total · {agents.length} responsáveis · {activeReport.boardName}
        </p>
      )}
    </div>
  );
}
