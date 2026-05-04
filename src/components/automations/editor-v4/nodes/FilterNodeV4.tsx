'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { Filter } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

export const FilterNodeV4 = memo(({ data, selected }: any) => {
    const conditions: any[] = data.conditions || [];

    const footer = (
        <div style={{ position: 'relative' }}>
            <div className="grid grid-cols-2 divide-x divide-zinc-200/50">
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-green-500 uppercase">Passou</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-rose-500 uppercase">Bloqueado</span>
                </div>
            </div>
            <NodeHandle type="source" position={Position.Bottom} id="pass" semantic colIndex={0} colTotal={2} />
            <NodeHandle type="source" position={Position.Bottom} id="fail" color="#f43f5e" colIndex={1} colTotal={2} />
        </div>
    );

    return (
        <BaseNode
            selected={selected}
            accentColor="violet"
            icon={Filter}
            category="Lógica"
            label={data.label || 'Filtro'}
            onDelete={data.onDelete}
            onDuplicate={data.onDuplicate}
            onLabelChange={data.onLabelChange}
            footer={footer}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="violet" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
                <p className="text-[11px] text-zinc-500">
                    {conditions.length > 0
                        ? `${conditions.length} condição(ões) de filtro`
                        : 'Sem condições configuradas'}
                </p>
            </div>
        </BaseNode>
    );
});

FilterNodeV4.displayName = 'FilterNodeV4';
