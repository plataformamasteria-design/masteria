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
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-green-500' : 'border-green-500/20'} min-w-[260px] max-w-[300px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-green-50 dark:bg-green-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={Bot}
                category="CRM & Ações"
                label={data.label || 'Robô I.A'}
                selected={selected}
                color={{ bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className={`p-3 rounded-xl border shadow-inner text-center ${isEnable ? 'bg-green-50 dark:bg-green-900/30 border-green-100 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800/50'}`}>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${isEnable ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                    <div className={`w-2 h-2 rounded-full ${isEnable ? 'bg-green-50 dark:bg-green-900/300' : 'bg-red-50 dark:bg-red-900/300'}`} />
                    {isEnable ? 'Ativar Bot' : 'Desativar Bot'}
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-green-50 dark:bg-green-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

BotToggleNode.displayName = 'BotToggleNode';
