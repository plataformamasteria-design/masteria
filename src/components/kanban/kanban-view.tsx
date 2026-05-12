// src/components/kanban/kanban-view.tsx
'use client';

import { useState, useEffect } from 'react';
import { FunnelToolbar } from './funnel-toolbar';
import { KanbanColumn } from './kanban-column';
import type { KanbanFunnel, KanbanCard as KanbanCardType, KanbanStage } from '@/lib/types';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
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

export function KanbanView({ funnel, cards, onMoveCard, onUpdateLead, onDeleteLead, onAddCard, onSearch, filters, onFiltersChange, activeFilterCount }: KanbanViewProps): JSX.Element | null {
  const [showLossStages, setShowLossStages] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null; // Evita problema de hidratação com DragDropContext
  }

  if (!funnel || !funnel.stages) {
    return <div>Funil não encontrado ou sem etapas.</div>;
  }

  const lossStages = funnel.stages.filter(s => s.type === 'LOSS');
  const visibleStages = showLossStages ? funnel.stages : funnel.stages.filter(s => s.type !== 'LOSS');

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
            <div className="flex flex-col md:flex-row gap-0 md:min-h-[500px]">
              {visibleStages.map((stage: KanbanStage, index: number) => (
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

              {lossStages.length > 0 && (
                <div className="flex flex-col items-center justify-center min-w-[60px] border-l border-white/5 md:bg-transparent bg-muted/20">
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowLossStages(!showLossStages)}
                    className="flex flex-col gap-3 h-auto py-8 px-2 text-muted-foreground hover:bg-muted/50 rounded-none w-full border-0"
                  >
                    {showLossStages ? <EyeOff className="w-4 h-4 opacity-50" /> : <Eye className="w-4 h-4 opacity-50" />}
                    <span className="[writing-mode:vertical-rl] rotate-180 font-semibold tracking-widest uppercase text-[10px] opacity-70">
                      {showLossStages ? 'Ocultar Perdas' : `Ver Perdas (${lossStages.length})`}
                    </span>
                  </Button>
                </div>
              )}
            </div>
          </DragDropContext>
        </div>
      </div>
    </div>
  );
}
