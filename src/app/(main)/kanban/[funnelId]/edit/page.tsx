'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Zap, ArrowLeft, Loader2, GripVertical, Plus, Trash2, AlertCircle, Link2, Target, Cpu, Eye, Layers, Save, Globe, Archive, ChevronDown, Check, Webhook } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

type StageType = 'NEUTRAL' | 'WIN' | 'LOSS';
type SemanticType = 'meeting_scheduled' | 'meeting_cancelled' | 'payment_received' | 'proposal_sent';

interface Stage {
  id: string;
  title: string;
  type: StageType;
  semanticType?: SemanticType;
}

interface FunnelType {
  value: 'LEAD_CAPTURE' | 'SALES' | 'CUSTOMER_SUCCESS' | 'RETENTION';
  label: string;
  description: string;
}

const FUNNEL_TYPES: FunnelType[] = [
  { value: 'LEAD_CAPTURE', label: 'Captação de Leads', description: 'Para capturar e qualificar novos leads' },
  { value: 'SALES', label: 'Vendas', description: 'Para gerenciar o processo de vendas' },
  { value: 'CUSTOMER_SUCCESS', label: 'Customer Success', description: 'Para acompanhar clientes ativos' },
  { value: 'RETENTION', label: 'Retenção', description: 'Para evitar cancelamentos e reter clientes' },
];

const SEMANTIC_TYPES = [
  { value: 'NONE', label: 'Nenhum (Padrão)' },
  { value: 'meeting_scheduled', label: '📅 Reunião Marcada' },
  { value: 'meeting_cancelled', label: '🚫 Agendamento Desmarcado' },
  { value: 'proposal_sent', label: '📄 Proposta Enviada' },
  { value: 'payment_received', label: '💰 Pagamento Recebido' },
];

interface ConnectionOption {
  id: string;
  config_name: string;
  phoneNumber?: string | null;
  phone?: string | null;
  connectionType: string;
  isActive: boolean;
}

