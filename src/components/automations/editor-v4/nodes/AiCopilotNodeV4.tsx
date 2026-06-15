'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { BrainCircuit } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const AiCopilotNodeV4 = memo(({ data, selected }: NodePropsV4<{ prompt?: string; output_variable?: string }>) => {
    return (
        <BaseNode selected={selected} accentColor="indigo" icon={BrainCircuit}
            category="INTELIGÊNCIA IA" label={data.label || 'Assistente Interno'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="indigo" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="indigo" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5 space-y-1.5">
                <p className="text-[11px] text-zinc-600 font-medium">Comando / Prompt:</p>
                <p className="text-[10px] text-zinc-500 bg-zinc-200/50 px-2 py-1 rounded line-clamp-3 leading-relaxed">
                    {data.prompt ? data.prompt : <span className="italic">Nenhum comando definido</span>}
                </p>
                {data.output_variable && (
                    <div className="pt-1 mt-1 border-t border-zinc-200/60 flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400 font-medium">Salvar resposta em:</span>
                        <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {data.output_variable}
                        </span>
                    </div>
                )}
            </div>
        </BaseNode>
    );
});
AiCopilotNodeV4.displayName = 'AiCopilotNodeV4';
