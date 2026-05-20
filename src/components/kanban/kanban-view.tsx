// src/components/kanban/kanban-view.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
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

export function KanbanView({ funnel, cards, onMoveCard, onUpdateCards, onUpdateLead, onDeleteLead, onAddCard, onSearch, filters, onFiltersChange, activeFilterCount }: KanbanViewProps): JSX.Element | null {
  const [showLossStages, setShowLossStages] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Drag-to-Scroll refs and states
  const scrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const innerContentRef = useRef<HTMLDivElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!innerContentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContentWidth(entries[0].contentRect.width);
    });
    observer.observe(innerContentRef.current);
    return () => observer.disconnect();
  }, [funnel?.stages, showLossStages]);

  const handleTopScroll = () => {
    if (scrollRef.current && topScrollRef.current) {
      if (scrollRef.current.scrollLeft !== topScrollRef.current.scrollLeft) {
        scrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      }
    }
  };

  const handleBottomScroll = () => {
    if (scrollRef.current && topScrollRef.current) {
      if (topScrollRef.current.scrollLeft !== scrollRef.current.scrollLeft) {
        topScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Ignorar cliques em botões, links, inputs, menus e CARDS (drag-and-drop nativo)
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="menuitem"], [role="button"], [data-rbd-draggable-id]')) {
      return;
    }
    
    setIsDragging(true);
    if (!scrollRef.current) return;
    setStartX(e.clientX);
    setScrollLeft(scrollRef.current.scrollLeft);
    // Captura o ponteiro para continuar o drag mesmo se o mouse sair da div
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !scrollRef.current) return;
    // Evita seleção de texto durante o arraste
    e.preventDefault(); 
    const x = e.clientX;
    const walk = (x - startX) * 1.5; // Multiplicador de velocidade
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

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
      
      {/* Barra de Rolagem Superior */}
      <div 
        ref={topScrollRef} 
        onScroll={handleTopScroll}
        className="w-full overflow-x-auto custom-scrollbar border-b border-border/10 bg-muted/10 h-3"
      >
        <div style={{ width: contentWidth ? `${contentWidth}px` : '200%' }} className="h-1" />
      </div>

      <div 
        ref={scrollRef}
        onScroll={handleBottomScroll}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        className={`flex-1 min-h-0 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        <div className="p-3 sm:p-4 h-full">
          <DragDropContext onDragEnd={onMoveCard}>
            <div ref={innerContentRef} className="flex gap-4 h-full w-max min-w-full">
              {visibleStages.map((stage: KanbanStage, index: number) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  stages={funnel.stages}
                  cards={cards}
                  index={index}
                  onUpdateLead={onUpdateLead}
                  onDeleteLead={onDeleteLead}
                  onUpdateCards={onUpdateCards}
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
