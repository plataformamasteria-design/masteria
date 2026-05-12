import { Users, MessageCircle, ArrowDownRight } from "lucide-react";

interface NodeStatsBarProps {
  stats: { total_reached: number; total_responded: number; parent_reached?: number; responses?: any } | null;
}

export function NodeStatsBar({ stats }: NodeStatsBarProps) {
  if (!stats) return null;
  if (stats.total_reached === 0 && (!stats.parent_reached || stats.parent_reached === 0)) return null;

  const responseRate = stats.total_responded > 0 && stats.total_reached > 0
    ? Math.round((stats.total_responded / stats.total_reached) * 100)
    : 0;

  let transitionRate = null;
  if (typeof stats.parent_reached === 'number' && stats.parent_reached > 0) {
    transitionRate = Math.round((stats.total_reached / stats.parent_reached) * 100);
  }

  return (
    <div className="px-4 py-2.5 border-t border-border bg-muted/40 flex flex-col gap-1.5 text-xs text-muted-foreground w-full">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground tracking-tight">{stats.total_reached}</span>
          <span className="opacity-90">passaram</span>
        </div>

        {transitionRate !== null && (
          <div className="flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
            <ArrowDownRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-700 dark:text-emerald-400 font-bold text-[11px] leading-none">{transitionRate}%</span>
          </div>
        )}
      </div>

      {stats.total_responded > 0 && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
          <span className="font-semibold text-foreground tracking-tight">{stats.total_responded}</span>
          <span className="opacity-90">responderam</span>
          <span className="text-blue-600 dark:text-blue-400 font-bold ml-1 text-[11px]">({responseRate}%)</span>
        </div>
      )}
    </div>
  );
}
