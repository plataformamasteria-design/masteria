'use client';

import React, { memo, useState, useMemo } from 'react';
import { Braces, ChevronDown, Copy, Check, Search } from 'lucide-react';
import type { NodeTestOutput } from '@/hooks/useNodeTestOutputs';

interface OutputFieldMapperProps {
    /** All collected outputs from tested nodes */
    outputs: Record<string, NodeTestOutput>;
    /** Called when user selects a field reference to insert */
    onSelectField: (reference: string) => void;
    /** If true, the mapper is visible */
    isOpen: boolean;
    onClose: () => void;
}

export const OutputFieldMapper = memo(({
    outputs,
    onSelectField,
    isOpen,
    onClose,
}: OutputFieldMapperProps) => {
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // Group fields by node
    const nodeFields = useMemo(() => {
        const result: Array<{
            nodeId: string;
            nodeLabel: string;
            nodeType: string;
            fields: Array<{ path: string; reference: string; type: string; preview: string }>;
        }> = [];

        Object.values(outputs).forEach(out => {
            if (out.status !== 'ok' || !out.output) return;

            const fields = extractFieldsFlat(out.output, out.nodeLabel);
            if (fields.length > 0) {
                result.push({
                    nodeId: out.nodeId,
                    nodeLabel: out.nodeLabel,
                    nodeType: out.nodeType,
                    fields,
                });
            }
        });

        return result;
    }, [outputs]);

    // Filter by search
    const filtered = useMemo(() => {
        if (!search) return nodeFields;
        const q = search.toLowerCase();
        return nodeFields.map(node => ({
            ...node,
            fields: node.fields.filter(f =>
                f.path.toLowerCase().includes(q) ||
                f.reference.toLowerCase().includes(q) ||
                f.preview.toLowerCase().includes(q)
            ),
        })).filter(node => node.fields.length > 0);
    }, [nodeFields, search]);

    if (!isOpen) return null;

    return (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl border border-gray-100 dark:border-zinc-800/80 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-3 border-b border-gray-50 bg-gray-50/50">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600 dark:text-zinc-300 flex items-center gap-1.5">
                        <Braces className="h-3.5 w-3.5 text-indigo-500" />
                        Campos Disponíveis
                    </span>
                    <button onClick={onClose} className="text-xs text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300 transition-colors">✕</button>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-300" />
                    <input
                        type="text"
                        placeholder="Buscar campo..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 bg-white border border-gray-200 dark:border-zinc-800 rounded-lg text-xs text-gray-700 dark:text-zinc-200 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-400"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                {filtered.length === 0 ? (
                    <div className="p-6 text-center">
                        <Braces className="h-6 w-6 text-gray-200 mx-auto mb-2" />
                        <p className="text-xs text-gray-400 dark:text-zinc-400">
                            {Object.keys(outputs).length === 0
                                ? 'Execute os nós primeiro para ver os campos'
                                : 'Nenhum campo encontrado'}
                        </p>
                    </div>
                ) : (
                    filtered.map(node => (
                        <NodeFieldGroup
                            key={node.nodeId}
                            node={node}
                            isExpanded={expanded[node.nodeId] !== false}
                            onToggle={() => setExpanded(prev => ({
                                ...prev,
                                [node.nodeId]: prev[node.nodeId] === false ? true : false,
                            }))}
                            onSelectField={onSelectField}
                        />
                    ))
                )}
            </div>
        </div>
    );
});

OutputFieldMapper.displayName = 'OutputFieldMapper';

// ---- Node Field Group ----

const nodeTypeColors: Record<string, string> = {
    http_request: 'bg-sky-500',
    code: 'bg-gray-50 dark:bg-zinc-900/500',
    ai_agent: 'bg-violet-500',
    condition: 'bg-amber-500',
    filter: 'bg-indigo-500',
    edit_fields: 'bg-teal-500',
    send_message: 'bg-blue-500',
    trigger: 'bg-yellow-500',
};

function NodeFieldGroup({
    node,
    isExpanded,
    onToggle,
    onSelectField,
}: {
    node: { nodeId: string; nodeLabel: string; nodeType: string; fields: Array<{ path: string; reference: string; type: string; preview: string }> };
    isExpanded: boolean;
    onToggle: () => void;
    onSelectField: (ref: string) => void;
}) {
    return (
        <div className="border-b border-gray-50 last:border-b-0">
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:bg-zinc-900/50 transition-colors text-left"
            >
                <div className={`w-2 h-2 rounded-full ${nodeTypeColors[node.nodeType] || 'bg-gray-400'}`} />
                <span className="text-xs font-semibold text-gray-700 dark:text-zinc-200 flex-1">{node.nodeLabel}</span>
                <span className="text-[10px] text-gray-300">{node.fields.length}</span>
                <ChevronDown className={`h-3 w-3 text-gray-300 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
            </button>
            {isExpanded && (
                <div className="pb-1">
                    {node.fields.map((field, i) => (
                        <FieldItem key={i} field={field} onSelect={() => onSelectField(field.reference)} />
                    ))}
                </div>
            )}
        </div>
    );
}

function FieldItem({ field, onSelect }: { field: { path: string; reference: string; type: string; preview: string }; onSelect: () => void }) {
    const [copied, setCopied] = useState(false);

    const typeIcon: Record<string, string> = {
        string: 'text-emerald-500',
        number: 'text-blue-500',
        boolean: 'text-amber-500',
        object: 'text-violet-500',
        array: 'text-pink-500',
    };

    const handleClick = () => {
        onSelect();
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            onClick={handleClick}
            className="w-full flex items-center gap-2 pl-7 pr-3 py-1.5 hover:bg-indigo-50/60 transition-colors text-left group"
        >
            <span className={`text-[9px] font-bold ${typeIcon[field.type] || 'text-gray-400 dark:text-zinc-400'}`}>
                {field.type.slice(0, 3).toUpperCase()}
            </span>
            <span className="text-[11px] font-mono text-gray-600 dark:text-zinc-300 flex-1 truncate">
                {field.path}
            </span>
            <span className="text-[10px] text-gray-300 truncate max-w-[80px] hidden group-hover:block">
                {field.preview}
            </span>
            {copied ? (
                <Check className="h-3 w-3 text-emerald-500 shrink-0" />
            ) : (
                <Copy className="h-3 w-3 text-gray-200 group-hover:text-indigo-400 shrink-0" />
            )}
        </button>
    );
}

// ---- Helpers ----

function extractFieldsFlat(
    data: any,
    nodeLabel: string,
    prefix = '',
): Array<{ path: string; reference: string; type: string; preview: string }> {
    if (!data || typeof data !== 'object') return [];

    const fields: Array<{ path: string; reference: string; type: string; preview: string }> = [];

    for (const [key, value] of Object.entries(data)) {
        const path = prefix ? `${prefix}.${key}` : key;
        const reference = `{{${nodeLabel}.${path}}}`;

        if (value === null || value === undefined) {
            fields.push({ path, reference, type: 'null', preview: 'null' });
        } else if (Array.isArray(value)) {
            fields.push({ path, reference, type: 'array', preview: `[${value.length}]` });
        } else if (typeof value === 'object') {
            fields.push({ path, reference, type: 'object', preview: `{...}` });
            // Recurse one level deep
            if (prefix.split('.').length < 2) {
                fields.push(...extractFieldsFlat(value, nodeLabel, path));
            }
        } else {
            fields.push({ path, reference, type: typeof value, preview: String(value).slice(0, 50) });
        }
    }

    return fields;
}
