'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MessageCircle, Clock } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const WaitResponseNode = memo(({ data, selected }: any) => {
    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white border ${selected ? 'border-teal-500' : 'border-teal-500/20'} min-w-[280px] max-w-[320px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-teal-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={MessageCircle}
                category="Interação"
                label={data.label || 'Aguardar Resposta'}
                selected={selected}
                color={{ bg: 'bg-teal-500/10', text: 'text-teal-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                <div className="flex items-center justify-center gap-2 py-2">
                    <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-teal-600 font-semibold">Aguardando...</span>
                </div>
                {data.timeout_minutes && (
                    <div className="flex items-center gap-1.5 mt-2 justify-center text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span className="text-[10px] font-semibold">Timeout: {data.timeout_minutes} min</span>
                    </div>
                )}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-teal-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

WaitResponseNode.displayName = 'WaitResponseNode';
