import { useState, useEffect } from "react";
import { supabase as supabaseOriginal } from "@/integrations/supabase/client";
const supabase = supabaseOriginal as any;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import FunnelVisualization from "./FunnelVisualization";
import {
  Pencil, Trash2, Users, ChevronDown, ChevronRight,
  BarChart3, PieChart, BarChart, LayoutGrid,
  Plus, X, FolderOpen, Tags, GitBranch,
  DollarSign, Calendar, Workflow, Database,
  TrendingUp, Activity, ListChecks
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Tag {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface TagGroup {
  id: string;
  name: string;
  color: string;
  tag_ids: string[];
}

interface Funnel {
  id: string;
  name: string;
  visualization_type: "funnel" | "pie" | "bar" | "kanban";
  tag_order: string[];
  data_source: "tags" | "crm" | "automations" | "finance" | "events";
  config: any;
}

const DATA_SOURCES = [
  { value: "tags" as const, label: "Etiquetas", icon: Tags, description: "Baseado em tags de chat" },
  { value: "crm" as const, label: "CRM", icon: GitBranch, description: "Funis de vendas e etapas" },
  { value: "finance" as const, label: "Financeiro", icon: DollarSign, description: "Métricas de transações" },
  { value: "events" as const, label: "Agenda", icon: Calendar, description: "Métricas de agendamentos" },
  { value: "automations" as const, label: "Automações", icon: Workflow, description: "Fluxos e conversões" },
];

const VIZ_OPTIONS_BY_SOURCE: Record<string, { value: string; label: string; icon: any; description: string }[]> = {
  tags: [
    { value: "funnel", label: "Funil", icon: BarChart3, description: "Etapas de conversão" },
    { value: "pie", label: "Pizza", icon: PieChart, description: "Distribuição proporcional" },
    { value: "bar", label: "Barras", icon: BarChart, description: "Comparação lado a lado" },
    { value: "kanban", label: "Kanban", icon: LayoutGrid, description: "Quadro de cards" },
  ],
  crm: [
    { value: "funnel", label: "Funil", icon: BarChart3, description: "Pipeline de vendas" },
    { value: "bar", label: "Barras", icon: BarChart, description: "Leads por etapa" },
    { value: "pie", label: "Pizza", icon: PieChart, description: "Distribuição por etapa" },
  ],
  automations: [
    { value: "funnel", label: "Fluxo", icon: Activity, description: "Nó a nó com conversão" },
    { value: "bar", label: "Barras", icon: BarChart, description: "Alcance por nó" },
    { value: "pie", label: "Pizza", icon: PieChart, description: "Distribuição de status" },
  ],
  finance: [
    { value: "bar", label: "Barras", icon: BarChart, description: "Receita por categoria" },
    { value: "pie", label: "Pizza", icon: PieChart, description: "Proporção de receita" },
    { value: "funnel", label: "Funil", icon: TrendingUp, description: "Funil de valores" },
  ],
  events: [
    { value: "pie", label: "Pizza", icon: PieChart, description: "Status dos eventos" },
    { value: "bar", label: "Barras", icon: BarChart, description: "Contagem por status" },
    { value: "funnel", label: "Funil", icon: ListChecks, description: "Funil de agendamentos" },
  ],
};

const FunnelBuilder = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [crmFunnels, setCrmFunnels] = useState<any[]>([]);
  const [automationsList, setAutomationsList] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [perLeadMode, setPerLeadMode] = useState<Record<string, boolean>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [newFunnel, setNewFunnel] = useState<{
    name: string;
    visualization_type: "funnel" | "pie" | "bar" | "kanban";
    tag_order: string[];
    data_source: "tags" | "crm" | "automations" | "finance" | "events";
    config: any;
  }>({
    name: "",
    visualization_type: "funnel",
    tag_order: [],
    data_source: "tags",
    config: {},
  });

  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchTags();
      fetchFunnels();
      fetchGroups();
      fetchCrmFunnels();
      fetchAutomations();
    }
  }, [currentOrganization?.id]);

  const fetchTags = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase.from('tags').select('*').eq('organization_id', currentOrganization.id).order('order_position', { ascending: true });
    setTags(data || []);
  };

  const fetchFunnels = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase.from('funnels').select('*').eq('organization_id', currentOrganization.id).order('created_at', { ascending: false });
    setFunnels((data || []) as Funnel[]);
  };

  const fetchGroups = async () => {
    if (!currentOrganization?.id) return;
    const { data: groupsData } = await supabase.from("tag_groups").select("*").eq("organization_id", currentOrganization.id);
    if (!groupsData) { setGroups([]); return; }
    const { data: membersData } = await supabase.from("tag_group_members").select("group_id, tag_id").eq("organization_id", currentOrganization.id);
    const result: TagGroup[] = groupsData.map((g: any) => ({
      id: g.id,
      name: g.name,
      color: g.color || "#6B7280",
      tag_ids: (membersData || []).filter((m: any) => m.group_id === g.id).map((m: any) => m.tag_id),
    }));
    setGroups(result);
  };

  const fetchCrmFunnels = async () => {
    if (!currentOrganization?.id) return;
    // Only fetch funnels that have stages (real CRM funnels, not analytics)
    const { data: stages } = await supabase
      .from('funnel_stages')
      .select('funnel_id')
      .eq('organization_id', currentOrganization.id);
    const crmFunnelIds = [...new Set((stages || []).map((s: any) => s.funnel_id))];
    if (crmFunnelIds.length === 0) { setCrmFunnels([]); return; }
    const { data } = await supabase
      .from('funnels')
      .select('id, name')
      .eq('organization_id', currentOrganization.id)
      .in('id', crmFunnelIds);
    setCrmFunnels(data || []);
  };

  const fetchAutomations = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from('automations')
      .select('id, name, status')
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false });
    setAutomationsList(data || []);
  };

  const handleCreateFunnel = async () => {
    if (!newFunnel.name.trim()) {
      toast({ title: "Nome obrigatório", description: "Por favor, informe o nome da análise.", variant: "destructive" });
      return;
    }
    if (newFunnel.data_source === 'tags' && newFunnel.tag_order.length === 0) {
      toast({ title: "Selecione tags ou grupos", variant: "destructive" });
      return;
    }
    if (newFunnel.data_source === 'crm' && !newFunnel.config.funnel_id) {
      toast({ title: "Selecione um funil do CRM", variant: "destructive" });
      return;
    }
    if (newFunnel.data_source === 'automations' && !newFunnel.config.automation_id) {
      toast({ title: "Selecione uma automação", variant: "destructive" });
      return;
    }
    if (!currentOrganization?.id) return;
    try {
      const { error } = await supabase.from('funnels').insert({
        name: newFunnel.name,
        visualization_type: newFunnel.visualization_type,
        tag_order: newFunnel.tag_order,
        data_source: newFunnel.data_source,
        config: newFunnel.config,
        organization_id: currentOrganization.id,
      });
      if (error) throw error;
      toast({ title: "Análise criada!", description: `Análise "${newFunnel.name}" criada com sucesso.` });
      resetForm();
      fetchFunnels();
    } catch (error) {
      console.error('Error creating analysis:', error);
      toast({ title: "Erro ao criar análise", description: "Não foi possível criar a análise.", variant: "destructive" });
    }
  };

  const handleUpdateFunnel = async () => {
    if (!newFunnel.name.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    if (newFunnel.data_source === 'tags' && newFunnel.tag_order.length === 0) {
      toast({ title: "Selecione tags ou grupos", variant: "destructive" });
      return;
    }
    if (newFunnel.data_source === 'crm' && !newFunnel.config.funnel_id) {
      toast({ title: "Selecione um funil do CRM", variant: "destructive" });
      return;
    }
    if (newFunnel.data_source === 'automations' && !newFunnel.config.automation_id) {
      toast({ title: "Selecione uma automação", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("funnels").update({
      name: newFunnel.name,
      visualization_type: newFunnel.visualization_type,
      tag_order: newFunnel.tag_order,
      data_source: newFunnel.data_source,
      config: newFunnel.config,
    }).eq("id", editingId);
    if (error) { toast({ title: "Erro ao atualizar análise", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Análise atualizada com sucesso" });
    resetForm();
    fetchFunnels();
  };

  const handleEditFunnel = (funnel: Funnel) => {
    setNewFunnel({
      name: funnel.name,
      visualization_type: funnel.visualization_type,
      tag_order: funnel.tag_order || [],
      data_source: funnel.data_source || 'tags',
      config: funnel.config || {},
    });
    setEditingId(funnel.id);
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setNewFunnel({ name: "", visualization_type: "funnel", tag_order: [], data_source: "tags", config: {} });
    setShowCreateForm(false);
  };

  const toggleTag = (tagId: string) => {
    setNewFunnel(prev => ({
      ...prev,
      tag_order: prev.tag_order.includes(tagId) ? prev.tag_order.filter(id => id !== tagId) : [...prev.tag_order, tagId]
    }));
  };

  const toggleGroup = (groupId: string) => {
    const groupKey = `group:${groupId}`;
    setNewFunnel(prev => ({
      ...prev,
      tag_order: prev.tag_order.includes(groupKey)
        ? prev.tag_order.filter(id => id !== groupKey)
        : [...prev.tag_order, groupKey]
    }));
  };

  const handleDeleteFunnel = async (id: string) => {
    if (!confirm("Excluir esta análise?")) return;
    const { error } = await supabase.from("funnels").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir análise", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Análise excluída com sucesso" });
    fetchFunnels();
  };

  const togglePerLead = (funnelId: string) => {
    setPerLeadMode(prev => ({ ...prev, [funnelId]: !prev[funnelId] }));
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  const groupedTagIds = new Set(groups.flatMap(g => g.tag_ids));
  const ungroupedTags = tags.filter(t => !groupedTagIds.has(t.id));

  const getOrderItemLabel = (item: string) => {
    if (item.startsWith("group:")) {
      const groupId = item.replace("group:", "");
      const group = groups.find(g => g.id === groupId);
      return group ? `📁 ${group.name}` : "Grupo desconhecido";
    }
    const tag = tags.find(t => t.id === item);
    return tag?.name || "Tag desconhecida";
  };

  return (
    <div className="space-y-6">
      {!showCreateForm ? (
        <Button onClick={() => setShowCreateForm(true)} className="w-full gap-2 h-12 text-base" variant="outline">
          <Plus className="h-5 w-5" />
          Nova Análise
        </Button>
      ) : (
        <Card className="border-primary/30 shadow-lg animate-in fade-in zoom-in-95 duration-200">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                {editingId ? <Pencil className="h-5 w-5 text-primary" /> : <BarChart3 className="h-5 w-5 text-primary" />}
                {editingId ? "Editar Análise" : "Nova Análise"}
              </CardTitle>
              <Button size="icon" variant="ghost" onClick={resetForm} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="funnel-name">Nome da Análise</Label>
                <Input
                  id="funnel-name"
                  value={newFunnel.name}
                  onChange={(e) => setNewFunnel({ ...newFunnel, name: e.target.value })}
                  placeholder="Ex: Conversão de Vendas"
                  className="bg-muted/30"
                />
              </div>

              <div className="space-y-2">
                <Label>Fonte de Dados</Label>
                <div className="grid grid-cols-5 gap-1 p-1 bg-muted/30 rounded-lg border">
                  {DATA_SOURCES.map(source => {
                    const isSelected = newFunnel.data_source === source.value;
                    return (
                      <button
                        key={source.value}
                        type="button"
                        onClick={() => {
                          const vizOptions = VIZ_OPTIONS_BY_SOURCE[source.value] || VIZ_OPTIONS_BY_SOURCE.tags;
                          const currentVizValid = vizOptions.some(v => v.value === newFunnel.visualization_type);
                          setNewFunnel({
                            ...newFunnel,
                            data_source: source.value,
                            visualization_type: currentVizValid ? newFunnel.visualization_type : (vizOptions[0]?.value as any) || 'funnel',
                          });
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-md transition-all",
                          isSelected ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-background/50"
                        )}
                        title={source.description}
                      >
                        <source.icon className="h-4 w-4" />
                        <span className="text-[10px] mt-1 font-medium hidden sm:block">{source.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Visualization Selector - dynamic per source */}
            {(() => {
              const vizOptions = VIZ_OPTIONS_BY_SOURCE[newFunnel.data_source] || VIZ_OPTIONS_BY_SOURCE.tags;
              return (
                <div className="space-y-3">
                  <Label>Tipo de Visualização</Label>
                  <div className={cn("grid gap-3", vizOptions.length <= 3 ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4")}>
                    {vizOptions.map(opt => {
                      const isSelected = newFunnel.visualization_type === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNewFunnel({ ...newFunnel, visualization_type: opt.value as any })}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-left transition-all duration-200",
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border bg-card/50 hover:border-border/80 hover:bg-muted/10 font-normal"
                          )}
                        >
                          <opt.icon className={cn("h-6 w-6", isSelected ? "text-primary" : "text-muted-foreground")} />
                          <div className="flex flex-col">
                            <span className={cn("text-xs font-semibold", isSelected ? "text-primary" : "text-foreground")}>{opt.label}</span>
                            <span className="text-[9px] text-muted-foreground line-clamp-1">{opt.description}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="border-t pt-6">
              {/* Dynamic content based on data source */}
              {newFunnel.data_source === 'tags' && (
                <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                  <Label>Selecionar Tags e Grupos (em ordem)</Label>
                  <div className="space-y-3">
                    {groups.map(group => {
                      const groupKey = `group:${group.id}`;
                      const isGroupSelected = newFunnel.tag_order.includes(groupKey);
                      const isExpanded = expandedGroups.has(group.id);
                      const groupTags = group.tag_ids.map(tid => tags.find(t => t.id === tid)).filter(Boolean) as Tag[];
                      if (groupTags.length === 0) return null;
                      const position = newFunnel.tag_order.indexOf(groupKey);

                      return (
                        <div key={group.id} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                          <div className="flex items-center gap-2 px-3 py-2.5">
                            <button
                              type="button"
                              onClick={() => toggleGroupExpanded(group.id)}
                              className="p-1 rounded-md hover:bg-muted"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <div
                              className={cn(
                                "flex items-center gap-2 flex-1 cursor-pointer p-1 rounded-md transition-colors",
                                isGroupSelected ? "bg-primary/5 text-primary" : "hover:bg-muted/50"
                              )}
                              onClick={() => toggleGroup(group.id)}
                            >
                              <FolderOpen className="h-4 w-4 text-amber-500" />
                              <span className="text-sm font-medium">{group.name}</span>
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded-full">{groupTags.length}</span>
                              {isGroupSelected && (
                                <span className="ml-auto text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                                  {position + 1}º
                                </span>
                              )}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="flex flex-wrap gap-2 px-10 pb-3 animate-in fade-in duration-200">
                              {groupTags.map(tag => {
                                const isTagSelected = newFunnel.tag_order.includes(tag.id);
                                const tagPosition = newFunnel.tag_order.indexOf(tag.id);
                                return (
                                  <Button
                                    key={tag.id}
                                    type="button"
                                    variant={isTagSelected ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => toggleTag(tag.id)}
                                    className="gap-2 h-7 text-[11px] rounded-full"
                                  >
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                    {tag.name}
                                    {isTagSelected && <span className="ml-1 opacity-70">#{tagPosition + 1}</span>}
                                  </Button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {ungroupedTags.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-1">Tags Avulsas</p>
                        <div className="flex flex-wrap gap-2">
                          {ungroupedTags.map(tag => {
                            const isSelected = newFunnel.tag_order.includes(tag.id);
                            const position = newFunnel.tag_order.indexOf(tag.id);
                            return (
                              <Button
                                key={tag.id}
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() => toggleTag(tag.id)}
                                className="gap-2 h-8 rounded-full"
                              >
                                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: tag.color }} />
                                <span className="text-xs font-medium">{tag.name}</span>
                                {isSelected && <span className="ml-1 font-bold">#{position + 1}</span>}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {newFunnel.data_source === 'crm' && (
                <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                  <div className="p-8 border-2 border-dashed rounded-2xl flex flex-col items-center text-center gap-3 bg-muted/10">
                    <Database className="h-10 w-10 text-muted-foreground/30" />
                    <div>
                      <p className="font-semibold">Funnels de CRM</p>
                      <p className="text-sm text-muted-foreground">Esta opção usará etapas configuradas no CRM como as etapas do gráfico.</p>
                    </div>
                    <div className="w-full max-w-xs mt-2">
                      <Label className="text-left block mb-1.5">Selecione o Funil do CRM</Label>
                      <select
                        className="w-full bg-background border rounded-md h-9 px-3 text-sm"
                        value={newFunnel.config.funnel_id || ""}
                        onChange={(e) => setNewFunnel({ ...newFunnel, config: { ...newFunnel.config, funnel_id: e.target.value } })}
                      >
                        <option value="">Selecione um funil...</option>
                        {crmFunnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {newFunnel.data_source === 'automations' && (
                <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                  <div className="p-8 border-2 border-dashed rounded-2xl flex flex-col items-center text-center gap-3 bg-muted/10">
                    <Workflow className="h-10 w-10 text-muted-foreground/30" />
                    <div>
                      <p className="font-semibold">Análise de Automação</p>
                      <p className="text-sm text-muted-foreground">Selecione uma automação para visualizar métricas de conversão por nó do fluxo.</p>
                    </div>
                    <div className="w-full max-w-xs mt-2">
                      <Label className="text-left block mb-1.5">Selecione a Automação</Label>
                      <select
                        className="w-full bg-background border rounded-md h-9 px-3 text-sm"
                        value={newFunnel.config.automation_id || ""}
                        onChange={(e) => setNewFunnel({ ...newFunnel, config: { ...newFunnel.config, automation_id: e.target.value } })}
                      >
                        <option value="">Selecione uma automação...</option>
                        {automationsList.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} {a.status === 'active' ? '🟢' : '⚪'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {(newFunnel.data_source === 'finance' || newFunnel.data_source === 'events') && (
                <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                  <div className="p-12 border-2 border-dashed rounded-2xl flex flex-col items-center text-center gap-4 bg-muted/10">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      {(() => {
                        const Icon = DATA_SOURCES.find(s => s.value === newFunnel.data_source)?.icon;
                        return Icon ? <Icon className="h-8 w-8 text-primary" /> : null;
                      })()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Análise de {DATA_SOURCES.find(s => s.value === newFunnel.data_source)?.label}</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">Métricas automáticas serão exibidas com base no período selecionado.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-6 border-t">
              <Button onClick={editingId ? handleUpdateFunnel : handleCreateFunnel} className="flex-1 h-11 text-base shadow-lg shadow-primary/20">
                {editingId ? "Atualizar Análise" : "Criar Análise"}
              </Button>
              <Button onClick={resetForm} variant="outline" className="h-11">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing analyses */}
      <div className="grid gap-6 md:grid-cols-2">
        {funnels.map((funnel) => (
          <div key={funnel.id} className="group relative">
            <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {funnel.data_source === 'tags' && (
                <Button
                  size="sm"
                  variant={perLeadMode[funnel.id] ? "default" : "outline"}
                  onClick={() => togglePerLead(funnel.id)}
                  className="gap-1.5 h-8 bg-background/80 backdrop-blur-sm"
                  title="Contagem por lead único (sem duplicar leads com múltiplas tags)"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span className="text-[10px]">Por Lead</span>
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => handleEditFunnel(funnel)} className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:text-primary">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDeleteFunnel(funnel.id)} className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <FunnelVisualization
              funnel={funnel}
              tags={tags}
              groups={groups}
              perLead={!!perLeadMode[funnel.id]}
            />
          </div>
        ))}

        {funnels.length === 0 && !showCreateForm && (
          <div className="md:col-span-2 p-20 border-2 border-dashed rounded-3xl flex flex-col items-center text-center gap-4 bg-muted/5">
            <div className="h-20 w-20 rounded-3xl bg-primary/5 flex items-center justify-center">
              <BarChart3 className="h-10 w-10 text-primary/40" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Nenhuma análise criada</h3>
              <p className="text-muted-foreground mt-1">Sua conta ainda não possui dashboards de desempenho configurados.</p>
            </div>
            <Button onClick={() => setShowCreateForm(true)} variant="default" className="gap-2 px-8">
              <Plus className="h-5 w-5" />
              Começar agora
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FunnelBuilder;
