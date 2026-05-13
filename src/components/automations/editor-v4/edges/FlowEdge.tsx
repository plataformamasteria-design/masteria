'use client';

import React from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    getSmoothStepPath,
    type EdgeProps,
    useReactFlow,
    useStore,
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
    source,
    target,
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
    
    // Check selection state
    const isSourceSelected = useStore((s) => s.nodeLookup.get(source)?.selected);
    const isTargetSelected = useStore((s) => s.nodeLookup.get(target)?.selected);

    const config = (sourceHandleId && EDGE_COLORS[sourceHandleId]) ? EDGE_COLORS[sourceHandleId] : DEFAULT_EDGE;

    let strokeColor = config.stroke;
    if (isSourceSelected) strokeColor = '#3b82f6'; // Azul saindo do selecionado
    else if (isTargetSelected) strokeColor = '#a855f7'; // Roxo chegando no selecionado

    const labelText = config.label;

    // Calculando um offset determinístico baseado no ID para evitar sobreposição total de linhas
    const hash = id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
    const dynamicOffset = 24 + (Math.abs(hash) % 5) * 15;

    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 12,
        offset: dynamicOffset,
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
                    strokeWidth: isSourceSelected || isTargetSelected ? 2.5 : (selected ? 2 : 1.5),
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                    opacity: isSourceSelected || isTargetSelected ? 1 : (selected ? 1 : 0.75),
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
