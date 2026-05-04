'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

const unitLabels: Record<string, string> = {
    seconds: 'segundos',
    minutes: 'minutos',
    hours: 'horas',
    days: 'dias',
};

export const DelayNode = memo(({ data, selected }: any) => {
    const amount = data.amount || '';
    const unit = data.unit || 'minutes';

    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white border ${selected ? 'border-purple-500' : 'border-purple-500/20'} min-w-[260px] max-w-[300px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-purple-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={Clock}
                category="Lógica"
                label={data.label || 'Aguardar'}
                selected={selected}
                color={{ bg: 'bg-purple-500/10', text: 'text-purple-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-100">
                <div className="flex items-center justify-center gap-3">
                    <div className="text-center">
                        <span className="text-2xl font-black text-purple-600 tracking-tight">
                            {amount || '?'}
                        </span>
                        <span className="block text-[11px] text-purple-400 font-semibold mt-0.5">
                            {unitLabels[unit] || unit}
                        </span>
                    </div>
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-purple-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

DelayNode.displayName = 'DelayNode';
