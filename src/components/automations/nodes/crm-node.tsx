'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { LayoutDashboard, UserPlus, CreditCard, ClipboardList, X } from 'lucide-react';

const crmIcons = {
    move: LayoutDashboard,
    create: UserPlus,
    value: CreditCard,
    note: ClipboardList,
};

const crmLabels = {
    move: 'Mover no Kanban',
    create: 'Criar Novo Lead',
    value: 'Alterar Valor',
    note: 'Adicionar Nota',
};

export const CRMNode = memo(({ data, selected }: any) => {
    const type = data.crmType as keyof typeof crmIcons || 'move';
    const Icon = crmIcons[type];

    return (
        <div className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-emerald-600' : 'border-emerald-500/20'} min-w-[260px]  animate-in zoom-in duration-200 group/node relative transition-all`}>
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
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl shadow-inner">
                    <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <span className="block text-[10px] font-black text-emerald-600 dark:text-emerald-400 opacity-70 uppercase tracking-[0.2em]">CRM & Kanban</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">{crmLabels[type]}</span>
                </div>
            </div>

            <div className="text-sm font-semibold text-gray-700 dark:text-zinc-200 bg-gray-50/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80">
                {data.description || 'Configurar ação no CRM...'}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-white dark:bg-zinc-900 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] shadow-md !-bottom-[10px] !left-1/2 !-translate-x-1/2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

CRMNode.displayName = 'CRMNode';
