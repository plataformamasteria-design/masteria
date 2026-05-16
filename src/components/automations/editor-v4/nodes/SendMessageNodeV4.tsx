'use client';

import React, { memo } from 'react';
import { NodePropsV4 } from './types';
import { Position } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

export const SendMessageNodeV4 = memo(({ data, selected }: NodePropsV4) => {
    const message = data.message || data.content || '';
    const preview = message.length > 80 ? message.slice(0, 80) + '...' : message;

    return (
        <BaseNode
            selected={selected}
            accentColor="green"
            icon={MessageSquare}
            category="Mensagens"
            label={data.label || 'Enviar Mensagem'}
            onDelete={data.onDelete}
            onDuplicate={data.onDuplicate}
            onLabelChange={data.onLabelChange}
            footer={
                <div className="relative flex justify-center py-3">
                    <NodeHandle type="source" position={Position.Bottom} accentColor="green" />
                </div>
            }
        >
            <NodeHandle type="target" position={Position.Top} accentColor="green" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
                {preview ? (
                    <p className="text-[12px] text-zinc-700 whitespace-pre-wrap leading-relaxed">{preview}</p>
                ) : (
                    <p className="text-[12px] text-zinc-400 italic">Clique para configurar a mensagem...</p>
                )}
            </div>
        </BaseNode>
    );
});

SendMessageNodeV4.displayName = 'SendMessageNodeV4';
