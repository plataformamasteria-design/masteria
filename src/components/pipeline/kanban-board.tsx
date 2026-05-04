'use client';

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    closestCorners,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LeadCard } from "./lead-card";
import { moveLeadDrop } from "@/app/actions/kanban";

export interface KanbanStage {
    id: string;
    name: string;
    color: string | null;
    leads: any[];
}

interface KanbanBoardProps {
    funnelId: string;
    initialStages: KanbanStage[];
}

// Internal column component for droppable area
function KanbanColumn({ stage, children }: { stage: KanbanStage, children: React.ReactNode }) {
    const { setNodeRef } = useDroppable({
        id: stage.id,
    });

    return (
        <div className="flex-shrink-0 w-80 flex flex-col">
            <Card className="glass border-white/10 dark:bg-neutral-900/40 flex-1 flex flex-col h-[70vh]">
                <CardContent className="p-4 flex flex-col h-full">
                    <div
                        className="flex items-center gap-3 pb-3 mb-2"
                        style={{ borderBottom: `2px solid ${stage.color || '#3b82f6'}` }}
                    >
                        <div
                            className="w-3.5 h-3.5 rounded-full shadow-sm"
                            style={{ backgroundColor: stage.color || '#3b82f6' }}
                        />
                        <h3 className="font-semibold text-sm tracking-tight">{stage.name}</h3>
                        <span className="text-xs text-muted-foreground ml-auto bg-muted px-2 py-0.5 rounded-full font-mono">
                            {stage.leads.length}
                        </span>
                    </div>

                    <ScrollArea className="flex-1 pr-3 -mr-3" ref={setNodeRef}>
                        <div className="min-h-[150px] pb-4">
                            {children}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div >
    );
}

export function KanbanBoard({ funnelId, initialStages }: KanbanBoardProps) {
    const [stages, setStages] = useState<KanbanStage[]>(initialStages);
    const [activeId, setActiveId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        setStages(initialStages);
    }, [initialStages]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const leadId = active.id as string;
        const overId = over.id as string; // Could be a column ID or another lead ID

        // Find source and destination stages
        let sourceStageId: string | null = null;
        let destStageId: string | null = null;

        stages.forEach(stage => {
            // Is source?
            if (stage.leads.some(l => l.id === leadId)) sourceStageId = stage.id;
            // Is direct drop on column?
            if (stage.id === overId) destStageId = stage.id;
            // Is drop on another item?
            if (stage.leads.some(l => l.id === overId)) destStageId = stage.id;
        });

        if (!sourceStageId || !destStageId || sourceStageId === destStageId) return;

        // Optimistic UI update
        const leadToMove = stages.find(s => s.id === sourceStageId)?.leads.find(l => l.id === leadId);
        if (!leadToMove) return;

        setStages(prev => prev.map(stage => {
            if (stage.id === sourceStageId) {
                return { ...stage, leads: stage.leads.filter(l => l.id !== leadId) };
            }
            if (stage.id === destStageId) {
                return { ...stage, leads: [leadToMove, ...stage.leads] };
            }
            return stage;
        }));

        // Server action
        try {
            await moveLeadDrop(leadId, funnelId, destStageId);
        } catch (e) {
            // Revert on fail
            toast({ title: "Erro ao mover card", variant: "destructive" });
            setStages(initialStages);
        }
    };

    const activeLead = activeId
        ? stages.flatMap(s => s.leads).find(l => l.id === activeId)
        : null;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="w-full overflow-x-auto custom-scrollbar pb-6">
                <div className="flex gap-4 items-stretch px-1" style={{ minWidth: 'max-content' }}>
                    {stages.map((stage) => (
                        <KanbanColumn key={stage.id} stage={stage}>
                            <SortableContext
                                items={stage.leads.map(l => l.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {stage.leads.map((lead) => (
                                    <LeadCard key={lead.id} lead={lead} />
                                ))}
                            </SortableContext>
                        </KanbanColumn>
                    ))}
                </div>
            </div>

            <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                {activeLead ? (
                    <div className="rotate-2 scale-105 opacity-90 shadow-2xl">
                        <LeadCard lead={activeLead} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
