'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { UserPlus, X } from 'lucide-react';

export const AssignUserNode = memo(({ data, selected }: any) => {
    
    // Determine the label to show based on config
    let assignmentLabel = 'Não configurado';
    if (data.assign_type === 'user') {
        assignmentLabel = `Agente: ${data.user_id ? 'Configurado' : 'Pendente'}`;
    } else if (data.assign_type === 'team') {
        assignmentLabel = `Equipe: ${data.team_id ? 'Configurado' : 'Pendente'}`;
    } else if (data.assign_type === 'random_in_team') {
        assignmentLabel = `Aleatório: ${data.team_id ? 'Equipe selecionada' : 'Pendente'}`;
    }

    return (
        <div className={`px-5 py-4 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.1)] rounded-[1.5rem] bg-white/95 backdrop-blur-xl border ${selected ? 'border-fuchsia-500 ring-4 ring-fuchsia-500/10' : 'border-zinc-200/80'} min-w-[280px] animate-in zoom-in duration-200 group/node relative transition-all`}>
            {/* Botão de Excluir */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    data.onDelete?.();
                }}
                className={`absolute -top-3 -right-3 w-8 h-8 bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-full shadow-xl text-gray-400 dark:text-zinc-400 hover:text-rose-600 dark:text-rose-400 hover:border-rose-200 dark:border-rose-800 flex items-center justify-center transition-all z-[100] ${selected ? 'scale-100 opacity-100' : 'scale-0 opacity-0'} group-hover/node:scale-100 group-hover/node:opacity-100 active:scale-90`}
            >
                <X className="h-4 w-4" />
            </button>

            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-fuchsia-50 dark:bg-fuchsia-900/300 !border-[3px] !border-zinc-100 dark:border-zinc-800/80 shadow-sm z-50 transition-transform hover:scale-125 !-top-2 !left-1/2 !-translate-x-1/2"
            />

            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-fuchsia-50 dark:bg-fuchsia-900/30 rounded-xl shadow-inner">
                    <UserPlus className="h-5 w-5 text-fuchsia-600 dark:text-fuchsia-400" />
                </div>
                <div>
                    <span className="block text-[10px] font-black text-fuchsia-600 dark:text-fuchsia-400 opacity-70 uppercase tracking-[0.2em]">AÇÃO</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">Atribuição</span>
                </div>
            </div>

            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-50/80 dark:bg-zinc-900/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800">
                {assignmentLabel}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-fuchsia-50 dark:bg-fuchsia-900/300 !border-[3px] !border-zinc-100 dark:border-zinc-800/80 shadow-sm z-50 transition-transform hover:scale-125 !-bottom-2 !left-1/2 !-translate-x-1/2"
            />
        </div>
    );
});

AssignUserNode.displayName = 'AssignUserNode';
