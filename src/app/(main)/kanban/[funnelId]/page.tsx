// src/app/(main)/kanban/[funnelId]/page.tsx
'use client';

import { KanbanView } from '@/components/kanban/kanban-view';
import { StagePersonaConfig } from '@/components/kanban/stage-persona-config';
import type { KanbanFunnel, KanbanCard as KanbanCardType } from '@/lib/types';
import { use, useState, useEffect, useMemo } from 'react';
import { Loader2, Kanban as KanbanIcon, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { DropResult } from '@hello-pangea/dnd';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateLeadDialog } from '@/components/kanban/lead-dialogs';

export interface KanbanFilters {
  stages: string[];
  priority: string[];
  valueMin: number | null;
  valueMax: number | null;
  dateRange: 'all' | '7d' | '30d' | '90d';
}

const DEFAULT_FILTERS: KanbanFilters = {
  stages: [],
  priority: [],
  valueMin: null,
  valueMax: null,
  dateRange: 'all',
};

export default function FunnelPage({ params }: { params: Promise<{ funnelId: string }> }) {
  const { funnelId } = use(params);
  const [funnel, setFunnel] = useState<KanbanFunnel | null>(null);
  const [cards, setCards] = useState<KanbanCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<KanbanFilters>(DEFAULT_FILTERS);
  const { toast } = useToast();

  const fetchFunnelData = async () => {
    try {
      setLoading(true);
      const [funnelRes, leadsRes] = await Promise.all([
        fetch(`/api/v1/kanbans/${funnelId}`),
        fetch(`/api/v1/leads?boardId=${funnelId}`),
      ]);

      if (!funnelRes.ok || !leadsRes.ok) throw new Error('Falha ao carregar dados do funil.');

      const funnelData = await funnelRes.json();
      const leadsData = await leadsRes.json();

      setFunnel(funnelData);
      setCards(leadsData);

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

  // Filtrar cards com base em busca e filtros
  const filteredCards = useMemo(() => {
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

    // Filtro por data de criação
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const days = filters.dateRange === '7d' ? 7 : filters.dateRange === '30d' ? 30 : 90;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      result = result.filter(card => {
        if (!card.createdAt) return true;
        return new Date(card.createdAt) >= cutoff;
      });
    }

    return result;
  }, [cards, searchQuery, filters]);

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

  const handleUpdateLead = async (leadId: string, data: { stageId?: string; title?: string; value?: number | null; notes?: string }) => {
    const oldCards = [...cards];

    // Optimistic update - convert value to string for KanbanCard type
    const updateData: Partial<KanbanCardType> = {
      ...(data.stageId !== undefined && { stageId: data.stageId }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.value !== undefined && { value: data.value === null ? '' : data.value.toString() })
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
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent flex-shrink-0">
          <TabsTrigger
            value="kanban"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
          >
            <KanbanIcon className="h-4 w-4 mr-2" />
            Visualização do Funil
          </TabsTrigger>
          <TabsTrigger
            value="agents"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
          >
            <Bot className="h-4 w-4 mr-2" />
            Agentes IA por Estágio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="flex-1 mt-0 min-h-0">
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
          />
        </TabsContent>

        <TabsContent value="agents" className="flex-1 mt-0 min-h-0 overflow-auto p-4">
          <StagePersonaConfig
            boardId={funnelId}
            stages={funnel.stages}
            funnelType={funnel.funnelType ?? undefined}
          />
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
