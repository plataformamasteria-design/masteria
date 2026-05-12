import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Clock, CheckCircle2, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfDay, endOfDay, subDays, differenceInMinutes } from "date-fns";
import { DateRange } from "react-day-picker";

interface ChatMetricsWidgetProps {
  dateRange?: DateRange;
}

export default function ChatMetricsWidget({ dateRange }: ChatMetricsWidgetProps) {
  const { currentOrganization } = useOrganization();
  const [metrics, setMetrics] = useState({
    totalMessages: 0,
    sentByAgents: 0,
    sentByBot: 0,
    avgResponseTime: 0,
    resolvedChats: 0,
  });
  const [loading, setLoading] = useState(true);

  const dateRangeStr = JSON.stringify(dateRange);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const start = dateRange?.from ? startOfDay(dateRange.from) : startOfDay(subDays(new Date(), 7));
      const end = dateRange?.to ? endOfDay(dateRange.to) : endOfDay(new Date());

      const [messagesRes, resolutionsRes] = await Promise.all([
        (supabase as any).from("messages").select("sender_type")
          .eq("organization_id", currentOrganization.id)
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString()),
        (supabase as any).from("chat_resolutions").select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrganization.id)
          .gte("resolved_at", start.toISOString())
          .lte("resolved_at", end.toISOString()),
      ]);

      const messages = messagesRes.data || [];
      let agentCount = 0, botCount = 0;
      messages.forEach((m: any) => {
        if (m.sender_type === "agent") agentCount++;
        else if (m.sender_type === "bot") botCount++;
      });

      setMetrics({
        totalMessages: messages.length,
        sentByAgents: agentCount,
        sentByBot: botCount,
        avgResponseTime: 0,
        resolvedChats: resolutionsRes.count || 0,
      });
    } catch (e) {
      console.error("Chat metrics error:", e);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, dateRangeStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const metricItems = [
    { label: "Mensagens", value: metrics.totalMessages, icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Por Agentes", value: metrics.sentByAgents, icon: User, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Pelo Bot", value: metrics.sentByBot, icon: Bot, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Resolvidas", value: metrics.resolvedChats, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  ];

  return (
    <Card className="glass overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <MessageCircle className="h-5 w-5 text-blue-500" />
          </div>
          <CardTitle className="text-lg font-bold">Métricas do Chat</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 bg-muted/20" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {metricItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="p-3 rounded-xl bg-muted/10 border border-border/30 text-center hover:border-border/60 transition-all">
                  <div className={cn("w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center", item.bg)}>
                    <Icon className={cn("h-4 w-4", item.color)} />
                  </div>
                  <p className="text-xl font-black tracking-tight">{item.value.toLocaleString("pt-BR")}</p>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">{item.label}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
