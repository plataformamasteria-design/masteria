// src/components/kanban/kanban-view.tsx
'use client';

import { FunnelToolbar } from './funnel-toolbar';
import { KanbanColumn } from './kanban-column';
import type { KanbanFunnel, KanbanCard as KanbanCardType, KanbanStage } from '@/lib/types';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import type { KanbanFilters } from '@/app/(main)/kanban/[funnelId]/page';

interface KanbanViewProps {
  funnel: KanbanFunnel;
  cards: KanbanCardType[];
  onMoveCard: (result: DropResult) => void;
  onUpdateCards: () => void;
  onUpdateLead: (leadId: string, data: { stageId?: string; title?: string; value?: number | null; notes?: string }) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
  onAddCard?: () => void;
  onSearch?: (query: string) => void;
  filters?: KanbanFilters;
  onFiltersChange?: (filters: KanbanFilters) => void;
  activeFilterCount?: number;
}

export function KanbanView({ funnel, cards, onMoveCard, onUpdateLead, onDeleteLead, onAddCard, onSearch, filters, onFiltersChange, activeFilterCount }: KanbanViewProps): JSX.Element {
  if (!funnel || !funnel.stages) {
    return <div>Funil não encontrado ou sem etapas.</div>;
  }

  return (
    <div className="flex h-full flex-col min-h-0">
      <FunnelToolbar
        funnel={funnel}
        onAddCard={onAddCard}
        onSearch={onSearch}
        filters={filters}
        onFiltersChange={onFiltersChange}
        activeFilterCount={activeFilterCount}
      />
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-3 sm:p-4 min-h-full">
          <DragDropContext onDragEnd={onMoveCard}>
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 md:min-h-[500px]">
              {funnel.stages.map((stage: KanbanStage, index: number) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  stages={funnel.stages}
                  cards={cards}
                  index={index}
                  onUpdateLead={onUpdateLead}
                  onDeleteLead={onDeleteLead}
                />
              ))}
            </div>
          </DragDropContext>
        </div>
      </div>
    </div>
  );
}
