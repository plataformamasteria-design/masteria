'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Binary, CaseSensitive, Hash, Scissors, X } from 'lucide-react';

const utilityIcons = {
    format: CaseSensitive,
    extract: Scissors,
    math: Hash,
    transform: Binary,
};

const utilityLabels = {
    format: 'Formatar Dados',
    extract: 'Extrair Fragmento',
    math: 'Cálculo Matemático',
    transform: 'Transformação Custom',
};

export const UtilityNode = memo(({ data, selected }: any) => {
    const type = data.utilityType as keyof typeof utilityIcons || 'format';
    const Icon = utilityIcons[type];

    return (
        <div className={`px-5 py-4 shadow-[0_8px_30_px_rgb(0,0,0,0.04)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-amber-600' : 'border-amber-500/20'} min-w-[260px]  animate-in zoom-in duration-200 group/node relative transition-all`}>
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
                className="!w-4 !h-4 !bg-white dark:bg-zinc-900 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] shadow-md !-top-[10px] !left-1/2 !-translate-x-1/2 z-50 transition-transform hover:scale-125"
            />

            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl shadow-inner">
                    <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                    <span className="block text-[10px] font-black text-amber-600 dark:text-amber-400 opacity-70 uppercase tracking-[0.2em]">Utilitários de Dados</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">{utilityLabels[type]}</span>
                </div>
            </div>

            <div className="text-sm font-semibold text-gray-700 dark:text-zinc-200 bg-gray-50/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80">
                {data.description || 'Configurar utilitário...'}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-white dark:bg-zinc-900 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] shadow-md !-bottom-[10px] !left-1/2 !-translate-x-1/2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

UtilityNode.displayName = 'UtilityNode';
