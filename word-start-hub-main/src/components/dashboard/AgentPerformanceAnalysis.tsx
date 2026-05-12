import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Trophy, TrendingUp, TrendingDown, Target, UserCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

interface AgentStats {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  teamName: string | null;
  teamColor: string | null;
  totalServed: number;
  resolvedInPeriod: number;
  wonInPeriod: number;
  lostInPeriod: number;
  postponedInPeriod: number;
  conversionRate: number;
}

interface AgentPerformanceAnalysisProps {
  dateRange?: DateRange;
}

const AgentPerformanceAnalysis = ({ dateRange }: AgentPerformanceAnalysisProps) => {
  const { currentOrganization } = useOrganization();
  const [agents, setAgents] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Stringify dateRange to prevent reference-based infinite loops
  const dateRangeStr = JSON.stringify(dateRange);

  const fetchAgentPerformance = useCallback(async (showLoading = false) => {
    if (!currentOrganization?.id) return;

    if (showLoading) {
      setLoading(true);
    }

    try {
      const startDate = dateRange?.from ? startOfDay(dateRange.from) : startOfDay(subDays(new Date(), 7));
      const endDate = dateRange?.to ? endOfDay(dateRange.to) : endOfDay(new Date());

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          avatar_url,
          team_members (
            team_id,
            teams (
              name,
              color
            )
          )
        `)
        .eq("organization_id", currentOrganization.id);

      if (profilesError) throw profilesError;

      const { data: servedChats } = await supabase
        .from("chat_assignment_history")
        .select("assigned_to, chat_id")
        .eq("organization_id", currentOrganization.id)
        .gte("assigned_at", startDate.toISOString())
        .lte("assigned_at", endDate.toISOString());

      const agentChatSets: Record<string, Set<string>> = {};
      servedChats?.forEach(chat => {
        if (chat.assigned_to && chat.chat_id) {
          if (!agentChatSets[chat.assigned_to]) {
            agentChatSets[chat.assigned_to] = new Set();
          }
          agentChatSets[chat.assigned_to].add(chat.chat_id);
        }
      });

      const totalServedCounts: Record<string, number> = {};
      Object.entries(agentChatSets).forEach(([agentId, chatSet]) => {
        totalServedCounts[agentId] = chatSet.size;
      });

      const { data: resolutions } = await supabase
        .from("chat_resolutions")
        .select("resolved_by, outcome, chat_id, resolved_at")
        .eq("organization_id", currentOrganization.id)
        .gte("resolved_at", startDate.toISOString())
        .lte("resolved_at", endDate.toISOString());

      const sortedResolutions = [...(resolutions || [])].sort((a, b) => {
        return new Date(b.resolved_at).getTime() - new Date(a.resolved_at).getTime();
      });

      const latestResolutions: Record<string, typeof sortedResolutions[0]> = {};
      sortedResolutions.forEach(res => {
        if (res.chat_id && !latestResolutions[res.chat_id]) {
          latestResolutions[res.chat_id] = res;
        }
      });

      const wonCounts: Record<string, number> = {};
      const lostCounts: Record<string, number> = {};
      const postponedCounts: Record<string, number> = {};
      const resolvedCounts: Record<string, number> = {};

      Object.values(latestResolutions).forEach(resolution => {
        if (resolution.resolved_by) {
          if (resolution.outcome === 'client') {
            wonCounts[resolution.resolved_by] = (wonCounts[resolution.resolved_by] || 0) + 1;
            resolvedCounts[resolution.resolved_by] = (resolvedCounts[resolution.resolved_by] || 0) + 1;
          } else if (resolution.outcome === 'not_client') {
            lostCounts[resolution.resolved_by] = (lostCounts[resolution.resolved_by] || 0) + 1;
            resolvedCounts[resolution.resolved_by] = (resolvedCounts[resolution.resolved_by] || 0) + 1;
          } else if (resolution.outcome === 'postponed') {
            postponedCounts[resolution.resolved_by] = (postponedCounts[resolution.resolved_by] || 0) + 1;
          }
        }
      });

      const agentStats: AgentStats[] = (profiles || []).map((profile: any) => {
        const teamMember = profile.team_members?.[0];
        const team = teamMember?.teams;

        const totalServed = totalServedCounts[profile.id] || 0;
        const resolved = resolvedCounts[profile.id] || 0;
        const won = wonCounts[profile.id] || 0;
        const lost = lostCounts[profile.id] || 0;
        const postponed = postponedCounts[profile.id] || 0;
        const conversionRate = resolved > 0 ? (won / resolved) * 100 : 0;

        return {
          id: profile.id,
          name: profile.full_name || profile.email?.split("@")[0] || "Usuário",
          email: profile.email,
          avatar_url: profile.avatar_url,
          teamName: team?.name || null,
          teamColor: team?.color || null,
          totalServed,
          resolvedInPeriod: resolved,
          wonInPeriod: won,
          lostInPeriod: lost,
          postponedInPeriod: postponed,
          conversionRate: Math.round(conversionRate * 10) / 10,
        };
      });

      agentStats.sort((a, b) => b.totalServed - a.totalServed);
      setAgents(agentStats);
    } catch (error) {
      console.error("Erro ao buscar performance dos agentes:", error);
    } finally {
      setLoading(false);
      setIsFirstLoad(false);
    }
  }, [currentOrganization?.id, dateRangeStr]);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchAgentPerformance(false);
    }, 500);
  }, [fetchAgentPerformance]);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchAgentPerformance(true);
    }
  }, [currentOrganization?.id, dateRangeStr, fetchAgentPerformance]);

  useEffect(() => {
    if (!currentOrganization?.id) return;

    const channel = supabase
      .channel('agent-performance-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_resolutions'
      }, debouncedFetch)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chats'
      }, debouncedFetch)
      .subscribe();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id, debouncedFetch]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="bg-card/30 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-white/5 bg-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Trophy className="h-5 w-5 text-amber-500 shadow-sm" />
            </div>
            <CardTitle className="text-lg font-black tracking-tight uppercase">Performance por Agente</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] font-black tracking-tighter uppercase border-white/10">Realtime</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading && isFirstLoad ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                <Skeleton className="h-14 w-14 rounded-full bg-white/5" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40 bg-white/5" />
                  <Skeleton className="h-4 w-24 bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest opacity-50">Nenhum agente encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto custom-scrollbar">
            {agents.map((agent, index) => (
              <div
                key={agent.id}
                className={cn(
                  "p-6 transition-all duration-300 group hover:bg-white/5",
                  index === 0 && agents[0].totalServed > 0 && "bg-amber-500/5"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="relative">
                      <Avatar className="h-14 w-14 border-2 border-white/10 group-hover:border-white/20 transition-colors shadow-lg">
                        <AvatarImage src={agent.avatar_url || undefined} className="object-cover" />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary font-black text-xl">
                          {getInitials(agent.name)}
                        </AvatarFallback>
                      </Avatar>
                      {index === 0 && agents[0].totalServed > 0 && (
                        <div className="absolute -top-2 -right-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full p-1 shadow-lg ring-2 ring-background animate-bounce duration-1000">
                          <Trophy className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <h4 className="font-black tracking-tight text-lg group-hover:text-primary transition-colors">{agent.name}</h4>
                      {agent.teamName && (
                        <div className="flex items-center mt-1">
                          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: agent.teamColor || 'gray' }} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            {agent.teamName}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 flex-1">
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 group-hover:border-blue-500/30 transition-all">
                      <UserCheck className="h-4 w-4 text-blue-500 mb-1 opacity-70" />
                      <span className="font-black text-lg tracking-tighter">{agent.totalServed}</span>
                      <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">Contatos</span>
                    </div>

                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 group-hover:border-violet-500/30 transition-all">
                      <Target className="h-4 w-4 text-violet-500 mb-1 opacity-70" />
                      <span className="font-black text-lg tracking-tighter">{agent.resolvedInPeriod}</span>
                      <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">Resolv.</span>
                    </div>

                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-green-500/5 border border-green-500/10 group-hover:border-green-500/40 transition-all">
                      <TrendingUp className="h-4 w-4 text-green-500 mb-1" />
                      <span className="font-black text-lg tracking-tighter text-green-500">{agent.wonInPeriod}</span>
                      <span className="text-[9px] font-bold text-green-500/60 uppercase">Ganhos</span>
                    </div>

                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-red-500/5 border border-red-500/10 group-hover:border-red-500/40 transition-all">
                      <TrendingDown className="h-4 w-4 text-red-500 mb-1" />
                      <span className="font-black text-lg tracking-tighter text-red-500">{agent.lostInPeriod}</span>
                      <span className="text-[9px] font-bold text-red-500/60 uppercase">Perdas</span>
                    </div>

                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 group-hover:border-amber-500/40 transition-all">
                      <Clock className="h-4 w-4 text-amber-500 mb-1" />
                      <span className="font-black text-lg tracking-tighter text-amber-500">{agent.postponedInPeriod}</span>
                      <span className="text-[9px] font-bold text-amber-500/60 uppercase">Adiadas</span>
                    </div>

                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-primary/5 border border-primary/10 group-hover:border-primary/40 transition-all relative overflow-hidden">
                      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="text-[9px] font-black text-muted-foreground/60 uppercase mb-1 z-10">Conv.</span>
                      <span className={cn(
                        "font-black text-lg tracking-tighter z-10",
                        agent.conversionRate >= 50 ? "text-green-500" :
                          agent.conversionRate >= 25 ? "text-amber-500" : "text-red-500"
                      )}>
                        {agent.conversionRate}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentPerformanceAnalysis;
