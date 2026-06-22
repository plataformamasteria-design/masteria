'use client';

import React, { memo, useEffect } from 'react';
import { Position, useUpdateNodeInternals } from '@xyflow/react';
import { MessageCircle } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

export const WaitResponseNodeV4 = memo(({ id, data, selected }: NodePropsV4) => {
    const timeout = data.maxWaitTime ?? data.timeout_minutes ?? data.timeout_amount ?? 10;
    const unit = data.unit || 'minutes';
    const hasTimeout = !!(data.timeout_enabled || data.maxWaitTime);
    const colTotal = hasTimeout ? 2 : 1;

    // Notifica o ReactFlow para recalcular handles quando hasTimeout muda
    const updateNodeInternals = useUpdateNodeInternals();
    useEffect(() => {
        if (id) updateNodeInternals(id);
    }, [id, hasTimeout, updateNodeInternals]);

    const footer = (
        <div style={{ position: 'relative' }}>
            <div className="grid divide-x divide-teal-100/50"
                style={{ gridTemplateColumns: `repeat(${colTotal}, 1fr)` }}
            >
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-teal-500 uppercase">
                        {hasTimeout ? 'Respondeu' : 'Próximo'}
                    </span>
                </div>
                {hasTimeout && (
                    <div className="flex flex-col items-center gap-1 py-3">
                        <span className="text-[9px] font-semibold tracking-widest text-orange-500 uppercase">Timeout</span>
                    </div>
                )}
            </div>
            <NodeHandle type="source" position={Position.Bottom} id="responded" accentColor="teal" colIndex={0} colTotal={colTotal} />
            {hasTimeout && (
                <NodeHandle type="source" position={Position.Bottom} id="timeout" semantic colIndex={1} colTotal={colTotal} />
            )}
        </div>
    );

    return (
        <BaseNode
            selected={selected}
            accentColor="teal"
            icon={MessageCircle}
            category="Interação"
            label={data.label || 'Aguardar Resposta'}
            onDelete={data.onDelete}
            onDuplicate={data.onDuplicate}
            onLabelChange={data.onLabelChange}
            footer={footer}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="teal" />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/80 px-3 py-2.5">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Aguarda resposta por até <span className="font-semibold text-teal-600 dark:text-teal-400">{timeout} {unit}</span>
                </p>
            </div>
        </BaseNode>
    );
});

WaitResponseNodeV4.displayName = 'WaitResponseNodeV4';
