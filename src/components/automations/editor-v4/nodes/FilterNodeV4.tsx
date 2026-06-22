'use client';

import React, { memo } from 'react';
import { NodePropsV4 } from './types';
import { Position, useNodeId } from '@xyflow/react';
import { Filter } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { useFlowAnalyticsContext } from '../FlowAnalyticsContext';

export const FilterNodeV4 = memo(({ data, selected }: NodePropsV4) => {
    const conditions: Record<string, unknown>[] = (data.conditions as Record<string, unknown>[]) || [];

    const nodeId = useNodeId();
    const { stats: allStats } = useFlowAnalyticsContext();
    const stats = allStats?.find((s) => s.nodeId === nodeId);

    const getPercentage = (handleId: string) => {
        if (!stats || !stats.totalReached) return null;
        const count = stats.responses?.[handleId] || 0;
        if (count === 0) return '0%';
        return Math.round((count / stats.totalReached) * 100) + '%';
    };

    const footer = (
        <div style={{ position: 'relative' }}>
            <div className="grid grid-cols-2 divide-x divide-zinc-200/50">
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-green-500 uppercase">Passou</span>
                    {getPercentage('pass') && (
                        <span className="text-[10px] font-bold text-green-500/80">
                            {getPercentage('pass')}
                        </span>
                    )}
                </div>
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-rose-500 uppercase">Bloqueado</span>
                    {getPercentage('block') && (
                        <span className="text-[10px] font-bold text-rose-500/80">
                            {getPercentage('block')}
                        </span>
                    )}
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
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/80 px-3 py-2.5">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {conditions.length > 0
                        ? `${conditions.length} condição(ões) de filtro`
                        : 'Sem condições configuradas'}
                </p>
            </div>
        </BaseNode>
    );
});

FilterNodeV4.displayName = 'FilterNodeV4';
