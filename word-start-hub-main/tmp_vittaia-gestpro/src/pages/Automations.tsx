import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import PagePermissionGuard from "@/components/PagePermissionGuard";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationModules, MODULE_DEFINITIONS } from "@/hooks/useOrganizationModules";
import { AutomationList } from "@/components/automations/AutomationList";
import { AutomationCreateDialog } from "@/components/automations/AutomationCreateDialog";
import { KommoImportDialog } from "@/components/automations/KommoImportDialog";
import { ImportAutomationDialog } from "@/components/automations/ImportAutomationDialog";
import { DynamicPromptEditor } from "@/components/developer/DynamicPromptEditor";
import { AutoMessagesSettings } from "@/components/developer/AutoMessagesSettings";
import { Button } from "@/components/ui/button";
import { Plus, Search, Upload, Workflow, Sparkles, MessageSquare, Lock, ShieldAlert, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface Automation {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused";
  funnel_id: string | null;
  trigger_stage_id: string | null;
  trigger_type: string;
  created_at: string;
  updated_at: string;
  webhook_token?: string | null;
  schedule_config?: { interval: number; unit: string } | null;
}

export interface Funnel {
  id: string;
  name: string;
}

export interface FunnelStage {
  id: string;
  name: string;
  color: string;
  funnel_id: string;
  order_position: number;
}

function LockedTabContent({ moduleKey }: { moduleKey: string }) {
  const moduleDef = MODULE_DEFINITIONS[moduleKey];
  return (
    <div className="flex items-center justify-center py-16">
      <Card className="max-w-sm w-full shadow-lg border-border/50">
        <CardHeader className="text-center pb-2 pt-5">
          <div className="mx-auto mb-2 h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg">Módulo Bloqueado</CardTitle>
          <CardDescription className="text-sm">
            Esta funcionalidade requer o módulo{' '}
            <span className="font-semibold text-foreground">{moduleDef?.label || moduleKey}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pb-5">
          {moduleDef && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                O que este módulo inclui:
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {moduleDef.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Entre em contato com o administrador para contratar este módulo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Automations() {
  const { currentOrganization, isSuperAdmin } = useOrganization();
  const { hasModule } = useOrganizationModules();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "ia" ? "ia" : searchParams.get("tab") === "mensagens" ? "mensagens" : "fluxo";

  const canFluxo = isSuperAdmin || hasModule('automacao_simples');
  const canIA = isSuperAdmin || hasModule('atendente_ia');

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [executionCounts, setExecutionCounts] = useState<Record<string, number>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [kommoImportOpen, setKommoImportOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return;

    const [automationsRes, funnelsRes, stagesRes, execRes] = await Promise.all([
      (supabase as any)
        .from("automations")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("funnels")
        .select("id, name")
        .eq("organization_id", currentOrganization.id),
      (supabase as any)
        .from("funnel_stages")
        .select("id, name, color, funnel_id, order_position")
        .eq("organization_id", currentOrganization.id)
        .order("order_position"),
      (supabase as any)
        .from("automation_executions")
        .select("automation_id")
        .eq("organization_id", currentOrganization.id),
    ]);

    setAutomations((automationsRes.data || []) as Automation[]);
    setFunnels((funnelsRes.data || []) as Funnel[]);
    setStages((stagesRes.data || []) as FunnelStage[]);

    const counts: Record<string, number> = {};
    (execRes.data || []).forEach((e: any) => {
      counts[e.automation_id] = (counts[e.automation_id] || 0) + 1;
    });
    setExecutionCounts(counts);
    setLoading(false);
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any)
      .from("automations")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Erro ao excluir automação" });
    } else {
      toast({ title: "Automação excluída" });
      fetchData();
    }
  };

  const handleToggleStatus = async (automation: Automation) => {
    const newStatus = automation.status === "active" ? "paused" : "active";
    const { error } = await (supabase as any)
      .from("automations")
      .update({ status: newStatus })
      .eq("id", automation.id);

    if (error) {
      toast({ variant: "destructive", title: "Erro ao atualizar status" });
    } else {
      toast({ title: `Automação ${newStatus === "active" ? "ativada" : "pausada"}` });
      fetchData();
    }
  };

  const filteredAutomations = automations.filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PagePermissionGuard page="automations">
      <AppShell>
        <div className="flex flex-col gap-6 h-full">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold">Automações</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie fluxos automatizados, prompt I.A e mensagens automáticas
            </p>
          </div>

          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="fluxo" className="gap-2">
                <Workflow className="h-4 w-4" />
                <span className="hidden sm:inline">Automação por Fluxo</span>
                <span className="sm:hidden">Fluxo</span>
                {!canFluxo && <Lock className="h-3 w-3 text-muted-foreground" />}
              </TabsTrigger>
              <TabsTrigger value="ia" className="gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Automação I.A</span>
                <span className="sm:hidden">I.A</span>
                {!canIA && <Lock className="h-3 w-3 text-muted-foreground" />}
              </TabsTrigger>
              <TabsTrigger value="mensagens" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Mensagens Automáticas</span>
                <span className="sm:hidden">Mensagens</span>
              </TabsTrigger>
            </TabsList>

            {/* Automação por Fluxo */}
            <TabsContent value="fluxo" className="mt-6 space-y-6">
              {canFluxo ? (
                <>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="relative max-w-sm w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar automações..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
                        <Upload className="h-4 w-4" />
                        Importar
                      </Button>
                      <Button variant="outline" onClick={() => setKommoImportOpen(true)} className="gap-2">
                        <Upload className="h-4 w-4" />
                        Importar Kommo
                      </Button>
                      <Button onClick={() => { setEditingAutomation(null); setCreateOpen(true); }} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nova Automação
                      </Button>
                    </div>
                  </div>

                  {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-48 rounded-xl" />
                      ))}
                    </div>
                  ) : filteredAutomations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                        <Plus className="h-7 w-7 text-muted-foreground/50" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-semibold">
                          {searchTerm ? "Nenhuma automação encontrada" : "Nenhuma automação criada"}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {searchTerm
                            ? "Tente buscar com outro termo"
                            : "Crie sua primeira automação para começar a automatizar o atendimento"}
                        </p>
                      </div>
                      {!searchTerm && (
                        <Button onClick={() => setCreateOpen(true)} className="gap-2">
                          <Plus className="h-4 w-4" />
                          Criar Automação
                        </Button>
                      )}
                    </div>
                  ) : (
                    <AutomationList
                      automations={filteredAutomations}
                      funnels={funnels}
                      stages={stages}
                      executionCounts={executionCounts}
                      onEdit={(a) => { setEditingAutomation(a); setCreateOpen(true); }}
                      onDelete={handleDelete}
                      onToggleStatus={handleToggleStatus}
                    />
                  )}
                </>
              ) : (
                <LockedTabContent moduleKey="automacao_simples" />
              )}
            </TabsContent>

            {/* Automação I.A */}
            <TabsContent value="ia" className="mt-6 space-y-6">
              {canIA ? (
                <DynamicPromptEditor />
              ) : (
                <LockedTabContent moduleKey="atendente_ia" />
              )}
            </TabsContent>

            {/* Mensagens Automáticas */}
            <TabsContent value="mensagens" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Mensagens automáticas
                  </CardTitle>
                  <CardDescription>
                    Configure boas-vindas, ausência e horários de atendimento.
                  </CardDescription>
                </CardHeader>
                <AutoMessagesSettings />
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <AutomationCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          automation={editingAutomation}
          funnels={funnels}
          stages={stages}
          onSaved={fetchData}
        />

        <KommoImportDialog
          open={kommoImportOpen}
          onOpenChange={setKommoImportOpen}
          onImported={fetchData}
        />

        <ImportAutomationDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={fetchData}
        />
      </AppShell>
    </PagePermissionGuard>
  );
}
