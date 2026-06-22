'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { RefreshCw } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

const unitLabels: Record<string, string> = {
    minutes: 'minutos',
    hours: 'horas',
    days: 'dias',
};

export const LoopRestartNode = memo(({ data, selected }: any) => {
    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-orange-500' : 'border-orange-500/20'} min-w-[260px] max-w-[300px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-orange-50 dark:bg-orange-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={RefreshCw}
                category="CRM & Ações"
                label={data.label || 'Loop (Reiniciar)'}
                selected={selected}
                color={{ bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-orange-50 dark:bg-orange-900/30 p-3 rounded-xl border border-orange-100 dark:border-orange-800/50 shadow-inner text-center">
                <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 text-orange-500 animate-spin" style={{ animationDuration: '3s' }} />
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                        {data.delay_amount || '?'} {unitLabels[data.delay_unit] || data.delay_unit || 'min'}
                    </span>
                </div>
                <span className="text-[10px] text-orange-400 mt-1 block">Reiniciar fluxo após delay</span>
            </div>

            {/* Terminal node — no source handle (loops back to trigger) */}
        </div>
    );
});

LoopRestartNode.displayName = 'LoopRestartNode';
