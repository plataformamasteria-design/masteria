'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ShieldOff } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const StopBotNode = memo(({ data, selected }: any) => {
    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-red-500' : 'border-red-500/20'} min-w-[240px] max-w-[280px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-red-50 dark:bg-red-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={ShieldOff}
                category="CRM & Ações"
                label={data.label || 'Parar Automação'}
                selected={selected}
                color={{ bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded-xl border border-red-100 dark:border-red-800/50 shadow-inner text-center">
                <span className="text-xs text-red-500 font-semibold">
                    Encerrar permanentemente
                </span>
            </div>

            {/* Terminal node — no source handle */}
        </div>
    );
});

StopBotNode.displayName = 'StopBotNode';
