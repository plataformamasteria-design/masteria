import { Users, MessageCircle } from "lucide-react";

interface NodeStatsBarProps {
  stats: { total_reached: number; total_responded: number; responses?: any } | null;
}

export function NodeStatsBar({ stats }: NodeStatsBarProps) {
  if (!stats || stats.total_reached === 0) return null;

  const conversionRate = stats.total_responded > 0 && stats.total_reached > 0
    ? Math.round((stats.total_responded / stats.total_reached) * 100)
    : 0;

  return (
    <div className="px-4 py-2.5 border-t border-slate-200 dark:border-zinc-800 bg-muted/40 flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold text-foreground">{stats.total_reached}</span>
        <span>chegaram</span>
      </div>
      {stats.total_responded > 0 && (
        <div className="flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">{stats.total_responded}</span>
          <span>responderam</span>
          <span className="text-primary font-bold">({conversionRate}%)</span>
        </div>
      )}
    </div>
  );
}
