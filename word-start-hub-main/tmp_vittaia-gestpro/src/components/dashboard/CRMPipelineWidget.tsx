import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Layers, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FunnelSummary {
  id: string;
  name: string;
  stages: { id: string; name: string; color: string; count: number }[];
  totalLeads: number;
}

export default function CRMPipelineWidget() {
  const { currentOrganization } = useOrganization();
  const [funnels, setFunnels] = useState<FunnelSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const [funnelsRes, stagesRes, assignmentsRes] = await Promise.all([
        (supabase as any).from("funnels").select("id, name").eq("organization_id", currentOrganization.id).order("created_at"),
        (supabase as any).from("funnel_stages").select("id, name, color, funnel_id, order_position").eq("organization_id", currentOrganization.id).order("order_position"),
        (supabase as any).from("chat_funnel_stage").select("stage_id").eq("organization_id", currentOrganization.id),
      ]);

      const stageCounts: Record<string, number> = {};
      (assignmentsRes.data || []).forEach((a: any) => {
        stageCounts[a.stage_id] = (stageCounts[a.stage_id] || 0) + 1;
      });

      const stagesByFunnel: Record<string, any[]> = {};
      (stagesRes.data || []).forEach((s: any) => {
        if (!stagesByFunnel[s.funnel_id]) stagesByFunnel[s.funnel_id] = [];
        stagesByFunnel[s.funnel_id].push({
          id: s.id,
          name: s.name,
          color: s.color || "#888",
          count: stageCounts[s.id] || 0,
        });
      });

      const summaries: FunnelSummary[] = (funnelsRes.data || []).map((f: any) => {
        const stages = stagesByFunnel[f.id] || [];
        return {
          id: f.id,
          name: f.name,
          stages,
          totalLeads: stages.reduce((sum: number, s: any) => sum + s.count, 0),
        };
      });

      setFunnels(summaries.filter(f => f.stages.length > 0).slice(0, 3));
    } catch (e) {
      console.error("CRM widget error:", e);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Card className="glass overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Layers className="h-5 w-5 text-violet-500" />
          </div>
          <CardTitle className="text-lg font-bold">Pipeline CRM</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-20 bg-muted/20" />)}
          </div>
        ) : funnels.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum funil configurado</p>
        ) : (
          funnels.map(funnel => (
            <div key={funnel.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{funnel.name}</span>
                <Badge variant="secondary" className="text-[10px] font-bold">
                  {funnel.totalLeads} leads
                </Badge>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {funnel.stages.map((stage, i) => {
                  const maxCount = Math.max(...funnel.stages.map(s => s.count), 1);
                  const opacity = 0.3 + (stage.count / maxCount) * 0.7;
                  return (
                    <div key={stage.id} className="flex items-center gap-1 shrink-0">
                      <div
                        className="px-2 py-1.5 rounded-lg text-center min-w-[60px] transition-all hover:scale-105"
                        style={{
                          backgroundColor: `${stage.color}${Math.round(opacity * 40).toString(16).padStart(2, '0')}`,
                          borderLeft: `3px solid ${stage.color}`,
                        }}
                      >
                        <p className="text-lg font-black leading-none">{stage.count}</p>
                        <p className="text-[9px] font-bold text-muted-foreground truncate max-w-[70px]">{stage.name}</p>
                      </div>
                      {i < funnel.stages.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
