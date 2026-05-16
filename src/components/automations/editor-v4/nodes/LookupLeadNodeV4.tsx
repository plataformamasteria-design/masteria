'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { UserSearch } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const LookupLeadNodeV4 = memo(({ data, selected }: NodePropsV4<{ phone_variable?: string }>) => {
    const footer = (
        <div style={{ position: 'relative' }}>
            <div className="grid grid-cols-2 divide-x divide-zinc-200/50">
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-blue-500 uppercase">Encontrado</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-violet-500 uppercase">Não Encontrado</span>
                </div>
            </div>
            <NodeHandle type="source" position={Position.Bottom} id="found"     semantic colIndex={0} colTotal={2} />
            <NodeHandle type="source" position={Position.Bottom} id="not_found" semantic colIndex={1} colTotal={2} />
        </div>
    );
    return (
        <BaseNode selected={selected} accentColor="cyan" icon={UserSearch}
            category="CRM" label={data.label || 'Buscar Lead'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={footer}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="cyan" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
                <p className="text-[11px] text-zinc-500">
                    {data.phone_variable ? `📱 {{${data.phone_variable}}}` : 'Busca por número de telefone'}
                </p>
            </div>
        </BaseNode>
    );
});
LookupLeadNodeV4.displayName = 'LookupLeadNodeV4';
