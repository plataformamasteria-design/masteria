'use client';

import React, { memo, useState, useRef, useEffect, type ReactNode, type ElementType } from 'react';
import { Trash2, Copy, Pencil, Check } from 'lucide-react';
import { useNodeId } from '@xyflow/react';
import { useFlowAnalyticsContext } from '../../FlowAnalyticsContext';

// ─── Paleta de cores por categoria ──────────────────────────────────────────
export const NODE_COLORS: Record<string, { bg: string; text: string; ring: string; dot: string; border: string; handle: string }> = {
    amber:   { bg: 'bg-amber-50 dark:bg-amber-900/30',   text: 'text-amber-600 dark:text-amber-400',   ring: 'ring-amber-400',   dot: 'bg-amber-400',   border: 'border-amber-200 dark:border-amber-800', handle: '#f59e0b' },
    blue:    { bg: 'bg-blue-50 dark:bg-blue-900/30',    text: 'text-blue-600 dark:text-blue-400',    ring: 'ring-blue-400',    dot: 'bg-blue-400',    border: 'border-blue-200 dark:border-blue-800',  handle: '#3b82f6' },
    green:   { bg: 'bg-green-50 dark:bg-green-900/30',   text: 'text-green-600 dark:text-green-400',   ring: 'ring-green-400',   dot: 'bg-green-400',   border: 'border-green-200 dark:border-green-800', handle: '#22c55e' },
    violet:  { bg: 'bg-violet-50 dark:bg-violet-900/30',  text: 'text-violet-600 dark:text-violet-400',  ring: 'ring-violet-400',  dot: 'bg-violet-400',  border: 'border-violet-200 dark:border-violet-800',handle: '#8b5cf6' },
    rose:    { bg: 'bg-rose-50 dark:bg-rose-900/30',    text: 'text-rose-600 dark:text-rose-400',    ring: 'ring-rose-400',    dot: 'bg-rose-400',    border: 'border-rose-200 dark:border-rose-800',  handle: '#f43f5e' },
    cyan:    { bg: 'bg-cyan-50 dark:bg-cyan-900/30',    text: 'text-cyan-600 dark:text-cyan-400',    ring: 'ring-cyan-400',    dot: 'bg-cyan-400',    border: 'border-cyan-200 dark:border-cyan-800',  handle: '#06b6d4' },
    orange:  { bg: 'bg-orange-50 dark:bg-orange-900/30',  text: 'text-orange-600 dark:text-orange-400',  ring: 'ring-orange-400',  dot: 'bg-orange-400',  border: 'border-orange-200 dark:border-orange-800',handle: '#f97316' },
    fuchsia: { bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/30', text: 'text-fuchsia-600 dark:text-fuchsia-400', ring: 'ring-fuchsia-400', dot: 'bg-fuchsia-400', border: 'border-fuchsia-200 dark:border-fuchsia-800',handle: '#d946ef' },
    indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-900/30',  text: 'text-indigo-600 dark:text-indigo-400',  ring: 'ring-indigo-400',  dot: 'bg-indigo-400',  border: 'border-indigo-200 dark:border-indigo-800',handle: '#6366f1' },
    zinc:    { bg: 'bg-zinc-100 dark:bg-zinc-800/80',   text: 'text-zinc-600 dark:text-zinc-300',    ring: 'ring-zinc-400',    dot: 'bg-zinc-400',    border: 'border-zinc-200 dark:border-zinc-800',  handle: '#71717a' },
    teal:    { bg: 'bg-teal-50 dark:bg-teal-900/30',    text: 'text-teal-600 dark:text-teal-400',    ring: 'ring-teal-400',    dot: 'bg-teal-400',    border: 'border-teal-200 dark:border-teal-800',  handle: '#14b8a6' },
};

export type NodeColorKey = keyof typeof NODE_COLORS;

// ─── Props ───────────────────────────────────────────────────────────────────
export interface BaseNodeProps {
    selected?: boolean;
    accentColor: NodeColorKey;
    icon: ElementType;
    category: string;
    label: string;
    /** Sobreescreve a largura padrão (padrão: 280) */
    width?: number;
    /** @deprecated use width instead */
    minWidth?: number;
    onDelete?: () => void;
    onDuplicate?: () => void;
    onLabelChange?: (label: string) => void;
    headerExtra?: ReactNode;
    footer?: ReactNode;
    children?: ReactNode;
    stats?: { totalReached: number; totalResponded: number };
}

// ─── Componente ──────────────────────────────────────────────────────────────
export const BaseNode = memo(({
    selected,
    accentColor,
    icon: Icon,
    category,
    label,
    width = 280,
    minWidth,
    onDelete,
    onDuplicate,
    onLabelChange,
    headerExtra,
    footer,
    children,
    stats: explicitStats,
}: BaseNodeProps) => {
    const colors = NODE_COLORS[accentColor] ?? NODE_COLORS['zinc']!;
    // Largura final: prop width tem prioridade; minWidth mantido por compatibilidade
    const nodeWidth = minWidth ?? width;
    
    const nodeId = useNodeId();
    const { stats: allStats } = useFlowAnalyticsContext();
    const stats = explicitStats || allStats?.find((s) => s.nodeId === nodeId) || { totalReached: 0, totalResponded: 0 };

    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(label);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditValue(label);
    }, [label]);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const saveLabel = () => {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== label) onLabelChange?.(trimmed);
        setEditing(false);
    };

    return (
        <div
            className={[
                'relative flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border transition-all duration-200',
                selected ? 'border-zinc-200/60 dark:border-zinc-700' : 'border-zinc-200/80 dark:border-zinc-800',
                'group/node',
            ].join(' ')}
            style={{
                width: nodeWidth,
                minWidth: nodeWidth,
                maxWidth: nodeWidth,
                borderTop: `3px solid ${colors?.handle ?? '#71717a'}`,
                borderTopLeftRadius: '1rem',
                borderTopRightRadius: '1rem',
                boxShadow: selected
                    ? `0 0 0 2px ${colors?.handle ?? '#71717a'}40, 0 0 16px ${colors?.handle ?? '#71717a'}20, 0 4px 20px rgba(0,0,0,0.08)`
                    : '0 2px 8px rgba(0,0,0,0.06)',
            }}
        >


            {/* ─── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-3">
                {/* Ícone */}
                <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${colors.bg} ${colors.text} shrink-0`}>
                    <Icon className="w-4 h-4" />
                </div>

                {/* Categoria + Label */}
                <div className="flex-1 min-w-0">
                    <span className={`block text-[9px] font-semibold tracking-widest uppercase ${colors.text} opacity-80`}>
                        {category}
                    </span>
                    {editing ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                                ref={inputRef}
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={saveLabel}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') saveLabel();
                                    if (e.key === 'Escape') setEditing(false);
                                }}
                                className="flex-1 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-zinc-300 dark:border-zinc-700 outline-none py-0.5 nodrag nowheel"
                            />
                            <button
                                onClick={e => { e.stopPropagation(); saveLabel(); }}
                                className="p-0.5 text-green-500 hover:text-green-600 dark:text-green-400"
                            >
                                <Check className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <span
                            className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight cursor-default"
                            onDoubleClick={() => onLabelChange && setEditing(true)}
                            title={onLabelChange ? 'Duplo clique para renomear' : undefined}
                        >
                            {label}
                        </span>
                    )}
                </div>

                {/* Header extra e stats */}
                <div className="flex items-center gap-2 shrink-0">
                    {stats && stats.totalReached !== undefined && (
                        <div className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700" title="Pessoas que passaram por este nó">
                            <span className="opacity-80">👁</span> {stats.totalReached}
                        </div>
                    )}
                    {headerExtra && (
                        <div>{headerExtra}</div>
                    )}
                </div>
            </div>

            {/* ─── Corpo ───────────────────────────────────────────────────── */}
            {children && (
                <div className="px-4 pb-3 overflow-hidden">
                    {children}
                </div>
            )}

            {/* ─── Footer (handles de saída) ────────────────────────────────── */}
            {footer && (
                <div className={`border-t ${colors.border} dark:border-zinc-800 border-opacity-50 bg-zinc-50/60 dark:bg-zinc-900/60 rounded-b-2xl overflow-visible`}>
                    {footer}
                </div>
            )}

            {/* ─── Ações flutuantes (hover) ────────────────────────────────── */}
            <div className={[
                'absolute -top-3 -right-3 flex items-center gap-1',
                'opacity-0 group-hover/node:opacity-100 transition-opacity duration-150',
                selected ? 'opacity-100' : '',
            ].join(' ')}>
                {onLabelChange && !editing && (
                    <button
                        onClick={e => { e.stopPropagation(); setEditing(true); }}
                        className="w-6 h-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-sm flex items-center justify-center text-zinc-400 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all"
                        title="Renomear"
                    >
                        <Pencil className="w-2.5 h-2.5" />
                    </button>
                )}
                {onDuplicate && (
                    <button
                        onClick={e => { e.stopPropagation(); onDuplicate(); }}
                        className="w-6 h-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-sm flex items-center justify-center text-zinc-400 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all"
                        title="Duplicar"
                    >
                        <Copy className="w-2.5 h-2.5" />
                    </button>
                )}
                {onDelete && (
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(); }}
                        className="w-6 h-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-sm flex items-center justify-center text-zinc-400 dark:text-zinc-400 hover:text-rose-500 hover:border-rose-300 dark:hover:border-rose-900 transition-all"
                        title="Excluir"
                    >
                        <Trash2 className="w-2.5 h-2.5" />
                    </button>
                )}
            </div>
        </div>
    );
});

BaseNode.displayName = 'BaseNode';
