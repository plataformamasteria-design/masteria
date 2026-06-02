'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KanbanSquare, ArrowRight, TrendingUp } from 'lucide-react';

interface KanbanStage {
  id: string;
  title: string;
  type: 'NEUTRAL' | 'WIN' | 'LOSS';
}

interface KanbanBoard {
  id: string;
  name: string;
  stages: KanbanStage[];
  totalLeads: number;
  totalValue: number;
}

interface StageDisplay {
  id: string;
  title: string;
  type: string;
  pct: number;
}

const STAGE_COLORS = [
  'from-emerald-500/70 to-emerald-400/50',
  'from-cyan-500/70 to-cyan-400/50',
  'from-blue-500/70 to-blue-400/50',
  'from-violet-500/70 to-violet-400/50',
  'from-amber-500/70 to-amber-400/50',
];

export function KanbanReportWidget() {
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<KanbanBoard | null>(null);
  const [stageDisplays, setStageDisplays] = useState<StageDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/v1/kanbans');
        if (!res.ok) return;
        const data: KanbanBoard[] = await res.json();
        setBoards(data);

        if (data.length > 0) {
          const board = data[0];
          setSelectedBoard(board);
          
          // Stages come inline in board.stages — distribute totalLeads evenly for display
          // (we don't have per-stage counts from this endpoint)
          const stages = (board.stages || []).slice(0, 5);
          const totalLeads = board.totalLeads || 0;
          const perStage = stages.length > 0 ? Math.round(totalLeads / stages.length) : 0;
          
          // Try to get per-stage report
          const reportRes = await fetch(`/api/v1/kanbans/${board.id}/report`).catch(() => null);
          if (reportRes?.ok) {
            const report = await reportRes.json();
            const stageStats: Array<{ stageId: string; stageName: string; count: number }> = report.byStage || [];
            const maxCount = Math.max(...stageStats.map(s => s.count), 1);
            setStageDisplays(
              stageStats.slice(0, 5).map(s => ({
                id: s.stageId,
                title: s.stageName,
                type: 'NEUTRAL',
                pct: Math.round((s.count / maxCount) * 100),
              }))
            );
          } else {
            // Fallback: equal distribution
            const maxCount = Math.max(perStage, 1);
            setStageDisplays(
              stages.map((s) => ({
                id: s.id,
                title: s.title,
                type: s.type,
                pct: totalLeads > 0 ? Math.round((perStage / maxCount) * 100) : 0,
              }))
            );
          }
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="glass-card p-6 h-full flex flex-col gap-4 animate-fade-slide-up stagger-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <KanbanSquare className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="label-kpi">Kanban Pipeline</p>
            <p className="text-white font-semibold text-sm mt-0.5">
              {loading ? '—' : `${selectedBoard?.totalLeads ?? 0} leads`}
            </p>
          </div>
        </div>
        <Link
          href="/kanban"
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
        >
          Ver <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Board name */}
      {selectedBoard && (
        <p className="text-xs text-zinc-600 -mt-1 truncate">{selectedBoard.name}</p>
      )}

      {/* Stage bars */}
      <div className="flex-1 space-y-2.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 rounded-lg bg-white/5 animate-pulse" />
          ))
        ) : stageDisplays.length ? (
          stageDisplays.map((stage, i) => (
            <div key={stage.id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400 truncate max-w-[160px]">{stage.title}</span>
                <span className="text-white font-semibold tabular-nums">{stage.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${STAGE_COLORS[i % STAGE_COLORS.length]} transition-all duration-700`}
                  style={{ width: `${stage.pct}%`, transitionDelay: `${i * 100}ms` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-4">
            <TrendingUp className="h-8 w-8 text-zinc-700" />
            <p className="text-xs text-zinc-600">Nenhum lead encontrado</p>
          </div>
        )}
      </div>

      {/* Board count */}
      {boards.length > 1 && (
        <p className="text-xs text-zinc-600">{boards.length} funis no total</p>
      )}
    </div>
  );
}
