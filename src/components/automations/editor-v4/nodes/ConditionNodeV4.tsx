'use client';

import React, { memo } from 'react';
import { NodePropsV4 } from './types';
import { Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

export const ConditionNodeV4 = memo(({ data, selected }: NodePropsV4) => {
    const hasConfig = !!(data.condition_type);

    const CONDITION_LABELS: Record<string, string> = {
        has_tag:           'Tem a Tag',
        response_equals:   'Resposta igual a',
        response_contains: 'Resposta contém',
        response_in:       'Resposta está em',
        is_assigned:       'Está atribuído',
    };

    const footer = (
        // ─── Container único position:relative — handles absolutamente posicionados aqui
        <div style={{ position: 'relative' }}>
            {/* Labels visuais em grid */}
            <div className="grid grid-cols-2 divide-x divide-zinc-200/50">
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-green-500 uppercase">Sim</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-rose-500 uppercase">Não</span>
                </div>
            </div>
            {/* Handles — colIndex = posição da coluna, colTotal = 2 */}
            <NodeHandle type="source" position={Position.Bottom} id="yes" semantic colIndex={0} colTotal={2} />
            <NodeHandle type="source" position={Position.Bottom} id="no"  semantic colIndex={1} colTotal={2} />
        </div>
    );

    return (
        <BaseNode
            selected={selected}
            accentColor="amber"
            icon={GitBranch}
            category="Lógica"
            label={data.label || 'Condição (Se)'}
            onDelete={data.onDelete}
            onDuplicate={data.onDuplicate}
            onLabelChange={data.onLabelChange}
            footer={footer}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="amber" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
                {hasConfig ? (
                    <div className="space-y-1">
                        <span className="text-[10px] font-bold text-amber-600 uppercase">
                            {CONDITION_LABELS[data.condition_type] || data.condition_type}
                        </span>
                        {data.condition_value && (
                            <p className="text-[11px] font-mono bg-amber-50 px-2 py-1 rounded border border-amber-100 truncate text-amber-800">
                                {data.condition_value}
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-[12px] text-zinc-400 italic">Configurar condição...</p>
                )}
            </div>
        </BaseNode>
    );
});

ConditionNodeV4.displayName = 'ConditionNodeV4';
