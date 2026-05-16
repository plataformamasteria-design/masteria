'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { MessageSquareHeart } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const FollowUpAiNodeV4 = memo(({ data, selected }: NodePropsV4) => {
    const footer = (
        <div style={{ position: 'relative' }}>
            <div className="grid grid-cols-2 divide-x divide-orange-100/50">
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-green-500 uppercase">Respondeu</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-rose-500 uppercase">Não Resp.</span>
                </div>
            </div>
            <NodeHandle type="source" position={Position.Bottom} id="responded"     color="#22c55e" colIndex={0} colTotal={2} />
            <NodeHandle type="source" position={Position.Bottom} id="not_responded" color="#f43f5e" colIndex={1} colTotal={2} />
        </div>
    );

    return (
        <BaseNode selected={selected} accentColor="orange" icon={MessageSquareHeart}
            category="IA" label={data.label || 'Follow-Up IA'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={footer}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="orange" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
                <p className="text-[11px] text-zinc-500">Reengajamento automático com IA</p>
            </div>
        </BaseNode>
    );
});
FollowUpAiNodeV4.displayName = 'FollowUpAiNodeV4';
