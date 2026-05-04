'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { StickyNote, X } from 'lucide-react';

export const AddNoteNode = memo(({ data, selected }: any) => {
    return (
        <div className={`px-5 py-4 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.1)] rounded-[1.5rem] bg-white/95 backdrop-blur-xl border ${selected ? 'border-amber-500 ring-4 ring-amber-500/10' : 'border-zinc-200/80'} min-w-[280px] animate-in zoom-in duration-200 group/node relative transition-all`}>
            {/* Botão de Excluir */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    data.onDelete?.();
                }}
                className={`absolute -top-3 -right-3 w-8 h-8 bg-white border-2 border-slate-200 rounded-full shadow-xl text-gray-400 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center transition-all z-[100] ${selected ? 'scale-100 opacity-100' : 'scale-0 opacity-0'} group-hover/node:scale-100 group-hover/node:opacity-100 active:scale-90`}
            >
                <X className="h-4 w-4" />
            </button>

            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-white !border-[3px] !border-zinc-200 shadow-sm z-50 transition-transform hover:scale-125 !-top-[10px] !left-1/2 !-translate-x-1/2"
            />

            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/10 rounded-xl shadow-inner">
                    <StickyNote className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                    <span className="block text-[10px] font-black text-amber-600 opacity-70 uppercase tracking-[0.2em]">CRM</span>
                    <span className="text-sm font-bold text-slate-900 tracking-tight">Adicionar Nota</span>
                </div>
            </div>

            <div className="text-sm font-semibold text-gray-700 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                {data.note_text
                    ? (data.note_text.length > 60 ? data.note_text.slice(0, 60) + '...' : data.note_text)
                    : 'Configurar nota interna...'}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-white !border-[3px] !border-zinc-200 shadow-sm z-50 transition-transform hover:scale-125 !-bottom-[10px] !left-1/2 !-translate-x-1/2"
            />
        </div>
    );
});

AddNoteNode.displayName = 'AddNoteNode';
