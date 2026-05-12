import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UsersRound, MessageSquare, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { DateRange } from "react-day-picker";

interface TeamStat {
  id: string;
  name: string;
  color: string;
  memberCount: number;
  chatCount: number;
}

interface TeamPerformanceWidgetProps {
  dateRange?: DateRange;
}

export default function TeamPerformanceWidget({ dateRange }: TeamPerformanceWidgetProps) {
  const { currentOrganization } = useOrganization();
  const [teams, setTeams] = useState<TeamStat[]>([]);
  const [loading, setLoading] = useState(true);

  const dateRangeStr = JSON.stringify(dateRange);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const start = dateRange?.from ? startOfDay(dateRange.from) : startOfDay(subDays(new Date(), 7));
      const end = dateRange?.to ? endOfDay(dateRange.to) : endOfDay(new Date());

      const [teamsRes, membersRes, chatsRes] = await Promise.all([
        (supabase as any).from("teams").select("id, name, color").eq("organization_id", currentOrganization.id),
        (supabase as any).from("team_members").select("team_id").eq("organization_id", currentOrganization.id),
        (supabase as any).from("chats").select("team_id")
          .eq("organization_id", currentOrganization.id)
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
          .not("team_id", "is", null),
      ]);

      const memberCounts: Record<string, number> = {};
      (membersRes.data || []).forEach((m: any) => {
        memberCounts[m.team_id] = (memberCounts[m.team_id] || 0) + 1;
      });

      const chatCounts: Record<string, number> = {};
      (chatsRes.data || []).forEach((c: any) => {
        if (c.team_id) chatCounts[c.team_id] = (chatCounts[c.team_id] || 0) + 1;
      });

      const stats: TeamStat[] = (teamsRes.data || [])
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          color: t.color || "#6366f1",
          memberCount: memberCounts[t.id] || 0,
          chatCount: chatCounts[t.id] || 0,
        }))
        .sort((a: TeamStat, b: TeamStat) => b.chatCount - a.chatCount);

      setTeams(stats);
    } catch (e) {
      console.error("Team widget error:", e);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, dateRangeStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Card className="glass overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <UsersRound className="h-5 w-5 text-cyan-500" />
          </div>
          <CardTitle className="text-lg font-bold">Equipes</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 bg-muted/20" />)}
          </div>
        ) : teams.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma equipe</p>
        ) : (
          <div className="space-y-2">
            {teams.map((team, i) => (
              <div
                key={team.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 border border-border/30 hover:border-border/60 transition-all"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                  style={{ backgroundColor: team.color }}
                >
                  {i === 0 && team.chatCount > 0
                    ? <Trophy className="h-4 w-4" />
                    : team.name.charAt(0).toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{team.name}</p>
                  <p className="text-[10px] text-muted-foreground">{team.memberCount} membros</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <MessageSquare className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-black">{team.chatCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
