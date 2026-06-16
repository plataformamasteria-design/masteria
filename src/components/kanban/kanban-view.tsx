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
import { LeadExpansiveDrawer } from './lead-expansive-drawer';
import { AddMeetingTimeDialog, DeleteLeadDialog } from './lead-dialogs';

interface KanbanViewProps {
  funnel: KanbanFunnel;
  cards: KanbanCardType[];
  onMoveCard: (result: DropResult) => void;
  onUpdateCards: () => void;
  onUpdateLead: (leadId: string, data: { stageId?: string; title?: string; value?: number | null; notes?: string; customFields?: Record<string, string> }) => Promise<void>;
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
  availableCustomFields?: Record<string, string[]>;
  availableCustomFieldValues?: Record<string, string[]>;
  customFieldSourceTypes?: Record<string, 'automation' | 'webhook' | 'unknown'>;
  onSaveFilters?: () => void;
  onClearSavedFilters?: () => void;
}
export function KanbanView({ funnel, cards, onMoveCard, onUpdateCards, onUpdateLead, onDeleteLead, onAddCard, onSearch, filters, onFiltersChange, activeFilterCount, companyUsers, companyTeams, connections, availableTags, availableUtms, availableCustomFields, availableCustomFieldValues, customFieldSourceTypes, onSaveFilters, onClearSavedFilters }: KanbanViewProps): JSX.Element | null {
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

  // Lifted state for Lead Drawer and Dialogs
  const [selectedCard, setSelectedCard] = useState<KanbanCardType | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [initialDrawerTab, setInitialDrawerTab] = useState<'overview' | 'chat'>('overview');
  
  const [meetingTimeCard, setMeetingTimeCard] = useState<KanbanCardType | null>(null);
  const [deleteCard, setDeleteCard] = useState<KanbanCardType | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!innerContentRef.current || !scrollRef.current) return;
    
    const updateWidth = () => {
      if (scrollRef.current) {
        // scrollWidth gives the exact total width including padding
        setContentWidth(scrollRef.current.scrollWidth);
      }
    };

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    
    observer.observe(innerContentRef.current);
    observer.observe(scrollRef.current);
    
    // Initial update
    setTimeout(updateWidth, 50);

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
    // Only intercept if we are clicking on the background (the scroll area)
    // Avoid intercepting if we are on a Kanban Card or a button
    const target = e.target as HTMLElement;
    if (target.closest('.kanban-card-container, button, a, input, textarea, select, [role="menuitem"], [role="button"], [role="option"], [role="dialog"], [role="listbox"], [data-radix-popper-content-wrapper], [data-rbd-draggable-id]')) {
      return;
    }
    setIsDragging(true);
    if (!scrollRef.current) return;
    setStartX(e.clientX);
    setScrollLeft(scrollRef.current.scrollLeft);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !scrollRef.current) return;
    // Don't preventDefault if it breaks natural interactions, but needed for custom drag-scroll
    e.preventDefault(); 
    const x = e.clientX;
    const walk = (x - startX) * 2; // Velocidade de arraste aumentada para 2
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const removeFilterChip = (type: string, value: string) => {
    if (!filters || !onFiltersChange) return;
    
    if (type === 'customFieldValues') {
      const [fieldKey, val] = value.split(':::');
      const currentValues = filters.customFieldValues?.[fieldKey] || [];
      const newValues = currentValues.filter(v => v !== val);
      onFiltersChange({
        ...filters,
        customFieldValues: {
          ...filters.customFieldValues,
          [fieldKey]: newValues
        }
      });
      return;
    }

    const arr = filters[type as keyof KanbanFilters] as string[];
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
      const label = tag?.name || 'Tag';
      chips.push({ type: 'tags', id, label: label.length > 25 ? label.substring(0, 25) + '...' : label, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' });
    });

    filters.stages.forEach(id => {
      const stage = funnel?.stages?.find(s => s.id === id);
      const label = stage?.title || 'Etapa';
      chips.push({ type: 'stages', id, label: label.length > 25 ? label.substring(0, 25) + '...' : label, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' });
    });

    filters.utms?.forEach(utm => {
      chips.push({ type: 'utms', id: utm, label: utm.length > 25 ? utm.substring(0, 25) + '...' : utm, color: 'bg-pink-500/10 text-pink-600 border-pink-500/20 dark:text-pink-400' });
    });

    filters.customFields?.forEach(cf => {
      chips.push({ type: 'customFields', id: cf, label: cf.length > 25 ? cf.substring(0, 25) + '...' : cf, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' });
    });

    Object.entries(filters.customFieldValues || {}).forEach(([fieldKey, values]) => {
      values.forEach(val => {
        const lbl = `${fieldKey}: ${val}`;
        chips.push({ type: 'customFieldValues', id: `${fieldKey}:::${val}`, label: lbl.length > 30 ? lbl.substring(0, 30) + '...' : lbl, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400' });
      });
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
        totalLeadsCount={cards.length}
        onAddCard={onAddCard}
        onSearch={onSearch}
        filters={filters}
        onFiltersChange={onFiltersChange}
        activeFilterCount={activeFilterCount}
        companyUsers={companyUsers}
        companyTeams={companyTeams}
        connections={connections}
        availableTags={availableTags}
        availableUtms={availableUtms}
        availableCustomFields={availableCustomFields}
        availableCustomFieldValues={availableCustomFieldValues}
        customFieldSourceTypes={customFieldSourceTypes}
        onSaveFilters={onSaveFilters}
        onClearSavedFilters={onClearSavedFilters}
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
                dateRange: 'all', dateFrom: null, dateTo: null, assignedUsers: [], teams: [], connections: [], tags: [], utms: [], customFields: [], customFieldValues: {},
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
        className={`flex-1 min-h-0 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        <div className="h-full inline-block min-w-full">
          <DragDropContext onDragEnd={onMoveCard}>
            <div ref={innerContentRef} className="flex gap-4 h-full px-3 sm:px-4 py-3 sm:py-4 pb-8" style={{ width: 'max-content' }}>
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
                  companyUsers={companyUsers}
                  onOpenCard={(card, tab) => {
                    setSelectedCard(card);
                    setInitialDrawerTab(tab || 'overview');
                    setDrawerOpen(true);
                  }}
                  onOpenMeetingTime={(card) => setMeetingTimeCard(card)}
                  onOpenDelete={(card) => setDeleteCard(card)}
                  boardSettings={funnel.settings}
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
      {selectedCard && (
        <LeadExpansiveDrawer
          open={drawerOpen}
          onOpenChange={(open) => {
            setDrawerOpen(open);
            if (!open) setTimeout(() => setSelectedCard(null), 300); // cleanup after animation
          }}
          card={selectedCard}
          stages={funnel.stages}
          initialTab={initialDrawerTab}
          onUpdate={onUpdateLead}
          onDelete={onDeleteLead}
          onOpenWhatsApp={() => {
            setInitialDrawerTab('chat');
            setDrawerOpen(true);
          }}
          onUpdateCards={onUpdateCards}
        />
      )}

      {meetingTimeCard && (
        <AddMeetingTimeDialog 
          open={!!meetingTimeCard} 
          onOpenChange={(open) => !open && setMeetingTimeCard(null)} 
          card={meetingTimeCard} 
          onSave={onUpdateLead} 
        />
      )}

      {deleteCard && (
        <DeleteLeadDialog 
          open={!!deleteCard} 
          onOpenChange={(open) => !open && setDeleteCard(null)} 
          card={deleteCard} 
          onConfirm={onDeleteLead} 
        />
      )}
    </div>
  );
}
