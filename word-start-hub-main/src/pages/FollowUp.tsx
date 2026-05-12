import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import PagePermissionGuard from "@/components/PagePermissionGuard";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Clock, Users, TrendingDown, ArrowDownCircle, Check, X } from "lucide-react";
import { supabase as supabaseOriginal } from "@/integrations/supabase/client";
const supabase = supabaseOriginal as any;
import SequenceManager from "@/components/followup/SequenceManager";
import LeadTrackingTable from "@/components/followup/LeadTrackingTable";
import { useOrganization } from "@/contexts/OrganizationContext";

const FollowUp = () => {
  const { currentOrganization } = useOrganization();
  const [stats, setStats] = useState({
    totalInFollowUp: 0,
    readyToSend: 0,
    responded: 0,
    lost: 0,
  });

  useEffect(() => {
    if (!currentOrganization?.id) return;
    
    fetchStats();

    const channel = supabase
      .channel('follow_up_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_follow_up_tracking'
        },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_tags'
        },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id]);

  const fetchStats = async () => {
    if (!currentOrganization?.id) return;
    
    try {
      const { count: totalInFollowUp } = await supabase
        .from('lead_follow_up_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .eq('completed', false)
        .eq('responded', false);

      const { count: readyToSend } = await supabase
        .from('lead_follow_up_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .eq('completed', false)
        .eq('responded', false)
        .lte('next_trigger_at', new Date().toISOString());

      const { count: responded } = await supabase
        .from('lead_follow_up_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .eq('responded', true);

      const { count: lost } = await supabase
        .from('lead_follow_up_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .eq('completed', true)
        .eq('responded', false);

      setStats({
        totalInFollowUp: totalInFollowUp || 0,
        readyToSend: readyToSend || 0,
        responded: responded || 0,
        lost: lost || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const statCards = [
    {
      title: "Em Follow-up",
      value: stats.totalInFollowUp,
      icon: Users,
      subtitle: "Leads ativos",
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Prontos para Envio",
      value: stats.readyToSend,
      icon: ArrowDownCircle,
      subtitle: "Aguardando processamento",
      color: "text-amber-600",
      bgColor: "bg-amber-500/10"
    },
    {
      title: "Responderam",
      value: stats.responded,
      icon: Check,
      subtitle: "Leads convertidos",
      color: "text-green-600",
      bgColor: "bg-green-500/10"
    },
    {
      title: "Perdidos",
      value: stats.lost,
      icon: X,
      subtitle: "Sem resposta",
      color: "text-destructive",
      bgColor: "bg-destructive/10"
    }
  ];

  return (
    <AppShell>
      <PagePermissionGuard page="followup">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <MessageCircle className="h-6 w-6 text-primary" />
                Follow Up Automático
              </h1>
              <p className="text-muted-foreground mt-1">
                Configure sequências de mensagens automáticas para engajar seus leads
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-200 hover:border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm font-medium text-foreground">{stat.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {stat.subtitle}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Sequence Manager */}
          <SequenceManager onUpdate={fetchStats} />
          
          {/* Lead Tracking Table */}
          <LeadTrackingTable />
        </div>
      </PagePermissionGuard>
    </AppShell>
  );
};

export default FollowUp;
