'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { MessageSquareShare } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

export const SendTemplateNodeV4 = memo(({ data, selected }: any) => {
    return (
        <BaseNode
            selected={selected}
            accentColor="green"
            icon={MessageSquareShare}
            category="WhatsApp"
            label={data.label || 'Enviar Template'}
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
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5 space-y-1">
                {data.template_name ? (
                    <>
                        <p className="text-[12px] font-semibold text-zinc-800">{data.template_name}</p>
                        <p className="text-[10px] text-zinc-400">{data.template_language || 'pt_BR'}</p>
                    </>
                ) : (
                    <p className="text-[12px] text-zinc-400 italic">Selecionar template aprovado...</p>
                )}
            </div>
        </BaseNode>
    );
});

SendTemplateNodeV4.displayName = 'SendTemplateNodeV4';
