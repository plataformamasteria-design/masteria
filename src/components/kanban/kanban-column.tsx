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
  onUpdateCards?: () => void;
  companyUsers?: any[];
  onOpenCard: (card: KanbanCardType, tab?: 'overview' | 'chat') => void;
  onOpenMeetingTime: (card: KanbanCardType) => void;
  onOpenDelete: (card: KanbanCardType) => void;
  boardSettings?: any;
}

export function KanbanColumn({ stage, stages, cards, index, onUpdateLead, onDeleteLead, onUpdateCards, companyUsers = [], onOpenCard, onOpenMeetingTime, onOpenDelete, boardSettings }: KanbanColumnProps): JSX.Element {
  const stageCards = cards.filter(card => card.stageId === stage.id);
  const totalValue = stageCards.reduce((sum, card) => sum + (Number(card.value) || 0), 0);
  
  const getHeaderColor = (type: string, idx: number) => {
    if (type === 'WIN') return 'bg-green-500/10 text-green-700 dark:text-green-400';
    if (type === 'LOSS') return 'bg-red-500/10 text-red-700 dark:text-red-400';
    
    const colors = [
      'bg-blue-500/10 text-blue-700 dark:text-blue-400',
      'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
      'bg-purple-500/10 text-purple-700 dark:text-purple-400',
      'bg-pink-500/10 text-pink-700 dark:text-pink-400',
      'bg-orange-500/10 text-orange-700 dark:text-orange-400',
      'bg-amber-500/10 text-amber-700 dark:text-amber-400',
      'bg-teal-500/10 text-teal-700 dark:text-teal-400',
      'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400'
    ];
    return colors[idx % colors.length];
  };

  return (
    <div className="flex flex-col w-full md:w-[300px] md:min-w-[300px] md:max-w-[300px] lg:w-[320px] lg:min-w-[320px] lg:max-w-[320px] bg-zinc-50 dark:bg-zinc-900/40 rounded-xl md:flex-1 md:min-h-[400px] md:max-h-full transition-colors border border-border/40">
      <div className={`p-3 m-2 rounded-lg flex-shrink-0 flex flex-col gap-1 ${getHeaderColor(stage.type, index)}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[13px] uppercase tracking-wide truncate">
            {stage.title}
          </h3>
          <Badge variant="secondary" className="bg-white/60 dark:bg-black/40 text-current hover:bg-white/60 border-0 text-[10px] px-1.5 py-0 h-4">
            {stageCards.length}
          </Badge>
        </div>
        {totalValue > 0 && (
          <p className="text-[10px] opacity-80 font-medium">
            R$ {totalValue.toLocaleString('pt-BR')}
          </p>
        )}
      </div>
      
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-0 overflow-hidden transition-all duration-300 ${
              snapshot.isDraggingOver ? 'bg-primary/5 ring-1 ring-primary/20 ring-inset' : ''
            }`}
          >
            <ScrollArea className="h-full custom-scrollbar">
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
                    onUpdateCards={onUpdateCards}
                    companyUsers={companyUsers}
                    onOpenCard={onOpenCard}
                    onOpenMeetingTime={onOpenMeetingTime}
                    onOpenDelete={onOpenDelete}
                    boardSettings={boardSettings}
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
