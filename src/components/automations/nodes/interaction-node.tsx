'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { UserPlus, MessageCircle, X } from 'lucide-react';

const icons = {
    capture: UserPlus,
    wait_response: MessageCircle,
};

const colors = {
    capture: 'text-fuchsia-500',
    wait_response: 'text-violet-500',
};

const bgColors = {
    capture: 'bg-fuchsia-50 dark:bg-fuchsia-900/30',
    wait_response: 'bg-violet-50 dark:bg-violet-900/30',
};

const borderColors = {
    capture: 'border-fuchsia-500/30',
    wait_response: 'border-violet-500/30',
};

const labels = {
    capture: 'Capturar Info',
    wait_response: 'Aguardar Lead',
};

export const InteractionNode = memo(({ data, selected }: any) => {
    const type = data.interactionType as keyof typeof icons || 'capture';
    const Icon = icons[type];

    return (
        <div className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-primary' : borderColors[type]} min-w-[240px]  animate-in zoom-in duration-200 group/node relative transition-all`}>
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
                className="!w-4 !h-4 !bg-white dark:bg-zinc-900 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] !-top-[10px] shadow-md transition-transform hover:scale-125 z-50"
            />
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 ${bgColors[type]} rounded-xl shadow-inner`}>
                    <Icon className={`h-5 w-5 ${colors[type]}`} />
                </div>
                <div>
                    <span className={`block text-[10px] font-black ${colors[type]} opacity-70 uppercase tracking-[0.2em]`}>Input Interativo</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">{labels[type]}</span>
                </div>
            </div>

            <div className="space-y-3">
                <div className="text-[10px] text-gray-400 dark:text-zinc-400 font-black uppercase tracking-widest pl-1 opacity-60">
                    {type === 'capture' ? 'Armazenar em' : 'Condição de Retomada'}
                </div>
                <div className="text-sm text-gray-700 dark:text-zinc-200 font-mono bg-gray-50/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80 flex items-center justify-between group">
                    {type === 'capture' ? (
                        <>
                            <span className="font-bold">{data.field || 'selecionar_campo'}</span>
                            <span className="text-[10px] text-fuchsia-600 dark:text-fuchsia-400 underline cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">Editar</span>
                        </>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-600 animate-pulse shadow-[0_0_8px_rgba(124,58,237,0.5)]" />
                            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Próxima interação...</span>
                        </div>
                    )}
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-white dark:bg-zinc-900 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] !-bottom-[10px] shadow-md transition-transform hover:scale-125 z-50"
            />
        </div>
    );
});

InteractionNode.displayName = 'InteractionNode';
