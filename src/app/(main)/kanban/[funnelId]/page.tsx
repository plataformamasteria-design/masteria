// src/app/(main)/kanban/[funnelId]/page.tsx
'use client';

import { KanbanView } from '@/components/kanban/kanban-view';
import { StagePersonaConfig } from '@/components/kanban/stage-persona-config';
import type { KanbanFunnel, KanbanCard as KanbanCardType } from '@/lib/types';
import { use, useState, useEffect, useMemo } from 'react';
import { Loader2, Kanban as KanbanIcon, Bot, BarChart2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { DropResult } from '@hello-pangea/dnd';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateLeadDialog } from '@/components/kanban/lead-dialogs';
import { FunnelReport } from '@/components/kanban/funnel-report';
import { getCompanyUsers, getTeams } from '@/app/actions/teams';
import { fetchAvailableConnections } from '@/app/actions/chat';
import { getAutomationFlowsForDropdown } from '@/app/actions/automations-builder';

export interface KanbanFilters {
  stages: string[];
  priority: string[];
  valueMin: number | null;
  valueMax: number | null;
  dateRange: 'all' | 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'custom';
  dateFrom: string | null;
  dateTo: string | null;
  assignedUsers: string[];
  teams: string[];
  connections: string[];
  tags: string[];
  utms: string[];
  customFields: string[];
  customFieldValues: Record<string, string[]>;
}

const DEFAULT_FILTERS: KanbanFilters = {
  stages: [],
  priority: [],
  valueMin: null,
  valueMax: null,
  dateRange: 'all',
  dateFrom: null,
  dateTo: null,
  assignedUsers: [],
  teams: [],
  connections: [],
  tags: [],
  utms: [],
  customFields: [],
  customFieldValues: {},
};

