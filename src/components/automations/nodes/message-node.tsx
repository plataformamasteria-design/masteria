'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import { NodeHeader } from './NodeHeader';
import { NodeStatsBar } from './NodeStatsBar';

export const SendMessageNode = memo(({ data, selected }: any) => {
    return (
        <div
            className={`px-5 py-4 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.1)] rounded-[1.5rem] bg-white/95 backdrop-blur-xl border ${selected ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-zinc-200/80'} min-w-[280px] max-w-[320px] animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-blue-500 !border-[3px] !border-zinc-100 shadow-sm z-50 transition-transform hover:scale-125 !-top-2"
            />

            <NodeHeader
                icon={MessageSquare}
                category="Mensagens"
                label={data.label || 'Enviar Mensagem'}
                selected={selected}
                color={{ bg: 'bg-blue-500/10', text: 'text-blue-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="text-sm leading-relaxed text-gray-700 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                <p className="line-clamp-3 group-hover/node:line-clamp-none transition-all whitespace-pre-wrap">
                    {data.message || data.content || 'Digite a mensagem...'}
                </p>
            </div>

            {(data.stats?.reached > 0 || data.stats?.responded > 0) && (
                <NodeStatsBar
                    reached={data.stats?.reached || 0}
                    responded={data.stats?.responded || 0}
                />
            )}

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-blue-500 !border-[3px] !border-zinc-100 shadow-sm z-50 transition-transform hover:scale-125 !-bottom-2"
            />
        </div>
    );
});

SendMessageNode.displayName = 'SendMessageNode';

// Backward compatibility
export const MessageNode = SendMessageNode;
