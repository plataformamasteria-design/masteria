'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { Send } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const SendAiResponseNodeV4 = memo(({ data, selected }: NodePropsV4) => (
    <BaseNode selected={selected} accentColor="violet" icon={Send}
        category="IA" label={data.label || 'Resposta IA'}
        onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
        footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="violet" /></div>}
    >
        <NodeHandle type="target" position={Position.Top} accentColor="violet" />
        <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
            <p className="text-[11px] text-zinc-500">Envia resposta gerada pela IA</p>
        </div>
    </BaseNode>
));
SendAiResponseNodeV4.displayName = 'SendAiResponseNodeV4';
