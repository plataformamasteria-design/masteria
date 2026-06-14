'use client';

import React, { memo, useEffect } from 'react';
import { Position, useUpdateNodeInternals } from '@xyflow/react';
import { Clock, Send } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const CampaignWaitResponseNodeV4 = memo(({ id, data, selected }: NodePropsV4) => {
    const timeout = data.maxWaitTime ?? data.timeout_minutes ?? data.timeout_amount ?? 24;
    const unit = data.unit || 'hours';
    const colTotal = 2; // Sempre tem timeout e respondeu

    const footer = (
        <div style={{ position: 'relative' }}>
            <div className="grid divide-x divide-emerald-100/50 dark:divide-emerald-900/50"
                style={{ gridTemplateColumns: `repeat(${colTotal}, 1fr)` }}
            >
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-emerald-500 uppercase">Respondeu</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-orange-500 uppercase">Timeout</span>
                </div>
            </div>
            <NodeHandle type="source" position={Position.Bottom} id="responded" accentColor="emerald" colIndex={0} colTotal={colTotal} />
            <NodeHandle type="source" position={Position.Bottom} id="timeout" semantic colIndex={1} colTotal={colTotal} />
        </div>
    );

    return (
        <BaseNode
            selected={selected}
            accentColor="emerald"
            icon={Send}
            category="Interação"
            label={data.label || 'Resposta da Campanha'}
            onDelete={data.onDelete}
            onDuplicate={data.onDuplicate}
            onLabelChange={data.onLabelChange}
            footer={footer}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="emerald" />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/80 px-3 py-2.5">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Pausa o fluxo até o lead responder à campanha. Tempo limite:{' '}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{timeout} {unit}</span>.
                </p>
            </div>
        </BaseNode>
    );
});

CampaignWaitResponseNodeV4.displayName = 'CampaignWaitResponseNodeV4';
