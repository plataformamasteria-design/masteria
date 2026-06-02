"use client";

import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Bot, User, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

type Lead = {
  id: string;
  name: string;
  avatar: string;
  value: string;
  tag: string;
  tagColor: string;
  aiActive: boolean;
  time: string;
};

type Column = {
  id: string;
  title: string;
  leads: Lead[];
  color: string;
};

const initialData: Column[] = [
  {
    id: "col-1",
    title: "Novos Leads",
    color: "bg-blue-500",
    leads: [
      {
        id: "lead-1",
        name: "Carlos Eduardo",
        avatar: "CE",
        value: "R$ 1.500",
        tag: "Novo",
        tagColor: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20 dark:border-blue-500/30",
        aiActive: true,
        time: "Agora",
      },
      {
        id: "lead-2",
        name: "Mariana Silva",
        avatar: "MS",
        value: "R$ 4.200",
        tag: "Indicação",
        tagColor: "bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/20 dark:border-purple-500/30",
        aiActive: false,
        time: "5m atrás",
      },
    ],
  },
  {
    id: "col-2",
    title: "Atendimento IA",
    color: "bg-emerald-500",
    leads: [
      {
        id: "lead-3",
        name: "Tech Solutions Inc",
        avatar: "TS",
        value: "R$ 12.000",
        tag: "B2B VIP",
        tagColor: "bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 dark:border-yellow-500/30",
        aiActive: true,
        time: "Conversando",
      },
    ],
  },
  {
    id: "col-3",
    title: "Negociação",
    color: "bg-orange-500",
    leads: [
      {
        id: "lead-4",
        name: "Roberto Almeida",
        avatar: "RA",
        value: "R$ 3.800",
        tag: "Quente",
        tagColor: "bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/20 dark:border-orange-500/30",
        aiActive: false,
        time: "Aguardando",
      },
      {
        id: "lead-5",
        name: "Clínica Vida",
        avatar: "CV",
        value: "R$ 8.900",
        tag: "Fechamento",
        tagColor: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30",
        aiActive: true,
        time: "Reunião",
      },
    ],
  },
];

export function KanbanSimulation() {
  const [columns, setColumns] = useState<Column[]>(initialData);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;

    if (source.droppableId !== destination.droppableId) {
      const sourceColIndex = columns.findIndex((c) => c.id === source.droppableId);
      const destColIndex = columns.findIndex((c) => c.id === destination.droppableId);
      const sourceCol = columns[sourceColIndex];
      const destCol = columns[destColIndex];
      const sourceLeads = [...sourceCol.leads];
      const destLeads = [...destCol.leads];
      const [removed] = sourceLeads.splice(source.index, 1);
      
      // If dropping into Atendimento IA, turn on AI flag
      if (destination.droppableId === "col-2") {
          removed.aiActive = true;
          removed.time = "Analisando...";
      }

      destLeads.splice(destination.index, 0, removed);

      const newColumns = [...columns];
      newColumns[sourceColIndex] = { ...sourceCol, leads: sourceLeads };
      newColumns[destColIndex] = { ...destCol, leads: destLeads };
      setColumns(newColumns);
    } else {
      const colIndex = columns.findIndex((c) => c.id === source.droppableId);
      const col = columns[colIndex];
      const copiedLeads = [...col.leads];
      const [removed] = copiedLeads.splice(source.index, 1);
      copiedLeads.splice(destination.index, 0, removed);
      const newColumns = [...columns];
      newColumns[colIndex] = { ...col, leads: copiedLeads };
      setColumns(newColumns);
    }
  };

  if (!isMounted) {
    return (
      <div className="aspect-[16/9] w-full bg-zinc-100/40 dark:bg-zinc-950/40 rounded-xl border border-zinc-200 dark:border-white/5 flex items-center justify-center">
        <div className="animate-pulse flex space-x-4">
          <div className="h-64 w-48 bg-zinc-200 dark:bg-white/5 rounded-lg"></div>
          <div className="h-64 w-48 bg-zinc-200 dark:bg-white/5 rounded-lg"></div>
          <div className="h-64 w-48 bg-zinc-200 dark:bg-white/5 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden select-none">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex w-full gap-4 sm:gap-6 p-2 overflow-x-auto custom-scrollbar snap-x snap-mandatory">
          {columns.map((column) => (
            <div key={column.id} className="flex-1 min-w-[280px] snap-center">
              {/* Header da Coluna */}
              <div className="flex items-center space-x-2 mb-4 px-2">
                <div className={`h-2.5 w-2.5 rounded-full ${column.color} shadow-[0_0_8px_currentColor] opacity-80`} />
                <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 tracking-wide text-sm uppercase">{column.title}</h3>
                <span className="ml-auto text-xs font-medium text-zinc-500 bg-zinc-200 dark:bg-white/5 px-2 py-0.5 rounded-full border border-zinc-300 dark:border-white/5">
                  {column.leads.length}
                </span>
              </div>

              {/* Zona de Drop */}
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`min-h-[400px] flex flex-col gap-3 rounded-2xl bg-zinc-100/50 dark:bg-zinc-900/30 border p-3 transition-colors duration-300 ${
                      snapshot.isDraggingOver ? "border-emerald-500/30 bg-emerald-500/5 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]" : "border-zinc-200 dark:border-white/5"
                    }`}
                  >
                    {column.leads.map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                            }}
                            className={`relative group bg-white/80 dark:bg-zinc-950/80 border rounded-xl p-4 cursor-grab active:cursor-grabbing backdrop-blur-xl transition-shadow ${
                              snapshot.isDragging ? "border-emerald-400 shadow-[0_10px_30px_rgba(16,185,129,0.2)] z-50 scale-105" : "border-zinc-200 dark:border-white/10 shadow-md hover:border-zinc-300 dark:hover:border-white/20"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md border ${lead.tagColor}`}>
                                {lead.tag}
                              </span>
                              
                              {lead.aiActive && (
                                <motion.div 
                                  initial={{ opacity: 0.5 }}
                                  animate={{ opacity: [0.5, 1, 0.5] }}
                                  transition={{ repeat: Infinity, duration: 2 }}
                                  className="flex items-center space-x-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20"
                                  title="Robô da IA Operando"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span className="text-[10px] font-semibold">IA Ativa</span>
                                </motion.div>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-3 mb-4">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-900 border border-zinc-300 dark:border-white/10 text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                {lead.avatar}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{lead.name}</h4>
                                <p className="text-xs text-zinc-500 font-medium">{lead.value}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs text-zinc-500 mt-2 pt-3 border-t border-zinc-200 dark:border-white/5">
                              <div className="flex items-center space-x-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{lead.time}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                {lead.aiActive ? (
                                  <Bot className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <User className="w-4 h-4 text-zinc-400" />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