export default function EditFunnelPage({ params }: { params: Promise<{ funnelId: string }> }) {
  const { funnelId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [funnelName, setFunnelName] = useState('');
  const [funnelType, setFunnelType] = useState<string>('');
  const [objective, setObjective] = useState('');
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [availableConnections, setAvailableConnections] = useState<ConnectionOption[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [automations, setAutomations] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [customFieldsBySource, setCustomFieldsBySource] = useState<Record<string, string[]>>({});
  const [customFieldSourceTypes, setCustomFieldSourceTypes] = useState<Record<string, 'automation' | 'webhook' | 'unknown'>>({});
  const [selectedSource, setSelectedSource] = useState<string>('Todas as Origens');
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const sourceDropdownRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState({
    autoAssignTeamId: '',
    autoAssignUserId: '',
    autoTriggerAutomationId: '',
    autoTags: [] as string[],
    defaultEntryStageId: '',
    visibleCustomFields: undefined as string[] | undefined,
  });

  // Carregar dados do funil e conexões
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [funnelRes, connectionsRes, teamsRes, automationsRes, tagsRes, leadsRes, webhooksRes, fieldsMapRes] = await Promise.all([
          fetch(`/api/v1/kanbans/${funnelId}`),
          fetch('/api/v1/connections'),
          fetch('/api/v1/team'),
          fetch('/api/v1/automations'),
          fetch('/api/v1/tags'),
          fetch(`/api/v1/leads?boardId=${funnelId}`),
          fetch('/api/v1/webhooks/incoming?limit=100'),
          fetch('/api/v1/automations/fields-map').catch(() => null)
        ]);

        if (!funnelRes.ok) throw new Error('Falha ao carregar funil');

        const data = await funnelRes.json();
        setFunnelName(data.name);
        setFunnelType(data.funnelType || '');
        setObjective(data.objective || '');
        setSelectedConnectionIds(data.connectionIds || []);
        setStages(data.stages.map((s: Stage) => ({
          ...s,
          semanticType: s.semanticType || undefined
        })));
        if (data.settings) {
          setSettings({
            autoAssignTeamId: data.settings.autoAssignTeamId || '',
            autoAssignUserId: data.settings.autoAssignUserId || '',
            autoTriggerAutomationId: data.settings.autoTriggerAutomationId || '',
            autoTags: data.settings.autoTags || [],
            defaultEntryStageId: data.settings.defaultEntryStageId || '',
            visibleCustomFields: data.settings.visibleCustomFields,
          });
        }

        const connData = await connectionsRes.json();
        setAvailableConnections(Array.isArray(connData) ? connData.filter((c: ConnectionOption) => c.isActive) : []);
        
        if (teamsRes.ok) { 
           const td = await teamsRes.json(); 
           setTeams(Array.isArray(td.teams) ? td.teams : (Array.isArray(td) ? td : [])); 
           setUsers(Array.isArray(td.members) ? td.members : []); 
        }
        let automationsList: any[] = [];
        let flowsList: any[] = [];
        if (automationsRes.ok) { 
          const ad = await automationsRes.json(); 
          automationsList = Array.isArray(ad.data) ? ad.data : [];
          setAutomations(automationsList); 
        }
        
        try {
          flowsList = await getAutomationFlowsForDropdown();
        } catch(e) {}
        
        let webhooksList: any[] = [];
        if (webhooksRes && webhooksRes.ok) {
          const wd = await webhooksRes.json();
          webhooksList = Array.isArray(wd.data) ? wd.data : [];
        }
        
        let automationFieldsMap: Record<string, { name: string; fields: string[] }> = {};
        if (fieldsMapRes && fieldsMapRes.ok) {
          const fmd: { flowId: string; flowName: string; fields: string[] }[] = await fieldsMapRes.json();
          for (const entry of (Array.isArray(fmd) ? fmd : [])) {
            automationFieldsMap[entry.flowId] = { name: entry.flowName, fields: entry.fields };
          }
        }

        if (tagsRes.ok) { const tg = await tagsRes.json(); setTags(Array.isArray(tg) ? tg : []); }
        if (leadsRes.ok) {
          const leads = await leadsRes.json();
          const LEGACY_GROUP = '📋 Campos Legados';
          const UTM_P = ['utm_', 'gclid', 'fbclid', 'ttclid', 'msclkid'];
          const isTracking = (k: string) => UTM_P.some(p => k.toLowerCase().startsWith(p));
          const sourceMap: Record<string, Set<string>> = { 'Todas as Origens': new Set() };

          // Buscar mapa contactId → automação via automation_flow_executions
          let contactAutomationMap: Record<string, { flowId: string; flowName: string }> = {};
          try {
            const sourcesRes = await fetch(`/api/v1/leads/automation-sources?boardId=${funnelId}`);
            if (sourcesRes.ok) {
              const sourcesData: { contactId: string; flowId: string; flowName: string }[] = await sourcesRes.json();
              for (const s of (Array.isArray(sourcesData) ? sourcesData : [])) {
                contactAutomationMap[s.contactId] = { flowId: s.flowId, flowName: s.flowName };
              }
            }
          } catch (e) {
            console.warn('[edit/page] automation-sources fetch failed:', e);
          }

          // Lookup rápido: flowId → campos definidos pela automação
          const automationDefinedFields = new Map<string, Set<string>>();
          for (const [flowId, entry] of Object.entries(automationFieldsMap)) {
            automationDefinedFields.set(flowId, new Set(entry.fields));
          }

          if (Array.isArray(leads)) {
            leads.forEach((lead: any) => {
              let cf = lead.contact?.customFields;
              if (typeof cf === 'string') {
                try { cf = JSON.parse(cf); } catch(e) { cf = null; }
              }
              if (cf && typeof cf === 'object') {
                const keys = Object.keys(cf).filter(k => !isTracking(k));
                if (keys.length === 0) return;

                const contactId = lead.contactId || lead.contact?.id;
                const execEntry = contactId ? contactAutomationMap[contactId] : undefined;

                if (execEntry) {
                  // Separar: campos definidos pela automação vs legados
                  const defined = automationDefinedFields.get(execEntry.flowId) || new Set<string>();
                  const automationKeys = keys.filter(k => defined.has(k));
                  const legacyKeys     = keys.filter(k => !defined.has(k));

                  if (automationKeys.length > 0) {
                    if (!sourceMap[execEntry.flowName]) sourceMap[execEntry.flowName] = new Set();
                    automationKeys.forEach(k => {
                      sourceMap[execEntry.flowName].add(k);
                      sourceMap['Todas as Origens'].add(k);
                    });
                  }
                  if (legacyKeys.length > 0) {
                    if (!sourceMap[LEGACY_GROUP]) sourceMap[LEGACY_GROUP] = new Set();
                    legacyKeys.forEach(k => {
                      sourceMap[LEGACY_GROUP].add(k);
                      sourceMap['Todas as Origens'].add(k);
                    });
                  }
                } else {
                  // Sem execução de automação → tudo vai para Campos Legados
                  if (!sourceMap[LEGACY_GROUP]) sourceMap[LEGACY_GROUP] = new Set();
                  keys.forEach(key => {
                    sourceMap[LEGACY_GROUP].add(key);
                    sourceMap['Todas as Origens'].add(key);
                  });
                }
              }
            });
          }

          // Complementar com campos das automações V4 (mesmo sem leads)
          for (const [, entry] of Object.entries(automationFieldsMap)) {
            if (entry.fields.length === 0) continue;
            if (!sourceMap[entry.name]) sourceMap[entry.name] = new Set();
            entry.fields.forEach(f => {
              sourceMap[entry.name].add(f);
              sourceMap['Todas as Origens'].add(f);
            });
          }

          const formattedMap: Record<string, string[]> = {};
          formattedMap['Todas as Origens'] = Array.from(sourceMap['Todas as Origens']).sort();
          // Automações em ordem alfabética
          Object.keys(sourceMap)
            .filter(k => k !== 'Todas as Origens' && k !== LEGACY_GROUP)
            .sort()
            .forEach(k => { formattedMap[k] = Array.from(sourceMap[k]).sort(); });
          // Campos Legados sempre por último
          if (sourceMap[LEGACY_GROUP]) {
            formattedMap[LEGACY_GROUP] = Array.from(sourceMap[LEGACY_GROUP]).sort();
          }
          setCustomFieldsBySource(formattedMap);

          // Montar mapa de tipos de origem
          const types: Record<string, 'automation' | 'webhook' | 'unknown'> = {};
          for (const entry of Object.values(automationFieldsMap)) { types[entry.name] = 'automation'; }
          for (const entry of Object.values(contactAutomationMap)) { types[entry.flowName] = 'automation'; }
          for (const w of webhooksList) { types[w.name] = 'webhook'; }
          types[LEGACY_GROUP] = 'unknown'; // Campos Legados sempre 'unknown'
          setCustomFieldSourceTypes(types);
        }

      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: (error as Error).message
        });
        router.push('/kanban');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchData();
  }, [funnelId, router, toast]);

  const toggleConnection = (connId: string) => {
    setSelectedConnectionIds(prev =>
      prev.includes(connId) ? prev.filter(id => id !== connId) : [...prev, connId]
    );
  };

  const toggleTag = (tagId: string) => {
    setSettings(prev => ({
      ...prev,
      autoTags: prev.autoTags.includes(tagId) ? prev.autoTags.filter(id => id !== tagId) : [...prev.autoTags, tagId]
    }));
  };

  const toggleCustomField = (field: string) => {
    setSettings(prev => {
      const current = prev.visibleCustomFields || (customFieldsBySource['Todas as Origens'] || []);
      const next = current.includes(field) 
        ? current.filter(f => f !== field)
        : [...current, field];
      return { ...prev, visibleCustomFields: next };
    });
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(e.target as Node)) {
        setIsSourceOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addStage = () => {
    setStages([...stages, { id: uuidv4(), title: '', type: 'NEUTRAL' }]);
  };

  const removeStage = (id: string) => {
    if (stages.length <= 1) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'É necessário pelo menos um estágio no funil'
      });
      return;
    }
    setStages(stages.filter(s => s.id !== id));
  };

  const updateStage = (id: string, field: keyof Stage, value: string) => {
    // Converter 'NONE' para undefined para semanticType
    const actualValue = (field === 'semanticType' && value === 'NONE') ? undefined : value;
    setStages(stages.map(s => s.id === id ? { ...s, [field]: actualValue } : s));
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    if (!reorderedItem) return;
    items.splice(result.destination.index, 0, reorderedItem);

    setStages(items);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!funnelName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Nome do funil é obrigatório'
      });
      return;
    }

    if (stages.some(s => !s.title.trim())) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Todos os estágios precisam ter um título'
      });
      return;
    }

    // Validar semanticType único (excluir valores vazios/undefined)
    const semanticTypes = stages.reduce<SemanticType[]>((acc, stage) => {
      if (stage.semanticType) acc.push(stage.semanticType);
      return acc;
    }, []);

    const duplicates = semanticTypes.filter((item, index) => semanticTypes.indexOf(item) !== index);
    if (duplicates.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Cada tipo semântico pode ser usado apenas uma vez no funil'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/kanbans/${funnelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: funnelName,
          funnelType: funnelType || null,
          objective: objective || null,
          stages: stages.map(s => ({
            ...s,
            semanticType: s.semanticType === 'NONE' ? undefined : s.semanticType,
            entryAutomationId: s.entryAutomationId || undefined
          })),
          connectionIds: selectedConnectionIds.length > 0 ? selectedConnectionIds : null,
          settings: {
            autoAssignTeamId: settings.autoAssignTeamId || null,
            autoAssignUserId: settings.autoAssignUserId || null,
            autoTriggerAutomationId: settings.autoTriggerAutomationId || null,
            autoTags: settings.autoTags,
            defaultEntryStageId: settings.defaultEntryStageId || null,
            visibleCustomFields: settings.visibleCustomFields,
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha ao atualizar funil');
      }

      toast({
        title: 'Sucesso!',
        description: 'Funil atualizado com sucesso'
      });

      router.push(`/kanban/${funnelId}`);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: (error as Error).message
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* HEADER FLUTUANTE (ACTION BAR) */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl border-b border-zinc-200 dark:border-white/5 py-4 px-6 md:px-12 flex items-center justify-between shadow-sm dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4">
          <Link href={`/kanban/${funnelId}`}>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-500 dark:text-muted-foreground hover:text-zinc-900 dark:hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-500 bg-clip-text text-transparent">Configuração de Funil</span>
            </h1>
            <p className="text-xs text-muted-foreground font-medium">{funnelName || 'Carregando...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSubmit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] rounded-full px-6 transition-all duration-300">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Funil
          </Button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto py-8 px-4 md:px-8">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* COLUNA ESQUERDA: IDENTIDADE E FONTES */}
            <div className="xl:col-span-4 space-y-6">
              
              {/* BENTO BOX 1: Identidade */}
              <div className="bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-3xl p-6 shadow-sm dark:shadow-2xl backdrop-blur-md">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white/90 mb-6 flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Identidade do Funil
                </h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs text-zinc-500 dark:text-muted-foreground uppercase tracking-wider">Nome do Funil *</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Pipeline de Vendas"
                      value={funnelName}
                      onChange={(e) => setFunnelName(e.target.value)}
                      required
                      className="bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 focus:bg-white dark:focus:bg-white/[0.05] transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="funnelType" className="text-xs text-zinc-500 dark:text-muted-foreground uppercase tracking-wider">Tipo de Funil</Label>
                    <Select value={funnelType} onValueChange={setFunnelType}>
                      <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 focus:bg-white dark:focus:bg-white/[0.05] transition-colors">
                        <SelectValue placeholder="Selecione o tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FUNNEL_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {funnelType && (
                      <p className="text-[11px] text-emerald-400/70 font-medium">
                        {FUNNEL_TYPES.find(t => t.value === funnelType)?.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="objective" className="text-xs text-zinc-500 dark:text-muted-foreground uppercase tracking-wider">Objetivo (Opcional)</Label>
                    <Input
                      id="objective"
                      placeholder="Ex: Aumentar conversão em 20%"
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      className="bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 focus:bg-white dark:focus:bg-white/[0.05] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* BENTO BOX 2: Conexões */}
              {availableConnections.length > 0 && (
                <div className="bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-3xl p-6 shadow-sm dark:shadow-2xl backdrop-blur-md">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white/90 mb-2 flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Fontes de Captação
                  </h2>
                  <p className="text-[13px] text-zinc-500 dark:text-muted-foreground mb-4">Contatos que chegarem por essas conexões entrarão automaticamente no funil.</p>
                  
                  <div className="space-y-2">
                    {availableConnections.map(conn => (
                      <label
                        key={conn.id}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                          selectedConnectionIds.includes(conn.id)
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/30 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]'
                            : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <Checkbox
                          checked={selectedConnectionIds.includes(conn.id)}
                          onCheckedChange={() => toggleConnection(conn.id)}
                          className={selectedConnectionIds.includes(conn.id) ? 'data-[state=checked]:bg-emerald-600 dark:data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white' : ''}
                        />
                        <div className="flex flex-col">
                          <span className={`text-sm font-semibold ${selectedConnectionIds.includes(conn.id) ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-white/80'}`}>{conn.config_name}</span>
                          <span className="text-[11px] text-zinc-500 dark:text-muted-foreground">
                            {conn.phoneNumber || conn.phone || 'Sem número'} · {conn.connectionType === 'meta_api' ? 'Meta API' : 'Baileys'}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* BENTO BOX 3: Visibilidade de Campos */}
              <div className="bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-3xl p-6 shadow-sm dark:shadow-2xl backdrop-blur-md">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white/90 mb-2 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Interface dos Cards
                </h2>
                <p className="text-[13px] text-zinc-500 dark:text-muted-foreground mb-4">Selecione quais campos personalizados exibir diretamente na visualização Kanban.</p>
                
                {!customFieldsBySource['Todas as Origens'] || customFieldsBySource['Todas as Origens'].length === 0 ? (
                  <div className="text-[13px] text-zinc-500 dark:text-muted-foreground italic p-4 rounded-xl border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-zinc-900/30">
                    Nenhum campo personalizado encontrado nos leads atuais deste funil.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button type="button" variant="ghost" size="sm" className="text-xs h-7 px-2 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-white/70" onClick={() => setSettings(s => ({ ...s, visibleCustomFields: [...(customFieldsBySource['Todas as Origens'] || [])] }))}>
                          Todos
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="text-xs h-7 px-2 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-white/70" onClick={() => setSettings(s => ({ ...s, visibleCustomFields: [] }))}>
                          Nenhum
                        </Button>
                      </div>
                      {/* Premium Source Filter Dropdown */}
                      <div ref={sourceDropdownRef} className="relative w-full md:w-auto md:max-w-[220px] flex-shrink-0 min-w-0">
                        <button
                          type="button"
                          onClick={() => setIsSourceOpen(v => !v)}
                          className="group flex items-center gap-2 w-full h-8 px-3 rounded-lg border border-zinc-200 dark:border-white/8 bg-white/50 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.06] hover:border-zinc-300 dark:hover:border-white/15 text-xs text-zinc-700 dark:text-white/70 transition-all duration-200 shadow-none hover:shadow-[0_0_0_1px_rgba(255,255,255,0.05)] max-w-full overflow-hidden"
                        >
                          {/* Source icon */}
                          {selectedSource === 'Todas as Origens' ? (
                            <Globe className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400 dark:text-white/30" />
                          ) : customFieldSourceTypes[selectedSource] === 'automation' ? (
                            <Zap className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400 dark:text-white/30" />
                          ) : customFieldSourceTypes[selectedSource] === 'webhook' ? (
                            <Webhook className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400 dark:text-white/30" />
                          ) : (
                            <Archive className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400 dark:text-white/30" />
                          )}
                          <span className="truncate flex-1 text-left">{selectedSource}</span>
                          <span className="flex-shrink-0 text-[10px] text-zinc-400 dark:text-white/25 tabular-nums">
                            ({(customFieldsBySource[selectedSource] || []).length})
                          </span>
                          <ChevronDown className={`h-3 w-3 flex-shrink-0 text-zinc-400 dark:text-white/25 transition-transform duration-200 ${isSourceOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown panel */}
                        <div
                          className="absolute right-0 top-[calc(100%+4px)] z-50 w-64 origin-top"
                          style={{
                            opacity: isSourceOpen ? 1 : 0,
                            transform: isSourceOpen ? 'scaleY(1) translateY(0)' : 'scaleY(0.95) translateY(-4px)',
                            pointerEvents: isSourceOpen ? 'auto' : 'none',
                            transition: 'opacity 150ms ease, transform 150ms ease',
                          }}
                        >
                          <div className="rounded-xl border border-zinc-200/80 dark:border-white/8 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-xl dark:shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden">
                            {/* Header */}
                            <div className="px-3 py-2 border-b border-zinc-100 dark:border-white/5">
                              <p className="text-[10px] font-medium text-zinc-400 dark:text-white/25 uppercase tracking-widest">Filtrar por origem</p>
                            </div>
                            {/* Items */}
                            <div className="py-1 max-h-[240px] overflow-y-auto">
                              {Object.keys(customFieldsBySource).map(source => {
                                const srcType = customFieldSourceTypes[source];
                                const isSelected = selectedSource === source;
                                const Icon = source === 'Todas as Origens' ? Globe
                                  : srcType === 'automation' ? Zap
                                  : srcType === 'webhook' ? Webhook
                                  : Archive;
                                return (
                                  <button
                                    key={source}
                                    type="button"
                                    onClick={() => { setSelectedSource(source); setIsSourceOpen(false); }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors duration-100 ${
                                      isSelected
                                        ? 'bg-zinc-50 dark:bg-white/[0.06] text-zinc-900 dark:text-white'
                                        : 'text-zinc-600 dark:text-white/50 hover:bg-zinc-50 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-white/80'
                                    }`}
                                  >
                                    <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${
                                      isSelected ? 'text-emerald-500 dark:text-emerald-400' : 'text-zinc-400 dark:text-white/25'
                                    }`} />
                                    <span className="flex-1 text-left truncate">{source}</span>
                                    <span className="flex-shrink-0 text-[10px] tabular-nums text-zinc-400 dark:text-white/25">
                                      {customFieldsBySource[source].length}
                                    </span>
                                    {isSelected && (
                                      <Check className="h-3 w-3 flex-shrink-0 text-emerald-500 dark:text-emerald-400" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                    
                    <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto p-2 bg-zinc-50 dark:bg-black/20 rounded-xl border border-zinc-200 dark:border-white/5">
                      {(customFieldsBySource[selectedSource] || customFieldsBySource['Todas as Origens'] || []).map(field => {
                        const isChecked = settings.visibleCustomFields === undefined || settings.visibleCustomFields.includes(field);
                        return (
                          <label key={field} className={`flex items-center gap-2 cursor-pointer p-2 px-3 rounded-lg transition-all text-xs border ${
                            isChecked
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-medium'
                              : 'bg-zinc-100 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-muted-foreground hover:bg-zinc-200 dark:hover:bg-white/5'
                          }`}>
                            <Checkbox 
                              checked={isChecked}
                              onCheckedChange={() => toggleCustomField(field)}
                              className="h-3 w-3"
                            />
                            {field.length > 35 ? field.substring(0, 35) + '...' : field}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* COLUNA DIREITA: PIPELINE E INTELIGÊNCIA */}
            <div className="xl:col-span-8 space-y-6">
              
              {/* BENTO BOX 4: Regras de Roteamento Inteligente */}
              <div className="bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-3xl p-6 shadow-sm dark:shadow-2xl backdrop-blur-md">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white/90 mb-2 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Inteligência de Entrada (Roteamento)
                </h2>
                <p className="text-[13px] text-zinc-500 dark:text-muted-foreground mb-6">Automações executadas instantaneamente assim que um lead entrar neste funil.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-500 dark:text-muted-foreground uppercase tracking-wider">Atribuir a Usuário Padrão</Label>
                    <Select value={settings.autoAssignUserId} onValueChange={(val) => setSettings(s => ({ ...s, autoAssignUserId: val === 'none' ? '' : val }))}>
                      <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 focus:bg-white dark:focus:bg-white/[0.05]"><SelectValue placeholder="Nenhum..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Deixar sem dono</SelectItem>
                        {users.map(u => <SelectItem key={u.id || u.user?.id} value={u.id || u.user?.id}>{u.name || u.user?.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-500 dark:text-muted-foreground uppercase tracking-wider">Disparar Automação Padrão</Label>
                    <Select value={settings.autoTriggerAutomationId} onValueChange={(val) => setSettings(s => ({ ...s, autoTriggerAutomationId: val === 'none' ? '' : val }))}>
                      <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 focus:bg-white dark:focus:bg-white/[0.05]"><SelectValue placeholder="Nenhum Fluxo..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum Fluxo</SelectItem>
                        {automations.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {tags.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-white/5">
                    <Label className="text-xs text-zinc-500 dark:text-muted-foreground uppercase tracking-wider">Tagueamento Automático</Label>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {tags.map(t => (
                        <label key={t.id} className={`flex items-center gap-2 cursor-pointer p-2 px-3 rounded-lg transition-all text-xs border ${
                          settings.autoTags.includes(t.id)
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-white shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]'
                            : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-muted-foreground hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}>
                          <Checkbox 
                            checked={settings.autoTags.includes(t.id)} 
                            onCheckedChange={() => toggleTag(t.id)} 
                            className="h-3 w-3"
                          />
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color || '#cbd5e1' }} />
                          {t.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* BENTO BOX 5: Pipeline Builder */}
              <div className="bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-3xl p-6 shadow-sm dark:shadow-2xl backdrop-blur-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-4">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white/90 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Construtor de Estágios
                  </h2>
                  <Button type="button" variant="outline" size="sm" onClick={addStage} className="bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 text-xs h-8 rounded-full">
                    <Plus className="h-3 w-3 mr-1" /> Adicionar Estágio
                  </Button>
                </div>
                <p className="text-[13px] text-zinc-500 dark:text-muted-foreground mb-6">Arraste para reordenar. Defina o tipo de encerramento e os gatilhos semânticos da inteligência artificial.</p>

                <Alert className="bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 mb-6">
                  <AlertCircle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  <AlertDescription className="text-xs">
                    <strong>Dica de Automação:</strong> Associe estágios a &quot;Tipos Semânticos&quot; (Ex: Reunião Marcada) para que a IA do bot mova o card automaticamente quando identificar o evento na conversa do lead.
                  </AlertDescription>
                </Alert>

                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="stages">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-3"
                      >
                        {stages.map((stage, index) => (
                          <Draggable key={stage.id} draggableId={stage.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={provided.draggableProps.style}
                                className={`group relative p-4 border rounded-2xl transition-all duration-300 ${
                                  snapshot.isDragging
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.1)] dark:shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-[1.02] z-50 backdrop-blur-xl'
                                    : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:bg-zinc-900/80 dark:hover:border-white/10 shadow-sm'
                                }`}
                              >
                                {/* Top Row: Drag Handle, Name, Type, Delete */}
                                <div className="flex gap-3 items-center mb-4">
                                  <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-zinc-400 dark:text-muted-foreground hover:text-zinc-700 dark:hover:text-white transition-colors p-1">
                                    <GripVertical className="h-5 w-5" />
                                  </div>
                                  <div className="flex-1">
                                    <Input
                                      placeholder={`Nome do Estágio ${index + 1}`}
                                      value={stage.title}
                                      onChange={(e) => updateStage(stage.id, 'title', e.target.value)}
                                      required
                                      className="bg-transparent border-0 border-b border-transparent focus-visible:ring-0 focus-visible:border-emerald-500 rounded-none px-1 text-base font-semibold text-zinc-900 dark:text-white/90 shadow-none h-8 transition-colors placeholder:text-zinc-400 dark:placeholder:text-muted-foreground/30"
                                    />
                                  </div>
                                  <div className="w-[130px]">
                                    <Select
                                      value={stage.type}
                                      onValueChange={(value: StageType) => updateStage(stage.id, 'type', value)}
                                    >
                                      <SelectTrigger className={`h-8 text-xs font-medium border-0 shadow-none ${
                                        stage.type === 'WIN' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                                        stage.type === 'LOSS' ? 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400' :
                                        'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-muted-foreground'
                                      }`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="NEUTRAL" className="text-xs">Neutro</SelectItem>
                                        <SelectItem value="WIN" className="text-xs text-emerald-500">Vitória (Win)</SelectItem>
                                        <SelectItem value="LOSS" className="text-xs text-red-500">Perda (Loss)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-zinc-400 dark:text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => removeStage(stage.id)}
                                    disabled={stages.length <= 1}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>

                                {/* Bottom Row: Semantic Type & Automation & Default Check */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-zinc-50 dark:bg-black/40 rounded-xl border border-zinc-200 dark:border-white/5">
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] text-zinc-500 dark:text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                      <Target className="w-3 h-3" /> Evento IA (Semântico)
                                    </Label>
                                    <Select
                                      value={stage.semanticType || 'NONE'}
                                      onValueChange={(value: SemanticType | 'NONE') => updateStage(stage.id, 'semanticType', value)}
                                    >
                                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-white/5 border-zinc-200 dark:border-white/5 focus:bg-zinc-50 dark:focus:bg-white/10">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="NONE" className="text-xs">Desabilitado</SelectItem>
                                        {SEMANTIC_TYPES.filter(st => st.value !== 'NONE').map((st) => (
                                          <SelectItem key={st.value} value={st.value} className="text-xs">
                                            {st.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] text-zinc-500 dark:text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                      <Zap className="w-3 h-3 text-amber-500" /> Disparo ao Entrar
                                    </Label>
                                    <Select
                                      value={stage.entryAutomationId || 'none'}
                                      onValueChange={(value: string) => updateStage(stage.id, 'entryAutomationId', value === 'none' ? undefined : value)}
                                    >
                                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-white/5 border-zinc-200 dark:border-white/5 focus:bg-zinc-50 dark:focus:bg-white/10">
                                        <SelectValue placeholder="Sem disparo" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none" className="text-xs">Nenhum fluxo</SelectItem>
                                        {automations.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="mt-3 flex items-center px-1">
                                  <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-zinc-500 dark:text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                    <input 
                                      type="radio" 
                                      name="defaultEntryStage" 
                                      checked={settings.defaultEntryStageId === stage.id || (!settings.defaultEntryStageId && index === 0)}
                                      onChange={() => setSettings(s => ({ ...s, defaultEntryStageId: stage.id }))}
                                      className="accent-emerald-500 w-3.5 h-3.5"
                                    />
                                    Etapa Padrão (Entrada de Novos Leads)
                                  </label>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