export default function FunnelPage({ params }: { params: Promise<{ funnelId: string }> }) {
  const { funnelId } = use(params);
  const [funnel, setFunnel] = useState<KanbanFunnel | null>(null);
  const [cards, setCards] = useState<KanbanCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<KanbanFilters>(DEFAULT_FILTERS);
  const [isFiltersLoaded, setIsFiltersLoaded] = useState(false);
  
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [companyTeams, setCompanyTeams] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [automationsList, setAutomationsList] = useState<any[]>([]);
  const [flowsList, setFlowsList] = useState<any[]>([]);
  const [webhooksList, setWebhooksList] = useState<any[]>([]);
  // Map of automation V4 fields: { flowId → { name, fields[] } }
  const [automationFieldsMap, setAutomationFieldsMap] = useState<Record<string, { name: string; fields: string[] }>>({});
  // contactId → { flowId, flowName } — fonte de verdade: automation_flow_executions
  const [contactAutomationMap, setContactAutomationMap] = useState<Record<string, { flowId: string; flowName: string }>>({}); 
  
  const { toast } = useToast();

  const fetchFunnelData = async () => {
    try {
      setLoading(true);
      const [funnelRes, leadsRes, tagsRes, usersData, teamsData, connsData, automationsRes, webhooksRes, flowsData, fieldsMapRes] = await Promise.all([
        fetch(`/api/v1/kanbans/${funnelId}`),
        fetch(`/api/v1/leads?boardId=${funnelId}`),
        fetch(`/api/v1/tags?limit=200`),
        getCompanyUsers(),
        getTeams(),
        fetchAvailableConnections(),
        fetch('/api/v1/automations'),
        fetch('/api/v1/webhooks/incoming?limit=100'),
        getAutomationFlowsForDropdown().catch(() => []),
        fetch('/api/v1/automations/fields-map').catch(() => null)
      ]);

      if (!funnelRes.ok || !leadsRes.ok) throw new Error('Falha ao carregar dados do funil.');

      const funnelData = await funnelRes.json();
      const leadsData = await leadsRes.json();
      const tagsData = tagsRes.ok ? await tagsRes.json() : { data: [] };

      setFunnel(funnelData);
      setCards(leadsData);
      setCompanyUsers(usersData);
      setCompanyTeams(teamsData);
      setConnections(connsData);
      setAvailableTags(tagsData.data || []);
      
      if (automationsRes.ok) {
        const ad = await automationsRes.json();
        setAutomationsList(Array.isArray(ad.data) ? ad.data : []);
      }
      if (webhooksRes.ok) {
        const wd = await webhooksRes.json();
        setWebhooksList(Array.isArray(wd.data) ? wd.data : []);
      }
      setFlowsList(Array.isArray(flowsData) ? flowsData : []);

      // Processar mapa de campos das automações V4
      let fMap: Record<string, { name: string; fields: string[] }> = {};
      if (fieldsMapRes && fieldsMapRes.ok) {
        const fieldsMapData: { flowId: string; flowName: string; fields: string[] }[] = await fieldsMapRes.json();
        for (const entry of (Array.isArray(fieldsMapData) ? fieldsMapData : [])) {
          fMap[entry.flowId] = { name: entry.flowName, fields: entry.fields };
        }
        setAutomationFieldsMap(fMap);
      }

      // Buscar mapa contactId → automação (via automation_flow_executions)
      // Feito APÓS ter os leads carregados para usar o boardId correto
      try {
        const sourcesRes = await fetch(`/api/v1/leads/automation-sources?boardId=${funnelId}`);
        if (sourcesRes.ok) {
          const sourcesData: { contactId: string; flowId: string; flowName: string }[] = await sourcesRes.json();
          const cMap: Record<string, { flowId: string; flowName: string }> = {};
          for (const s of (Array.isArray(sourcesData) ? sourcesData : [])) {
            cMap[s.contactId] = { flowId: s.flowId, flowName: s.flowName };
          }
          setContactAutomationMap(cMap);
        }
      } catch (e) {
        console.warn('[Kanban] Não foi possível carregar automation-sources:', e);
      }

    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunnelData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnelId, toast]);

  // Carregar filtros salvos do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`kanban_filters_${funnelId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFilters((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error("Erro ao ler filtros do localStorage", e);
    } finally {
      setIsFiltersLoaded(true);
    }
  }, [funnelId]);

  const handleSaveFilters = () => {
    try {
      localStorage.setItem(`kanban_filters_${funnelId}`, JSON.stringify(filters));
      toast({ title: 'Sucesso', description: 'Filtros salvos como padrão para este funil.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar os filtros.' });
    }
  };

  const handleClearSavedFilters = () => {
    try {
      localStorage.removeItem(`kanban_filters_${funnelId}`);
      toast({ title: 'Sucesso', description: 'Filtros padrão removidos.' });
    } catch (e) {
      console.error(e);
    }
  };

  // Extrair UTMs únicas
  const availableUtms = useMemo(() => {
    const utms = new Set<string>();
    cards.forEach(card => {
      let customFields = (card as any).contact?.customFields;
      if (typeof customFields === 'string') {
        try { customFields = JSON.parse(customFields); } catch(e) { customFields = {}; }
      }
      if (customFields && typeof customFields === 'object') {
        const utmKey = Object.keys(customFields).find(k => k.toLowerCase().includes('utm_campaign') || k.toLowerCase().includes('utm campaing') || k.toLowerCase().includes('utm campaign'));
        if (utmKey && customFields[utmKey]) {
          utms.add(String(customFields[utmKey]).toUpperCase().trim());
        }
      }
    });
    return Array.from(utms).sort();
  }, [cards]);

  // Extrair campos personalizados agrupados por AUTOMAÇÃO DE ORIGEM
  // Regra: cada automação mostra SOMENTE os campos que ELA DEFINE no nó update_contact
  // Campos do contato que não pertencem a nenhuma automação → vão para "📋 Campos Legados"
  const LEGACY_GROUP = '📋 Campos Legados';
  const UTM_PREFIXES_PAGE = ['utm_', 'gclid', 'fbclid', 'ttclid', 'msclkid'];
  const isTracking = (k: string) => UTM_PREFIXES_PAGE.some(p => k.toLowerCase().startsWith(p));

  const availableCustomFields = useMemo(() => {
    const sourceMap: Record<string, Set<string>> = { 'Todas as Origens': new Set() };

    // Construir lookup rápido: flowId → Set<fieldKey> (somente campos definidos na automação)
    const automationDefinedFields = new Map<string, Set<string>>();
    for (const [flowId, entry] of Object.entries(automationFieldsMap)) {
      automationDefinedFields.set(flowId, new Set(entry.fields));
    }

    // Para cada card, separar campos por origem ESTRITA
    cards.forEach(card => {
      const contactId = (card as any).contactId || (card as any).contact?.id;
      let customFields = (card as any).contact?.customFields;
      if (typeof customFields === 'string') {
        try { customFields = JSON.parse(customFields); } catch(e) { customFields = {}; }
      }
      if (!customFields || typeof customFields !== 'object') return;

      const keys = Object.keys(customFields).filter(k => !isTracking(k));
      if (keys.length === 0) return;

      const execEntry = contactId ? contactAutomationMap[contactId] : undefined;

      if (execEntry) {
        // Contato veio de uma automação — separar campos por "definido" vs "não definido"
        const defined = automationDefinedFields.get(execEntry.flowId) || new Set<string>();
        const automationKeys = keys.filter(k => defined.has(k));
        const legacyKeys     = keys.filter(k => !defined.has(k));

        // Campos definidos → grupo da automação
        if (automationKeys.length > 0) {
          if (!sourceMap[execEntry.flowName]) sourceMap[execEntry.flowName] = new Set();
          automationKeys.forEach(k => {
            sourceMap[execEntry.flowName].add(k);
            sourceMap['Todas as Origens'].add(k);
          });
        }
        // Campos NÃO definidos → Campos Legados
        if (legacyKeys.length > 0) {
          if (!sourceMap[LEGACY_GROUP]) sourceMap[LEGACY_GROUP] = new Set();
          legacyKeys.forEach(k => {
            sourceMap[LEGACY_GROUP].add(k);
            sourceMap['Todas as Origens'].add(k);
          });
        }
      } else {
        // Contato sem execução de automação registrada → tudo vai para Campos Legados
        if (!sourceMap[LEGACY_GROUP]) sourceMap[LEGACY_GROUP] = new Set();
        keys.forEach(k => {
          sourceMap[LEGACY_GROUP].add(k);
          sourceMap['Todas as Origens'].add(k);
        });
      }
    });

    // Adicionar campos definidos nas automações V4 (mesmo que o funil ainda não tenha leads)
    // Só adiciona campos que são EXATAMENTE os definidos pela automação
    for (const [, entry] of Object.entries(automationFieldsMap)) {
      if (entry.fields.length === 0) continue;
      if (!sourceMap[entry.name]) sourceMap[entry.name] = new Set();
      entry.fields.forEach(f => {
        sourceMap[entry.name].add(f);
        sourceMap['Todas as Origens'].add(f);
      });
    }

    const formattedMap: Record<string, string[]> = {};
    // 'Todas as Origens' sempre primeiro
    formattedMap['Todas as Origens'] = Array.from(sourceMap['Todas as Origens']).sort();
    // Automações em ordem alfabética
    Object.keys(sourceMap)
      .filter(k => k !== 'Todas as Origens' && k !== LEGACY_GROUP)
      .sort()
      .forEach(k => { formattedMap[k] = Array.from(sourceMap[k]).sort(); });
    // 'Campos Legados' sempre por último
    if (sourceMap[LEGACY_GROUP]) {
      formattedMap[LEGACY_GROUP] = Array.from(sourceMap[LEGACY_GROUP]).sort();
    }
    return formattedMap;
  }, [cards, contactAutomationMap, automationFieldsMap]);

  // Extrair valores únicos para cada campo personalizado
  const availableCustomFieldValues = useMemo(() => {
    const valuesMap: Record<string, Set<string>> = {};
    
    cards.forEach(card => {
      let customFields = (card as any).contact?.customFields;
      if (typeof customFields === 'string') {
        try { customFields = JSON.parse(customFields); } catch(e) { customFields = {}; }
      }
      if (!customFields || typeof customFields !== 'object') return;

      Object.entries(customFields).forEach(([key, value]) => {
        if (!isTracking(key) && value !== null && value !== undefined && value !== '') {
          if (!valuesMap[key]) valuesMap[key] = new Set();
          valuesMap[key].add(String(value).trim());
        }
      });
    });

    const result: Record<string, string[]> = {};
    for (const [key, set] of Object.entries(valuesMap)) {
      result[key] = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    return result;
  }, [cards]);

  // Mapa de tipo de origem → 'automation' | 'webhook' | 'unknown'
  // 'Campos Legados' é tratado como 'unknown'
  const customFieldSourceTypes = useMemo((): Record<string, 'automation' | 'webhook' | 'unknown'> => {
    const types: Record<string, 'automation' | 'webhook' | 'unknown'> = {};
    for (const entry of Object.values(automationFieldsMap)) {
      types[entry.name] = 'automation';
    }
    for (const entry of Object.values(contactAutomationMap)) {
      types[entry.flowName] = 'automation';
    }
    for (const w of webhooksList) { types[w.name] = 'webhook'; }
    // Campos Legados sempre 'unknown'
    types[LEGACY_GROUP] = 'unknown';
    return types;
  }, [automationFieldsMap, contactAutomationMap, webhooksList]);

  // Filtrar cards com base em busca e filtros
  const filteredCards = useMemo(() => {
    if (!isFiltersLoaded) return cards; // Evita piscar estado errado antes de carregar filtros
    
    let result = cards;

    // Busca por texto (nome ou telefone)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(card =>
        (card.contact?.name?.toLowerCase().includes(q)) ||
        (card.contact?.phone?.includes(q)) ||
        (card.title?.toLowerCase().includes(q))
      );
    }

    // Filtro por etapas
    if (filters.stages.length > 0) {
      result = result.filter(card => filters.stages.includes(card.stageId));
    }

    // Filtro por prioridade
    if (filters.priority.length > 0) {
      result = result.filter(card => {
        const priority = (card as any).priority || 'MEDIUM';
        return filters.priority.includes(priority);
      });
    }

    // Filtro por valor
    if (filters.valueMin !== null) {
      result = result.filter(card => Number(card.value || 0) >= (filters.valueMin || 0));
    }
    if (filters.valueMax !== null) {
      result = result.filter(card => Number(card.value || 0) <= (filters.valueMax || Infinity));
    }

    // Filtro de Atribuição (Usuário, Equipe, Conexão) na conversa atrelada
    if (filters.assignedUsers.length > 0) {
      result = result.filter(card => {
         const assignedTo = (card as any).conversation?.assignedTo;
         return assignedTo && filters.assignedUsers.includes(assignedTo);
      });
    }

    if (filters.teams.length > 0) {
      result = result.filter(card => {
         const teamId = (card as any).conversation?.teamId;
         return teamId && filters.teams.includes(teamId);
      });
    }

    if (filters.connections.length > 0) {
      result = result.filter(card => {
         const connId = (card as any).conversation?.connectionId;
         return connId && filters.connections.includes(connId);
      });
    }

    // Filtro por Etiquetas/Tags (via contact.tags[].id)
    if (filters.tags.length > 0) {
      result = result.filter(card => {
        const cardTags: any[] = (card as any).contact?.tags || [];
        return cardTags.some(t => filters.tags.includes(t.id));
      });
    }

    // Filtro por UTMs
    if (filters.utms?.length > 0) {
      result = result.filter(card => {
        let customFields = (card as any).contact?.customFields;
        if (typeof customFields === 'string') {
          try { customFields = JSON.parse(customFields); } catch(e) { customFields = {}; }
        }
        if (customFields && typeof customFields === 'object') {
          const utmKey = Object.keys(customFields).find(k => k.toLowerCase().includes('utm_campaign') || k.toLowerCase().includes('utm campaing') || k.toLowerCase().includes('utm campaign'));
          if (utmKey && customFields[utmKey]) {
            const utmValue = String(customFields[utmKey]).toUpperCase().trim();
            return filters.utms.includes(utmValue);
          }
        }
        return false;
      });
    }

    // Filtro por Campos Personalizados (verifica se o lead possui o campo)
    if (filters.customFields?.length > 0) {
      result = result.filter(card => {
        let customFields = (card as any).contact?.customFields;
        if (typeof customFields === 'string') {
          try { customFields = JSON.parse(customFields); } catch(e) { customFields = {}; }
        }
        if (customFields && typeof customFields === 'object') {
           return filters.customFields.some(f => Object.keys(customFields).includes(f));
        }
        return false;
      });
    }

    // Filtro por Respostas de Campos Personalizados (Verificação Exata)
    if (filters.customFieldValues && Object.keys(filters.customFieldValues).length > 0) {
      result = result.filter(card => {
        let customFields = (card as any).contact?.customFields;
        if (typeof customFields === 'string') {
          try { customFields = JSON.parse(customFields); } catch(e) { customFields = {}; }
        }
        
        // Deve bater com TODOS os campos filtrados (AND entre campos, OR entre valores do mesmo campo)
        return Object.entries(filters.customFieldValues).every(([fieldKey, selectedValues]) => {
          if (!selectedValues || selectedValues.length === 0) return true;
          if (!customFields || typeof customFields !== 'object') return false;
          
          const leadValue = String(customFields[fieldKey] || '').trim();
          return selectedValues.includes(leadValue);
        });
      });
    }

    // Filtro por data de criação
    if (filters.dateRange !== 'all') {
      const now = new Date();
      if (filters.dateRange === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        result = result.filter(card => !card.createdAt || new Date(card.createdAt) >= startOfDay);
      } else if (filters.dateRange === 'yesterday') {
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
        const endOfYesterday   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        result = result.filter(card => {
          if (!card.createdAt) return true;
          const d = new Date(card.createdAt);
          return d >= startOfYesterday && d < endOfYesterday;
        });
      } else if (filters.dateRange === 'custom') {
        if (filters.dateFrom) {
          const [year, month, day] = filters.dateFrom.split('-').map(Number);
          const from = new Date(year, month - 1, day, 0, 0, 0, 0);
          result = result.filter(card => !card.createdAt || new Date(card.createdAt) >= from);
        }
        if (filters.dateTo) {
          const [year, month, day] = filters.dateTo.split('-').map(Number);
          const to = new Date(year, month - 1, day, 23, 59, 59, 999);
          result = result.filter(card => !card.createdAt || new Date(card.createdAt) <= to);
        }
      } else {
        const days = filters.dateRange === '7d' ? 7 : filters.dateRange === '30d' ? 30 : 90;
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        result = result.filter(card => {
          if (!card.createdAt) return true;
          return new Date(card.createdAt) >= cutoff;
        });
      }
    }

    return result;
  }, [cards, searchQuery, filters, isFiltersLoaded]);

  const handleMoveCard = async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;

    // Optimistic UI update
    const movedCard = cards.find(c => c.id === draggableId);
    if (!movedCard) return;

    const newCards = cards.map(card =>
      card.id === draggableId ? { ...card, stageId: destination.droppableId } : card
    );
    setCards(newCards);

    try {
      const response = await fetch(`/api/v1/leads/${draggableId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId: destination.droppableId })
      });

      if (!response.ok) {
        throw new Error("Falha ao atualizar o card.");
      }

    } catch (error) {
      // Revert optimistic update on failure
      setCards(cards);
      toast({ variant: "destructive", title: "Erro", description: (error as Error).message });
    }
  };

  const handleUpdateLead = async (leadId: string, data: { stageId?: string; title?: string; value?: number | null; notes?: string; customFields?: Record<string, string> }) => {
    const oldCards = [...cards];

    // Optimistic update - convert value to string for KanbanCard type
    const updateData: Partial<KanbanCardType> = {
      ...(data.stageId !== undefined && { stageId: data.stageId }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.value !== undefined && { value: data.value === null ? '' : data.value.toString() }),
      ...(data.customFields !== undefined && { customFields: data.customFields })
    };

    setCards(cards.map(card =>
      card.id === leadId ? { ...card, ...updateData } : card
    ));

    try {
      const response = await fetch(`/api/v1/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error("Falha ao atualizar o lead.");
      }

      // Refresh para pegar dados atualizados do contato se foram editados
      fetchFunnelData();
      toast({ title: "Sucesso", description: "Lead atualizado com sucesso!" });
    } catch (error) {
      setCards(oldCards);
      toast({ variant: "destructive", title: "Erro", description: (error as Error).message });
      throw error;
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    const oldCards = [...cards];

    // Optimistic delete
    setCards(cards.filter(card => card.id !== leadId));

    try {
      const response = await fetch(`/api/v1/leads/${leadId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error("Falha ao excluir o lead.");
      }

      toast({ title: "Sucesso", description: "Lead excluído com sucesso!" });
    } catch (error) {
      setCards(oldCards);
      toast({ variant: "destructive", title: "Erro", description: (error as Error).message });
      throw error;
    }
  };

  const handleAddCard = () => {
    setCreateOpen(true);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.stages.length > 0) count++;
    if (filters.priority.length > 0) count++;
    if (filters.assignedUsers.length > 0) count++;
    if (filters.teams.length > 0) count++;
    if (filters.connections.length > 0) count++;
    if (filters.tags.length > 0) count++;
    if (filters.valueMin !== null || filters.valueMax !== null) count++;
    if (filters.dateRange !== 'all') count++;
    return count;
  }, [filters]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!funnel) {
    return <div>Funil não encontrado.</div>;
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <Tabs defaultValue="kanban" className="flex-1 flex flex-col min-h-0">
        <div className="w-full border-b border-border/10 bg-zinc-100/80 dark:bg-black/40">
          <div className="px-4 py-3 flex justify-center">
            <TabsList className="bg-zinc-200/50 dark:bg-white/[0.02] p-1 border border-zinc-200 dark:border-white/5 rounded-2xl w-fit h-auto shadow-sm dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              <TabsTrigger
                value="kanban"
                className="rounded-xl px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/30 data-[state=active]:shadow-[0_0_15px_rgba(16,185,129,0.1),inset_0_0_10px_rgba(16,185,129,0.1)] border border-transparent text-muted-foreground hover:text-foreground"
              >
                <KanbanIcon className="h-4 w-4 mr-2" />
                Visualização do Funil
              </TabsTrigger>
              {/* <TabsTrigger
                value="agents"
                className="rounded-xl px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/30 data-[state=active]:shadow-[0_0_15px_rgba(16,185,129,0.1),inset_0_0_10px_rgba(16,185,129,0.1)] border border-transparent text-muted-foreground hover:text-foreground"
              >
                <Bot className="h-4 w-4 mr-2" />
                Agentes IA por Estágio
              </TabsTrigger> */}
              <TabsTrigger
                value="report"
                className="rounded-xl px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/30 data-[state=active]:shadow-[0_0_15px_rgba(16,185,129,0.1),inset_0_0_10px_rgba(16,185,129,0.1)] border border-transparent text-muted-foreground hover:text-foreground"
              >
                <BarChart2 className="h-4 w-4 mr-2" />
                Relatório
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="kanban" className="flex-1 mt-0 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
          <KanbanView
            funnel={funnel}
            cards={filteredCards}
            onMoveCard={handleMoveCard}
            onUpdateCards={fetchFunnelData}
            onUpdateLead={handleUpdateLead}
            onDeleteLead={handleDeleteLead}
            onAddCard={handleAddCard}
            onSearch={handleSearch}
            filters={filters}
            onFiltersChange={setFilters}
            activeFilterCount={activeFilterCount}
            companyUsers={companyUsers}
            companyTeams={companyTeams}
            connections={connections}
            availableTags={availableTags}
            availableUtms={availableUtms}
            availableCustomFields={availableCustomFields}
            availableCustomFieldValues={availableCustomFieldValues}
            customFieldSourceTypes={customFieldSourceTypes}
            onSaveFilters={handleSaveFilters}
            onClearSavedFilters={handleClearSavedFilters}
          />
        </TabsContent>

        {/* <TabsContent value="agents" className="flex-1 mt-0 min-h-0 overflow-auto p-4 data-[state=active]:flex data-[state=active]:flex-col">
          <StagePersonaConfig
            boardId={funnelId}
            stages={funnel.stages}
            funnelType={funnel.funnelType ?? undefined}
          />
        </TabsContent> */}

        <TabsContent value="report" className="flex-1 mt-0 min-h-0 overflow-auto data-[state=active]:flex data-[state=active]:flex-col">
          <FunnelReport boardId={funnelId} />
        </TabsContent>
      </Tabs>

      {/* CreateLeadDialog */}
      <CreateLeadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        boardId={funnelId}
        stages={funnel.stages}
        onCreated={fetchFunnelData}
      />
    </div>
  );
}
