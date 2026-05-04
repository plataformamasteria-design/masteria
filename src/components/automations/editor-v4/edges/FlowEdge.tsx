'use client';

import React from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    getSmoothStepPath,
    type EdgeProps,
    useReactFlow,
} from '@xyflow/react';
import { X } from 'lucide-react';

// Cores semânticas por handle ID
const EDGE_COLORS: Record<string, { stroke: string; label: string }> = {
    yes:       { stroke: '#22c55e', label: 'Sim' },
    true:      { stroke: '#22c55e', label: 'Sim' },
    completed: { stroke: '#22c55e', label: 'Concluído' },
    found:     { stroke: '#3b82f6', label: 'Encontrado' },
    no:        { stroke: '#f43f5e', label: 'Não' },
    false:     { stroke: '#f43f5e', label: 'Não' },
    timeout:   { stroke: '#f97316', label: 'Timeout' },
    not_found: { stroke: '#a855f7', label: 'Não Encontrado' },
    error:     { stroke: '#ef4444', label: 'Erro' },
};

const DEFAULT_EDGE = { stroke: '#cbd5e1', label: '' };

export default function FlowEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    sourceHandleId,
    selected,
    markerEnd,
}: EdgeProps) {
    const { setEdges } = useReactFlow();
    const config = (sourceHandleId && EDGE_COLORS[sourceHandleId]) ? EDGE_COLORS[sourceHandleId] : DEFAULT_EDGE;

    const strokeColor = config.stroke;
    const labelText = config.label;

    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 12,
        offset: 24,
    });

    const onDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEdges(edges => edges.filter(edge => edge.id !== id));
    };

    return (
        <>
            {/* Linha principal */}
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    stroke: strokeColor,
                    strokeWidth: selected ? 2 : 1.5,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                    opacity: selected ? 1 : 0.75,
                    transition: 'stroke-width 0.15s, opacity 0.15s',
                }}
            />

            <EdgeLabelRenderer>
                {/* Label de branch (ex: "Sim", "Não") — próxima à source */}
                {labelText && (
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${sourceX + (targetX - sourceX) * 0.15}px,${sourceY + (targetY - sourceY) * 0.15}px)`,
                            pointerEvents: 'none',
                        }}
                        className="nodrag nopan"
                    >
                        <span
                            className="px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wide"
                            style={{
                                backgroundColor: `${strokeColor}18`,
                                color: strokeColor,
                                border: `1px solid ${strokeColor}40`,
                            }}
                        >
                            {labelText}
                        </span>
                    </div>
                )}

                {/* Botão de delete (centro da aresta, visível ao selecionar) */}
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                    }}
                    className="nodrag nopan"
                >
                    <button
                        onClick={onDelete}
                        className={[
                            'w-5 h-5 bg-white border border-zinc-200 rounded-full shadow-sm',
                            'flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:border-rose-200',
                            'transition-all',
                            selected ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
                        ].join(' ')}
                        title="Remover conexão"
                    >
                        <X className="w-2.5 h-2.5" />
                    </button>
                </div>
            </EdgeLabelRenderer>
        </>
    );
}
