'use client';

import React, { memo, useEffect } from 'react';
import { Position, useUpdateNodeInternals, useNodeId } from '@xyflow/react';
import { Signpost } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { useFlowAnalyticsContext } from '../FlowAnalyticsContext';

export const RouterNodeV4 = memo(({ id, data, selected }: NodePropsV4) => {
    // Normaliza rotas lendo de data.rules (que é onde o NodeConfigPanel salva)
    const rawRoutes: Array<any> = data.rules || [];
    const routes = rawRoutes.map((item, i) => ({
        id: `route-${i}`,
        label: item.outputName || `Rota ${i + 1}`
    }));
    const hasRoutes = routes.length > 0;
    // +1 para rota Padrão
    const colTotal = hasRoutes ? routes.length + 1 : 1;

    // Recalcula handles quando rotas mudam
    const updateNodeInternals = useUpdateNodeInternals();
    useEffect(() => {
        if (id) updateNodeInternals(id);
    }, [id, routes.length, updateNodeInternals]);

    const nodeId = useNodeId();
    const { stats: allStats } = useFlowAnalyticsContext();
    const stats = allStats?.find((s) => s.nodeId === nodeId);

    const getPercentage = (handleId: string) => {
        if (!stats || !stats.totalReached) return null;
        const count = stats.responses?.[handleId] || 0;
        if (count === 0) return '0%';
        return Math.round((count / stats.totalReached) * 100) + '%';
    };

    const footer = hasRoutes ? (
        <div style={{ position: 'relative' }}>
            {/* Labels visuais */}
            <div className="grid divide-x divide-zinc-100"
                style={{ gridTemplateColumns: `repeat(${colTotal}, 1fr)` }}
            >
                {routes.map((route, i) => (
                    <div key={route.id || i} className="flex flex-col items-center gap-1 py-3">
                        <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide truncate px-1 max-w-[60px]">
                            {route.label}
                        </span>
                        {getPercentage(route.id) && (
                            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                                {getPercentage(route.id)}
                            </span>
                        )}
                    </div>
                ))}
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-400 uppercase tracking-wide">Padrão</span>
                    {getPercentage('fallback') && (
                        <span className="text-[10px] font-bold text-zinc-400">
                            {getPercentage('fallback')}
                        </span>
                    )}
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
                id="fallback"
                accentColor="zinc"
                colIndex={colTotal - 1}
                colTotal={colTotal}
            />
        </div>
    ) : (
        <div style={{ position: 'relative' }}>
            <div className="flex justify-center py-3">
                <span className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-400 uppercase tracking-wide">Saída</span>
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
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/80 px-3 py-2.5">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {hasRoutes ? `${routes.length} rota(s) configurada(s)` : 'Nenhuma rota configurada'}
                </p>
            </div>
        </BaseNode>
    );
});

RouterNodeV4.displayName = 'RouterNodeV4';
