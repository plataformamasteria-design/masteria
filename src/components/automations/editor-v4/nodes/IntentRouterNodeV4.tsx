'use client';

import React, { memo, useEffect } from 'react';
import { Position, useUpdateNodeInternals } from '@xyflow/react';
import { Target } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

export const IntentRouterNodeV4 = memo(({ id, data, selected }: any) => {
    // ── Normaliza intents: aceita string[] OU {id,label}[] ──────────────────
    // NodeConfigPanel salva intents como string[]; legado usa {id,label,examples}[]
    const rawIntents: Array<string | { id?: string; label?: string }> = data.intents || [];
    const intents = rawIntents.map((item, i) =>
        typeof item === 'string'
            ? { id: `intent_${i}`, label: item || `Intenção ${i + 1}` }
            : { id: item.id || `intent_${i}`, label: item.label || `Intenção ${i + 1}` }
    );

    // +1 para "Outros/fallback"
    const colTotal = intents.length + 1;
    const dynamicWidth = Math.max(280, colTotal * 75);

    // ── CRÍTICO: Recalcula handles quando intents mudam ─────────────────────
    const updateNodeInternals = useUpdateNodeInternals();
    useEffect(() => {
        if (id) updateNodeInternals(id);
    }, [id, intents.length, updateNodeInternals]);

    const footer = (
        <div style={{ position: 'relative' }}>
            {/* Labels visuais em grid */}
            <div
                className="grid divide-x divide-zinc-100"
                style={{ gridTemplateColumns: `repeat(${colTotal}, 1fr)` }}
            >
                {intents.map((intent, i) => (
                    <div key={intent.id || i} className="flex flex-col items-center gap-1 py-3">
                        <span className="text-[9px] font-semibold text-violet-500 uppercase tracking-wide truncate px-1 max-w-[64px]">
                            {intent.label}
                        </span>
                    </div>
                ))}
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide">Outros</span>
                </div>
            </div>

            {/*
              Handles absolutamente posicionados no container pai.
              colIndex e colTotal garantem left = centro exato de cada coluna.
              ReactFlow detecta posição real via getBoundingClientRect().
            */}
            {intents.map((intent, i) => (
                <NodeHandle
                    key={intent.id || i}
                    type="source"
                    position={Position.Bottom}
                    id={intent.id}
                    accentColor="violet"
                    colIndex={i}
                    colTotal={colTotal}
                />
            ))}
            <NodeHandle
                type="source"
                position={Position.Bottom}
                id="fallback"
                accentColor="zinc"
                colIndex={colTotal - 1}
                colTotal={colTotal}
            />
        </div>
    );

    return (
        <BaseNode
            selected={selected}
            width={dynamicWidth}
            accentColor="violet"
            icon={Target}
            category="IA"
            label={data.label || 'Classificador de Intenção'}
            onDelete={data.onDelete}
            onDuplicate={data.onDuplicate}
            onLabelChange={data.onLabelChange}
            footer={footer}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="violet" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
                <p className="text-[11px] text-zinc-500">
                    {intents.length > 0
                        ? `${intents.length} intenção(ões) configurada(s)`
                        : 'Nenhuma intenção configurada'}
                </p>
            </div>
        </BaseNode>
    );
});

IntentRouterNodeV4.displayName = 'IntentRouterNodeV4';
