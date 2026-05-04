'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Megaphone, Link as LinkIcon, FileCheck, Send, X } from 'lucide-react';

const marketingIcons = {
    campaign: Megaphone,
    template: FileCheck,
    link: LinkIcon,
    direct: Send,
};

const marketingLabels = {
    campaign: 'Disparar Campanha',
    template: 'Enviar Template Meta',
    link: 'Gerar Link Rastreável',
    direct: 'Envio Direto',
};

export const MarketingNode = memo(({ data, selected }: any) => {
    const type = data.marketingType as keyof typeof marketingIcons || 'campaign';
    const Icon = marketingIcons[type];

    return (
        <div className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white border ${selected ? 'border-orange-600' : 'border-orange-500/20'} min-w-[260px]  animate-in zoom-in duration-200 group/node relative transition-all`}>
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
                className="!w-4 !h-4 !bg-white !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] shadow-md !-top-[10px] !left-1/2 !-translate-x-1/2 z-50 transition-transform hover:scale-125"
            />

            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-500/10 rounded-xl shadow-inner">
                    <Icon className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                    <span className="block text-[10px] font-black text-orange-600 opacity-70 uppercase tracking-[0.2em]">Marketing & Envios</span>
                    <span className="text-sm font-bold text-slate-900 tracking-tight">{marketingLabels[type]}</span>
                </div>
            </div>

            <div className="text-sm font-semibold text-gray-700 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                {data.description || 'Configurar ação de marketing...'}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-white !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] shadow-md !-bottom-[10px] !left-1/2 !-translate-x-1/2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

MarketingNode.displayName = 'MarketingNode';
