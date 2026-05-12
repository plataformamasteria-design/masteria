import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Phone, MessageSquare, Calendar, Send, Handshake, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cn } from "@/lib/utils";

interface GoalWithProgress {
  goal_type: string;
  target_value: number;
  current_value: number;
  user_name: string;
  user_id: string;
}

const GOAL_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  contacts_per_day: { label: "Contatos", icon: Phone, color: "text-blue-500" },
  follow_ups_per_day: { label: "Follow-ups", icon: Send, color: "text-violet-500" },
  meetings_per_day: { label: "Reuniões", icon: Calendar, color: "text-emerald-500" },
  messages_per_day: { label: "Mensagens", icon: MessageSquare, color: "text-amber-500" },
  proposals_per_day: { label: "Propostas", icon: Handshake, color: "text-orange-500" },
  deals_per_day: { label: "Fechamentos", icon: CheckCircle2, color: "text-green-500" },
};

const TRACKING_MAP: Record<string, string> = {
  contacts_per_day: "contacts_made",
  follow_ups_per_day: "follow_ups_sent",
  meetings_per_day: "meetings_done",
  messages_per_day: "messages_sent",
  proposals_per_day: "proposals_sent",
  deals_per_day: "deals_closed",
};

export default function ActivityGoalsWidget() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    const load = async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];

        const [{ data: goalsData }, { data: trackingData }, { data: profiles }] = await Promise.all([
          (supabase as any)
            .from("activity_goals")
            .select("user_id, goal_type, target_value")
            .eq("organization_id", orgId)
            .eq("active", true),
          (supabase as any)
            .from("activity_tracking")
            .select("user_id, contacts_made, follow_ups_sent, meetings_done, messages_sent, proposals_sent, deals_closed")
            .eq("organization_id", orgId)
            .eq("tracking_date", today),
          (supabase as any)
            .from("profiles")
            .select("id, full_name, email")
            .eq("organization_id", orgId),
        ]);

        if (!goalsData || goalsData.length === 0) {
          setGoals([]);
          setLoading(false);
          return;
        }

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name || p.email || "Usuário"]));
        const trackingMap = new Map((trackingData || []).map((t: any) => [t.user_id, t]));

        const merged: GoalWithProgress[] = goalsData.map((g: any) => {
          const tracking = trackingMap.get(g.user_id) || {};
          const field = TRACKING_MAP[g.goal_type] || "";
          return {
            goal_type: g.goal_type,
            target_value: g.target_value,
            current_value: Number(tracking[field] || 0),
            user_name: profileMap.get(g.user_id) || "Usuário",
            user_id: g.user_id,
          };
        });

        setGoals(merged);
      } catch (e) {
        console.error("[ActivityGoalsWidget]", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orgId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2"><Skeleton className="h-5 w-44" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  // Group by user
  const byUser = new Map<string, GoalWithProgress[]>();
  goals.forEach(g => {
    const arr = byUser.get(g.user_id) || [];
    arr.push(g);
    byUser.set(g.user_id, arr);
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-500" />
          Metas de Atividade (Hoje)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {goals.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhuma meta configurada. Configure em Configurações.
          </p>
        ) : (
          <div className="space-y-4">
            {Array.from(byUser.entries()).map(([userId, userGoals]) => (
              <div key={userId} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{userGoals[0].user_name}</p>
                {userGoals.map((g, idx) => {
                  const config = GOAL_CONFIG[g.goal_type] || { label: g.goal_type, icon: Activity, color: "text-muted-foreground" };
                  const Icon = config.icon;
                  const pct = g.target_value > 0 ? Math.min(100, (g.current_value / g.target_value) * 100) : 0;
                  const completed = pct >= 100;

                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", config.color)} />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium">{config.label}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {g.current_value}/{g.target_value}
                          </span>
                        </div>
                        <Progress value={pct} className={cn("h-1.5", completed && "[&>div]:bg-emerald-500")} />
                      </div>
                      {completed && (
                        <Badge variant="outline" className="text-[9px] text-emerald-500 border-emerald-500/30 shrink-0">
                          ✓
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
