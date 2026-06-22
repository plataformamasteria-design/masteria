'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { UserPlus } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const CaptureInfoNode = memo(({ data, selected }: any) => {
    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-cyan-500' : 'border-cyan-500/20'} min-w-[280px] max-w-[320px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-cyan-50 dark:bg-cyan-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={UserPlus}
                category="Interação"
                label={data.label || 'Capturar Informação'}
                selected={selected}
                color={{ bg: 'bg-cyan-50 dark:bg-cyan-900/30', text: 'text-cyan-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-gray-50 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80 space-y-2">
                {data.field_key && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider">Campo:</span>
                        <span className="text-xs font-mono text-gray-500 dark:text-zinc-400 bg-cyan-50 dark:bg-cyan-900/30 px-2 py-0.5 rounded">{data.field_key}</span>
                    </div>
                )}
                <p className="text-sm text-gray-500 dark:text-zinc-400 line-clamp-2">
                    {data.prompt_message || 'Mensagem de captura...'}
                </p>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-cyan-50 dark:bg-cyan-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

CaptureInfoNode.displayName = 'CaptureInfoNode';
