'use client';

import React, { memo, useEffect } from 'react';
import { Position, useUpdateNodeInternals } from '@xyflow/react';
import { Brain, Sparkles } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

const PROVIDER_LABELS: Record<string, string> = {
    gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Claude',
};

export const AiAgentNodeV4 = memo(({ id, data, selected }: NodePropsV4) => {
    const provider = data.provider || 'gemini';
    const model = data.model || 'gemini-2.0-flash';
    // Suporte a ambas as chaves: response_timeout_enabled (NodeConfigPanel) e timeout_enabled (legado)
    const hasTimeout = !!(data.response_timeout_enabled || data.timeout_enabled);
    const colTotal = hasTimeout ? 2 : 1;

    // ── CRÍTICO: Notifica o ReactFlow para recalcular handles quando hasTimeout muda
    const updateNodeInternals = useUpdateNodeInternals();
    useEffect(() => {
        if (id) updateNodeInternals(id);
    }, [id, hasTimeout, updateNodeInternals]);

    const headerExtra = (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-50 border border-violet-100">
            <Sparkles className="w-2.5 h-2.5 text-violet-500" />
            <span className="text-[9px] font-bold text-violet-600">{PROVIDER_LABELS[provider] || provider}</span>
        </span>
    );

    const footer = (
        // Container único position:relative — todos os handles ficam posicionados aqui
        <div style={{ position: 'relative' }}>
            {/* Labels visuais em grid */}
            <div
                className="grid divide-x divide-violet-100/50"
                style={{ gridTemplateColumns: `repeat(${colTotal}, 1fr)` }}
            >
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-green-500 uppercase">Concluído</span>
                </div>
                {hasTimeout && (
                    <div className="flex flex-col items-center gap-1 py-3">
                        <span className="text-[9px] font-semibold tracking-widest text-orange-500 uppercase">Timeout</span>
                    </div>
                )}
            </div>

            {/*
              Handles absolutamente posicionados no container pai (position:relative acima).
              colIndex e colTotal calculam left = ((colIndex + 0.5) / colTotal * 100)%
              garantindo que cada handle fique NO CENTRO da sua coluna visual.
              O ReactFlow detecta a posição real via getBoundingClientRect() do Handle.
            */}
            <NodeHandle
                type="source"
                position={Position.Bottom}
                id="completed"
                semantic
                colIndex={0}
                colTotal={colTotal}
            />
            {hasTimeout && (
                <NodeHandle
                    type="source"
                    position={Position.Bottom}
                    id="timeout"
                    semantic
                    colIndex={1}
                    colTotal={colTotal}
                />
            )}
        </div>
    );

    return (
        <BaseNode
            selected={selected}
            accentColor="violet"
            icon={Brain}
            category="Inteligência IA"
            label={data.label || 'Agente IA'}
            onDelete={data.onDelete}
            onDuplicate={data.onDuplicate}
            onLabelChange={data.onLabelChange}
            headerExtra={headerExtra}
            footer={footer}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="violet" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-violet-600 font-semibold">{PROVIDER_LABELS[provider] || provider}</span>
                    <span className="text-[10px] font-mono bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded text-violet-500">
                        {model}
                    </span>
                </div>
                {data.system_message && (
                    <p className="text-[11px] text-zinc-500 italic line-clamp-1">{data.system_message}</p>
                )}
                {data.dialogue_mode && (
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[10px] text-green-600 font-semibold">Modo Diálogo Ativo</span>
                    </div>
                )}
                {hasTimeout && (
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                        <span className="text-[10px] text-orange-600 font-semibold">
                            Timeout: {data.response_timeout_minutes || data.timeout_amount || 5} min
                        </span>
                    </div>
                )}
            </div>
        </BaseNode>
    );
});

AiAgentNodeV4.displayName = 'AiAgentNodeV4';
