'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Send } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const SendAiResponseNode = memo(({ data, selected }: any) => {
    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white border ${selected ? 'border-emerald-600' : 'border-emerald-500/30'} min-w-[260px] max-w-[300px] ring-1 ring-emerald-500/10 animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-emerald-600 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-t-2xl" />

            <NodeHeader
                icon={Send}
                category="Inteligência I.A"
                label={data.label || 'Enviar Resposta I.A'}
                selected={selected}
                color={{ bg: 'bg-emerald-600', text: 'text-white' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 shadow-inner">
                <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs text-gray-500">
                        {data.source_ai_node_id ? `Nó: ${data.source_ai_node_id.slice(0, 8)}...` : 'Selecionar nó IA...'}
                    </span>
                </div>
                {data.split_enabled !== false && (
                    <div className="text-[10px] text-emerald-400 mt-1.5">⌁⌁⌁ Split ativo ({data.delay_seconds || 2}s)</div>
                )}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-emerald-600 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

SendAiResponseNode.displayName = 'SendAiResponseNode';
