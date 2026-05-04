'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { type NodeColorKey, NODE_COLORS } from './BaseNode';

// ─── Cores semânticas de handles de saída ────────────────────────────────────
export const SEMANTIC_HANDLE_COLORS: Record<string, string> = {
    yes:       '#22c55e',
    true:      '#22c55e',
    completed: '#22c55e',
    responded: '#14b8a6',
    pass:      '#22c55e',
    found:     '#3b82f6',
    no:        '#f43f5e',
    false:     '#f43f5e',
    fail:      '#f43f5e',
    timeout:   '#f97316',
    not_found: '#a855f7',
    fallback:  '#94a3b8',
    default:   '#94a3b8',
    error:     '#ef4444',
};

// ─── Props ───────────────────────────────────────────────────────────────────
interface NodeHandleProps {
    type: 'source' | 'target';
    position: Position;
    id?: string;
    /** Cor de acento do nó (para handles simples) */
    accentColor?: NodeColorKey;
    /** Cor CSS direta (sobrescreve accentColor) */
    color?: string;
    /** Se true, usa a cor semântica baseada no `id` */
    semantic?: boolean;
    /**
     * Modo BRANCH — posiciona o handle dentro do container pai (position:relative).
     * Usar: colIndex = índice desta coluna (0-based), colTotal = total de colunas.
     * O handle é posicionado em left: ((colIndex + 0.5) / colTotal * 100)% do pai.
     * O PAI deve ser um <div style={{ position: 'relative' }}> que engloba TODOS os handles do footer.
     */
    colIndex?: number;
    colTotal?: number;
}

export function NodeHandle({
    type,
    position,
    id,
    accentColor = 'zinc',
    color,
    semantic = false,
    colIndex,
    colTotal,
}: NodeHandleProps) {
    // ── Resolve cor final ─────────────────────────────────────────────────────
    let finalColor = color;
    if (!finalColor && semantic && id) {
        finalColor = SEMANTIC_HANDLE_COLORS[id] ?? NODE_COLORS[accentColor]?.handle;
    }
    if (!finalColor && id) {
        finalColor = SEMANTIC_HANDLE_COLORS[id] ?? NODE_COLORS[accentColor]?.handle ?? '#94a3b8';
    }
    if (!finalColor) {
        finalColor = NODE_COLORS[accentColor]?.handle ?? '#94a3b8';
    }

    const isBottom = position === Position.Bottom;
    const isTop    = position === Position.Top;

    // ── Modo BRANCH ───────────────────────────────────────────────────────────
    // Handles posicionados dentro de um <div style={{position:'relative'}}> que
    // engloba todo o footer. O `left` é calculado pela posição da coluna.
    // ReactFlow detecta o connection point pelo getBoundingClientRect() do Handle.
    if (colIndex !== undefined && colTotal !== undefined) {
        // Centro da coluna em % relativo ao pai
        const leftPct = `${(((colIndex + 0.5) / colTotal) * 100).toFixed(3)}%`;

        const handleStyle: React.CSSProperties = {
            position: 'absolute',
            left: leftPct,
            transform: 'translateX(-50%)',
            [isBottom ? 'bottom' : 'top']: -6,
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: finalColor,
            border: '2.5px solid white',
            boxShadow: `0 0 0 2px ${finalColor}50`,
            zIndex: 50,
            cursor: type === 'source' ? 'crosshair' : 'default',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        };

        return (
            <Handle
                type={type}
                position={position}
                id={id}
                style={handleStyle}
                className="hover:scale-125"
            />
        );
    }

    // ── Modo SIMPLES: handle único centralizado no nó ─────────────────────────
    const simpleStyle: React.CSSProperties = {
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        [isTop    ? 'top'    : 'bottom']: -6,
        width: 12,
        height: 12,
        borderRadius: '50%',
        backgroundColor: finalColor,
        border: '2.5px solid white',
        boxShadow: `0 0 0 2px ${finalColor}50`,
        cursor: type === 'source' ? 'crosshair' : 'default',
        zIndex: 50,
        transition: 'transform 0.15s ease',
    };

    return (
        <Handle
            type={type}
            position={position}
            id={id}
            style={simpleStyle}
            className="hover:scale-125"
        />
    );
}
