'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

const UNIT_LABELS: Record<string, string> = {
    seconds: 'segundo(s)', minutes: 'minuto(s)', hours: 'hora(s)', days: 'dia(s)',
};

export const DelayNodeV4 = memo(({ data, selected }: any) => {
    const amount = data.amount ?? 1;
    const unit = data.unit || 'minutes';
    const label = `${amount} ${UNIT_LABELS[unit] || unit}`;

    return (
        <BaseNode
            selected={selected}
            accentColor="amber"
            icon={Clock}
            category="Controle"
            label={data.label || 'Atraso'}
            onDelete={data.onDelete}
            onDuplicate={data.onDuplicate}
            onLabelChange={data.onLabelChange}
            footer={
                <div className="relative flex justify-center py-3">
                    <NodeHandle type="source" position={Position.Bottom} accentColor="amber" />
                </div>
            }
        >
            <NodeHandle type="target" position={Position.Top} accentColor="amber" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-[12px] font-semibold text-zinc-700">{label}</span>
            </div>
        </BaseNode>
    );
});

DelayNodeV4.displayName = 'DelayNodeV4';
