import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import PagePermissionGuard from "@/components/PagePermissionGuard";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { CRMBoard } from "@/components/crm/CRMBoard";
import { FunnelConfigDialog } from "@/components/crm/FunnelConfigDialog";
import { FunnelAutoAssignDialog } from "@/components/automations/FunnelAutoAssignDialog";
import { Button } from "@/components/ui/button";
import { Plus, Settings2, User, GitMerge } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Stage {
  id: string;
  name: string;
  color: string;
  order_position: number;
  funnel_id: string;
}

interface Funnel {
  id: string;
  name: string;
  is_public: boolean;
}



export default function CRM() {
  const { currentOrganization } = useOrganization();
  const [allFunnels, setAllFunnels] = useState<Funnel[]>([]);
  const [_myFunnelIds, setMyFunnelIds] = useState<Set<string>>(new Set());
  const [stagesByFunnel, setStagesByFunnel] = useState<Record<string, Stage[]>>({});
  const [activeFunnelId, setActiveFunnelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [funnelAssignOpen, setFunnelAssignOpen] = useState(false);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setCurrentUserId(data.session?.user?.id || null));
  }, []);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id || !currentUserId) return;

    const [funnelsRes, stagesRes, membersRes] = await Promise.all([
      (supabase as any)
        .from("funnels")
        .select("id, name, is_public")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: true }),
      (supabase as any)
        .from("funnel_stages")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("order_position", { ascending: true }),
      (supabase as any)
        .from("funnel_members")
        .select("funnel_id")
        .eq("user_id", currentUserId)
        .eq("organization_id", currentOrganization.id),
    ]);

    const funnelData = (funnelsRes.data || []) as Funnel[];
    const stageData = (stagesRes.data || []) as Stage[];
    const memberFunnelIds = new Set((membersRes.data || []).map((m: any) => m.funnel_id));

    setAllFunnels(funnelData);
    setMyFunnelIds(memberFunnelIds as Set<string>);

    const grouped: Record<string, Stage[]> = {};
    stageData.forEach((s) => {
      if (!grouped[s.funnel_id]) grouped[s.funnel_id] = [];
      grouped[s.funnel_id].push(s);
    });
    setStagesByFunnel(grouped);

    setLoading(false);
  }, [currentOrganization?.id, currentUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-select first funnel
  useEffect(() => {
    if (allFunnels.length > 0) {
      if (!activeFunnelId || !allFunnels.find((f) => f.id === activeFunnelId)) {
        setActiveFunnelId(allFunnels[0].id);
      }
    } else {
      setActiveFunnelId(null);
    }
  }, [allFunnels, activeFunnelId]);

  const activeFunnel = allFunnels.find((f) => f.id === activeFunnelId);
  const activeStages = activeFunnelId ? (stagesByFunnel[activeFunnelId] || []) : [];

  const handleCreateNew = () => {
    setEditingFunnel(null);
    setConfigOpen(true);
  };

  const handleEditFunnel = (funnel: Funnel) => {
    setEditingFunnel(funnel);
    setConfigOpen(true);
  };

  return (
    <PagePermissionGuard page="pipeline">
      <AppShell noPadding>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Top Bar */}
          <div className="shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center h-12 px-4 gap-2">
              {/* Funnel Tabs */}
              <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
                {loading ? (
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-28 rounded-md" />
                    <Skeleton className="h-8 w-28 rounded-md" />
                  </div>
                ) : (
                  allFunnels.map((funnel) => {
                    const stageCount = stagesByFunnel[funnel.id]?.length || 0;
                    const isActive = activeFunnelId === funnel.id;
                    return (
                      <div key={funnel.id} className="flex items-center shrink-0">
                        <button
                          onClick={() => setActiveFunnelId(funnel.id)}
                          className={cn(
                            "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          {funnel.name}
                          {!funnel.is_public && (
                            <User className="h-3 w-3 opacity-50" />
                          )}
                          <span className="text-[10px] font-normal opacity-60">{stageCount}</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditFunnel(funnel); }}
                          className="ml-0.5 p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Configurar funil"
                        >
                          <Settings2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setFunnelAssignOpen(true)}
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Atribuição de Funil</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleCreateNew}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Novo Funil</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Board Content */}
          <div className="flex-1 overflow-hidden p-3">
            {loading ? (
              <div className="flex gap-3 h-full">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-80 shrink-0 space-y-3">
                    <Skeleton className="h-8 w-full rounded-md" />
                    <Skeleton className="h-24 w-full rounded-lg" />
                    <Skeleton className="h-24 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            ) : !activeFunnel ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <Plus className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Nenhum funil criado</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Crie seu primeiro funil de vendas para começar a gerenciar leads
                  </p>
                </div>
                <Button onClick={handleCreateNew} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Funil
                </Button>
              </div>
            ) : activeStages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div>
                  <h3 className="text-lg font-semibold">Funil sem etapas</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure as etapas deste funil para começar
                  </p>
                </div>
                <Button onClick={() => handleEditFunnel(activeFunnel)} variant="outline" className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  Configurar Etapas
                </Button>
              </div>
            ) : (
              <CRMBoard
                funnelId={activeFunnel.id}
                stages={activeStages}
              />
            )}
          </div>
        </div>

        {/* Funnel Config Dialog */}
        <FunnelConfigDialog
          open={configOpen}
          onOpenChange={setConfigOpen}
          funnelId={editingFunnel?.id}
          funnelName={editingFunnel?.name}
          funnelIsPublic={editingFunnel?.is_public}
          onSaved={fetchData}
        />

        <FunnelAutoAssignDialog
          open={funnelAssignOpen}
          onOpenChange={setFunnelAssignOpen}
          funnels={allFunnels}
          stages={Object.values(stagesByFunnel).flat()}
        />
      </AppShell>
    </PagePermissionGuard>
  );
}
