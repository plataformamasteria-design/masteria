'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { UserSearch, X } from 'lucide-react';

export const LookupLeadNode = memo(({ data, selected }: any) => {
    return (
        <div className={`px-5 py-4 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.1)] rounded-[1.5rem] bg-white/95 backdrop-blur-xl border ${selected ? 'border-cyan-500 ring-4 ring-cyan-500/10' : 'border-zinc-200/80'} min-w-[280px] animate-in zoom-in duration-200 group/node relative transition-all`}>
            {/* Botão de Excluir */}
            <button
                onClick={(e) => { e.stopPropagation(); data.onDelete?.(); }}
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
                <div className="p-2 bg-cyan-500/10 rounded-xl shadow-inner">
                    <UserSearch className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                    <span className="block text-[10px] font-black text-cyan-600 opacity-70 uppercase tracking-[0.2em]">CRM</span>
                    <span className="text-sm font-bold text-slate-900 tracking-tight">Buscar Lead</span>
                </div>
            </div>

            <div className="text-sm font-semibold text-gray-700 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                {data.phone_variable ? `📱 {{${data.phone_variable}}}` : 'Buscar por telefone...'}
            </div>

            {/* Saída: Lead Encontrado */}
            <div className="flex justify-between mt-3 text-[9px] font-bold tracking-wider px-1">
                <span className="text-emerald-600">✓ ENCONTRADO</span>
                <span className="text-amber-600">+ NOVO</span>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                id="found"
                className="!w-4 !h-4 !bg-white !border-[3px] !border-zinc-200 shadow-sm z-50 transition-transform hover:scale-125 !-bottom-[10px] !left-[30%]"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="not_found"
                className="!w-4 !h-4 !bg-white !border-[3px] !border-zinc-200 shadow-sm z-50 transition-transform hover:scale-125 !-bottom-[10px] !left-[70%]"
            />
        </div>
    );
});

LookupLeadNode.displayName = 'LookupLeadNode';
