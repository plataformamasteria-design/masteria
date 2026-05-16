'use client';

import React, { memo, useEffect } from 'react';
import { Position, useUpdateNodeInternals } from '@xyflow/react';
import { Signpost } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

export const RouterNodeV4 = memo(({ id, data, selected }: NodePropsV4) => {
    // Normaliza rotas: aceita string[] OU {id, label, condition}[]
    const rawRoutes: Array<string | { id?: string; label?: string }> = data.routes || [];
    const routes = rawRoutes.map((item, i) =>
        typeof item === 'string'
            ? { id: `route_${i}`, label: item || `Rota ${i + 1}` }
            : { id: item.id || `route_${i}`, label: item.label || `Rota ${i + 1}` }
    );
    const hasRoutes = routes.length > 0;
    // +1 para rota Padrão
    const colTotal = hasRoutes ? routes.length + 1 : 1;

    // Recalcula handles quando rotas mudam
    const updateNodeInternals = useUpdateNodeInternals();
    useEffect(() => {
        if (id) updateNodeInternals(id);
    }, [id, routes.length, updateNodeInternals]);

    const footer = hasRoutes ? (
        <div style={{ position: 'relative' }}>
            {/* Labels visuais */}
            <div className="grid divide-x divide-zinc-100"
                style={{ gridTemplateColumns: `repeat(${colTotal}, 1fr)` }}
            >
                {routes.map((route, i) => (
                    <div key={route.id || i} className="flex flex-col items-center gap-1 py-3">
                        <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wide truncate px-1 max-w-[60px]">
                            {route.label}
                        </span>
                    </div>
                ))}
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide">Padrão</span>
                </div>
            </div>
            {/* Handles absolutamente posicionados */}
            {routes.map((route, i) => (
                <NodeHandle
                    key={route.id || i}
                    type="source"
                    position={Position.Bottom}
                    id={route.id}
                    accentColor="indigo"
                    colIndex={i}
                    colTotal={colTotal}
                />
            ))}
            <NodeHandle
                type="source"
                position={Position.Bottom}
                id="default"
                accentColor="zinc"
                colIndex={colTotal - 1}
                colTotal={colTotal}
            />
        </div>
    ) : (
        <div style={{ position: 'relative' }}>
            <div className="flex justify-center py-3">
                <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide">Saída</span>
            </div>
            <NodeHandle type="source" position={Position.Bottom} accentColor="indigo" colIndex={0} colTotal={1} />
        </div>
    );

    return (
        <BaseNode
            selected={selected}
            accentColor="indigo"
            icon={Signpost}
            category="Lógica"
            label={data.label || 'Roteador'}
            onDelete={data.onDelete}
            onDuplicate={data.onDuplicate}
            onLabelChange={data.onLabelChange}
            footer={footer}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="indigo" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
                <p className="text-[11px] text-zinc-500">
                    {hasRoutes ? `${routes.length} rota(s) configurada(s)` : 'Nenhuma rota configurada'}
                </p>
            </div>
        </BaseNode>
    );
});

RouterNodeV4.displayName = 'RouterNodeV4';
