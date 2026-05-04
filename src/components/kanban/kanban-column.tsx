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

export function KanbanColumn({ stage, stages, cards, onUpdateLead, onDeleteLead }: KanbanColumnProps): JSX.Element {
  const stageCards = cards.filter(card => card.stageId === stage.id);
  const totalValue = stageCards.reduce((sum, card) => sum + (Number(card.value) || 0), 0);
  
  const getStageColor = (type: string) => {
    switch (type) {
      case 'WIN':
        return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800';
      case 'LOSS':
        return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
      default:
        return 'bg-background border-border';
    }
  };

  const getHeaderColor = (type: string) => {
    switch (type) {
      case 'WIN':
        return 'bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-800';
      case 'LOSS':
        return 'bg-red-100 dark:bg-red-900/50 border-red-200 dark:border-red-800';
      default:
        return 'bg-muted/50 border-border';
    }
  };

  return (
    <div className={`flex flex-col w-full md:w-[300px] md:min-w-[300px] md:max-w-[300px] lg:w-[320px] lg:min-w-[320px] lg:max-w-[320px] border rounded-lg shadow-sm ${getStageColor(stage.type)} md:flex-1 md:min-h-[400px] md:max-h-full`}>
      <div className={`p-3 border-b rounded-t-lg flex-shrink-0 ${getHeaderColor(stage.type)}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm truncate flex-1">{stage.title}</h3>
          <Badge variant="secondary" className="text-xs font-medium flex-shrink-0">
            {stageCards.length}
          </Badge>
        </div>
        {totalValue > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            R$ {totalValue.toLocaleString('pt-BR')}
          </p>
        )}
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
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                    Arraste leads para cá
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
