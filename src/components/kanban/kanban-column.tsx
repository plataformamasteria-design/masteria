// src/components/kanban/kanban-column.tsx
'use client';

import { Droppable } from '@hello-pangea/dnd';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import type { KanbanStage, KanbanCard as KanbanCardType } from '@/lib/types';
import { KanbanCard } from './kanban-card';

interface KanbanColumnProps {
  stage: KanbanStage;
  stages: KanbanStage[];
  cards: KanbanCardType[];
  index: number;
  onUpdateLead: (leadId: string, data: { stageId?: string; title?: string; value?: number | null; notes?: string }) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
}

export function KanbanColumn({ stage, stages, cards, index, onUpdateLead, onDeleteLead }: KanbanColumnProps): JSX.Element {
  const stageCards = cards.filter(card => card.stageId === stage.id);
  const totalValue = stageCards.reduce((sum, card) => sum + (Number(card.value) || 0), 0);
  
  const getTopBorderColor = (type: string, idx: number) => {
    if (type === 'WIN') return 'border-t-green-500';
    if (type === 'LOSS') return 'border-t-red-500';
    
    const colors = [
      'border-t-blue-500',
      'border-t-indigo-500',
      'border-t-purple-500',
      'border-t-pink-500',
      'border-t-orange-500',
      'border-t-amber-500',
      'border-t-teal-500',
      'border-t-cyan-500'
    ];
    return colors[idx % colors.length];
  };

  return (
    <div className="flex flex-col w-full md:w-[300px] md:min-w-[300px] md:max-w-[300px] lg:w-[320px] lg:min-w-[320px] lg:max-w-[320px] border-r border-border/40 bg-transparent md:flex-1 md:min-h-[400px] md:max-h-full last:border-r-0">
      <div className={`p-3 border-b border-border/40 flex-shrink-0 border-t-2 ${getTopBorderColor(stage.type, index)} bg-muted/30`}>
        <h3 className="font-bold text-[11px] uppercase tracking-wider text-foreground/90 truncate text-center mb-1">
          {stage.title}
        </h3>
        <p className="text-[11px] text-muted-foreground/80 text-center font-medium">
          {stageCards.length} {stageCards.length === 1 ? 'lead' : 'leads'}: R$ {totalValue.toLocaleString('pt-BR')}
        </p>
      </div>
      
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-0 overflow-hidden transition-colors ${
              snapshot.isDraggingOver ? 'bg-primary/5' : ''
            }`}
          >
            <ScrollArea className="h-full">
              <div className="p-2 space-y-2">
                {stageCards.length === 0 && !snapshot.isDraggingOver && (
                  <div className="flex items-center justify-center py-8 text-[11px] uppercase tracking-wider text-muted-foreground/40 font-medium">
                    Sem leads
                  </div>
                )}
                {stageCards.map((card, cardIndex) => (
                  <KanbanCard 
                    key={card.id} 
                    card={card} 
                    index={cardIndex}
                    stages={stages}
                    onUpdate={onUpdateLead}
                    onDelete={onDeleteLead}
                  />
                ))}
                {provided.placeholder}
              </div>
            </ScrollArea>
          </div>
        )}
      </Droppable>
    </div>
  );
}
