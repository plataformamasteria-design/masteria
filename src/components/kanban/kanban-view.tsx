// src/components/kanban/kanban-view.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { FunnelToolbar } from './funnel-toolbar';
import { KanbanColumn } from './kanban-column';
import type { KanbanFunnel, KanbanCard as KanbanCardType, KanbanStage } from '@/lib/types';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { Eye, EyeOff, X } from 'lucide-react';
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
  companyUsers?: any[];
  companyTeams?: any[];
  connections?: any[];
  availableTags?: any[];
}

export function KanbanView({ funnel, cards, onMoveCard, onUpdateCards, onUpdateLead, onDeleteLead, onAddCard, onSearch, filters, onFiltersChange, activeFilterCount, companyUsers, companyTeams, connections, availableTags }: KanbanViewProps): JSX.Element | null {
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
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="menuitem"], [role="button"], [data-rbd-draggable-id]')) {
      return;
    }
    setIsDragging(true);
    if (!scrollRef.current) return;
    setStartX(e.clientX);
    setScrollLeft(scrollRef.current.scrollLeft);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault(); 
    const x = e.clientX;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  // --- Active Filter Chips ---
  const removeFilterChip = (type: keyof KanbanFilters, value: string) => {
    if (!filters || !onFiltersChange) return;
    const arr = filters[type] as string[];
    onFiltersChange({ ...filters, [type]: arr.filter(v => v !== value) });
  };

  const getChips = () => {
    if (!filters) return [];
    const chips: { type: keyof KanbanFilters; id: string; label: string; color: string }[] = [];

    filters.connections.forEach(id => {
      const conn = connections?.find(c => c.id === id);
      chips.push({ type: 'connections', id, label: conn?.config_name || conn?.configName || conn?.name || 'Conexão', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' });
    });

    filters.assignedUsers.forEach(id => {
      const user = companyUsers?.find(u => u.id === id);
      chips.push({ type: 'assignedUsers', id, label: user?.name || user?.email || 'Usuário', color: 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400' });
    });

    filters.teams.forEach(id => {
      const team = companyTeams?.find(t => t.id === id);
      chips.push({ type: 'teams', id, label: team?.name || 'Equipe', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400' });
    });

    filters.tags.forEach(id => {
      const tag = availableTags?.find(t => t.id === id);
      chips.push({ type: 'tags', id, label: tag?.name || 'Tag', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' });
    });

    filters.stages.forEach(id => {
      const stage = funnel?.stages?.find(s => s.id === id);
      chips.push({ type: 'stages', id, label: stage?.title || 'Etapa', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' });
    });

    return chips;
  };

  const chips = getChips();

  if (!isMounted) {
    return null;
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
        companyUsers={companyUsers}
        companyTeams={companyTeams}
        connections={connections}
        availableTags={availableTags}
      />

      {/* Active Filter Chips Row */}
      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/30 bg-muted/20 flex-wrap flex-shrink-0">
          <span className="text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wide mr-1">Filtrando:</span>
          {chips.map(chip => (
            <button
              key={`${chip.type}-${chip.id}`}
              onClick={() => removeFilterChip(chip.type, chip.id)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all hover:opacity-70 ${chip.color}`}
            >
              {chip.label}
              <X className="h-2.5 w-2.5" />
            </button>
          ))}
          {filters && (chips.length > 1) && (
            <button
              onClick={() => onFiltersChange?.({
                stages: [], priority: [], valueMin: null, valueMax: null,
                dateRange: 'all', assignedUsers: [], teams: [], connections: [], tags: [],
              })}
              className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-2 transition-colors ml-1"
            >
              Limpar tudo
            </button>
          )}
        </div>
      )}
      
      {/* Top Scroll Bar */}
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
