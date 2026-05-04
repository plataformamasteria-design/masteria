'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const BotToggleNode = memo(({ data, selected }: any) => {
    const action = data.action || 'enable';
    const isEnable = action === 'enable';

    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white border ${selected ? 'border-green-500' : 'border-green-500/20'} min-w-[260px] max-w-[300px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-green-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={Bot}
                category="CRM & Ações"
                label={data.label || 'Robô I.A'}
                selected={selected}
                color={{ bg: 'bg-green-500/10', text: 'text-green-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className={`p-3 rounded-xl border shadow-inner text-center ${isEnable ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${isEnable ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    <div className={`w-2 h-2 rounded-full ${isEnable ? 'bg-green-500' : 'bg-red-500'}`} />
                    {isEnable ? 'Ativar Bot' : 'Desativar Bot'}
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-green-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

BotToggleNode.displayName = 'BotToggleNode';
