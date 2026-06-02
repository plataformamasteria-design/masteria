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
  
  const getHeaderStyle = (type: string, idx: number) => {
    let glow = '';
    let textColor = '';
    
    if (type === 'WIN') {
      glow = 'border-t-emerald-500 shadow-[0_-10px_20px_-10px_rgba(16,185,129,0.3)]';
      textColor = 'text-emerald-400';
    } else if (type === 'LOSS') {
      glow = 'border-t-red-500 shadow-[0_-10px_20px_-10px_rgba(239,68,68,0.3)]';
      textColor = 'text-red-400';
    } else {
      const colors = [
        { glow: 'border-t-blue-500 shadow-[0_-10px_20px_-10px_rgba(59,130,246,0.3)]', text: 'text-blue-400' },
        { glow: 'border-t-indigo-500 shadow-[0_-10px_20px_-10px_rgba(99,102,241,0.3)]', text: 'text-indigo-400' },
        { glow: 'border-t-violet-500 shadow-[0_-10px_20px_-10px_rgba(139,92,246,0.3)]', text: 'text-violet-400' },
        { glow: 'border-t-fuchsia-500 shadow-[0_-10px_20px_-10px_rgba(217,70,239,0.3)]', text: 'text-fuchsia-400' },
        { glow: 'border-t-orange-500 shadow-[0_-10px_20px_-10px_rgba(249,115,22,0.3)]', text: 'text-orange-400' },
        { glow: 'border-t-amber-500 shadow-[0_-10px_20px_-10px_rgba(245,158,11,0.3)]', text: 'text-amber-400' },
        { glow: 'border-t-teal-500 shadow-[0_-10px_20px_-10px_rgba(20,184,166,0.3)]', text: 'text-teal-400' },
        { glow: 'border-t-cyan-500 shadow-[0_-10px_20px_-10px_rgba(6,182,212,0.3)]', text: 'text-cyan-400' }
      ];
      const color = colors[idx % colors.length];
      glow = color.glow;
      textColor = color.text;
    }

    return `bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5 border-t-2 ${glow} ${textColor}`;
  };

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden w-full md:w-[300px] md:min-w-[300px] md:max-w-[300px] lg:w-[320px] lg:min-w-[320px] lg:max-w-[320px] bg-zinc-50 dark:bg-white/[0.01] backdrop-blur-md rounded-2xl md:flex-1 md:min-h-[400px] transition-colors border border-zinc-200 dark:border-white/5 shadow-sm dark:shadow-[0_0_20px_rgba(0,0,0,0.3)]">
      <div className={`p-3 m-2 rounded-lg flex-shrink-0 flex flex-col gap-1 ${getHeaderStyle(stage.type, index)}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[13px] uppercase tracking-wide truncate">
            {stage.title}
          </h3>
          <Badge variant="secondary" className="bg-zinc-200/50 dark:bg-black/40 text-current hover:bg-zinc-200/50 dark:hover:bg-white/60 border-0 text-[10px] px-1.5 py-0 h-4">
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
