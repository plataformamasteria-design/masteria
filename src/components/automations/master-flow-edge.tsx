'use client';

import React from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    type EdgeProps,
    useReactFlow,
} from '@xyflow/react';
import { X } from 'lucide-react';

export default function MasterFlowEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    selected,
    sourceHandleId,
}: EdgeProps) {
    const { setEdges } = useReactFlow();

    // Determine stroke colors based on path logic
    let strokeColor = selected ? '#6366f1' : '#cbd5e1'; // default indigo or gray
    let glowColor = selected ? '#6366f1' : '#94a3b8';

    if (sourceHandleId === 'true' || sourceHandleId === 'yes') {
        strokeColor = selected ? '#10b981' : '#34d399'; // emerald
        glowColor = '#10b981';
    } else if (sourceHandleId === 'false' || sourceHandleId === 'no') {
        strokeColor = selected ? '#e11d48' : '#fb7185'; // rose
        glowColor = '#e11d48';
    }
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const onEdgeClick = (evt: React.MouseEvent) => {
        evt.stopPropagation();
        setEdges((edges) => edges.filter((edge) => edge.id !== id));
    };

    return (
        <>
            {/* Subtle glow */}
            <path
                d={edgePath}
                style={{
                    strokeWidth: 6,
                    stroke: glowColor,
                    opacity: 0.15,
                    fill: 'none',
                    filter: 'blur(4px)',
                }}
            />
            {/* Main line */}
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    strokeWidth: 2,
                    stroke: strokeColor,
                    strokeLinecap: 'round',
                    transition: 'all 0.3s ease-out',
                    ...style
                }}
            />
            {/* Delete button */}
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                    }}
                    className="nodrag nopan z-[100]"
                >
                    <button
                        onClick={onEdgeClick}
                        className={`w-6 h-6 bg-white border border-gray-200 rounded-full shadow-md text-gray-400 hover:text-red-500 hover:border-red-200 flex items-center justify-center transition-all ${selected ? 'scale-100 opacity-100' : 'scale-0 opacity-0'} active:scale-90`}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            </EdgeLabelRenderer>
        </>
    );
}
