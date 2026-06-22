'use client';

import React, { memo, useState, useMemo } from 'react';
import {
    ChevronRight, ChevronDown, Copy, Check, GripVertical,
    FileJson, FileText, List, Database,
} from 'lucide-react';
import type { NodeTestOutput } from '@/hooks/useNodeTestOutputs';

interface NodeInputPanelProps {
    /** All test outputs from previous nodes */
    allTestOutputs: Record<string, NodeTestOutput>;
    /** Current node ID (to exclude from input list) */
    currentNodeId: string;
    /** Ordered list of node IDs connected before this node */
    previousNodeIds?: string[];
}

type ViewTab = 'schema' | 'table' | 'json';

/**
 * Left panel showing data from previous nodes.
 * Fields are draggable – drop them into parameter fields to create references.
 */
export const NodeInputPanel = memo(({
    allTestOutputs,
    currentNodeId,
    previousNodeIds = [],
}: NodeInputPanelProps) => {
    const [activeTab, setActiveTab] = useState<ViewTab>('schema');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    // Get outputs from previous nodes only
    const previousOutputs = useMemo(() => {
        const result: NodeTestOutput[] = [];

        // If we have ordered previous nodes, use that order
        if (previousNodeIds.length > 0) {
            for (const nodeId of previousNodeIds) {
                if (nodeId !== currentNodeId && allTestOutputs[nodeId]) {
                    result.push(allTestOutputs[nodeId]);
                }
            }
        } else {
            // Fallback: show all outputs except current node
            Object.entries(allTestOutputs).forEach(([id, output]) => {
                if (id !== currentNodeId) {
                    result.push(output);
                }
            });
        }

        return result;
    }, [allTestOutputs, currentNodeId, previousNodeIds]);

    const tabs: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
        { id: 'schema', label: 'Schema', icon: <List className="h-3 w-3" /> },
        { id: 'table', label: 'Table', icon: <Database className="h-3 w-3" /> },
        { id: 'json', label: 'JSON', icon: <FileJson className="h-3 w-3" /> },
    ];

    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    };

    if (previousOutputs.length === 0) {
        return (
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800/80 bg-gray-50/50">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-400">Input</span>
                </div>
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="text-center">
                        <Database className="h-8 w-8 text-gray-200 mx-auto mb-3" />
                        <p className="text-xs text-gray-400 dark:text-zinc-400 font-medium">Nenhum dado de entrada</p>
                        <p className="text-[10px] text-gray-300 mt-1">Execute os nodes anteriores para ver os dados aqui</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800/80 bg-gray-50/50 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-400">Input</span>
                <span className="text-[10px] text-gray-300">{previousOutputs.length} node{previousOutputs.length > 1 ? 's' : ''}</span>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 dark:border-zinc-800/80 bg-white">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors border-b-2 ${activeTab === tab.id
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {previousOutputs.map((output) => (
                    <div key={output.nodeId}>
                        {/* Node header */}
                        <button
                            onClick={() => toggleNode(output.nodeId)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50/80 border-b border-gray-100 dark:border-zinc-800/80 hover:bg-gray-100/50 transition-colors"
                        >
                            {expandedNodes.has(output.nodeId) || previousOutputs.length === 1 ? (
                                <ChevronDown className="h-3 w-3 text-gray-400 dark:text-zinc-400" />
                            ) : (
                                <ChevronRight className="h-3 w-3 text-gray-400 dark:text-zinc-400" />
                            )}
                            <span className="text-[11px] font-semibold text-gray-600 dark:text-zinc-300">{output.nodeLabel}</span>
                            {output.status === 'ok' && (
                                <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium ml-auto">
                                    1 item
                                </span>
                            )}
                        </button>

                        {/* Node data */}
                        {(expandedNodes.has(output.nodeId) || previousOutputs.length === 1) && output.output && (
                            <div className="border-b border-gray-100 dark:border-zinc-800/80">
                                {activeTab === 'schema' && (
                                    <DraggableSchemaFields
                                        data={output.output}
                                        nodeLabel={output.nodeLabel}
                                    />
                                )}
                                {activeTab === 'table' && (
                                    <TableView data={output.output} />
                                )}
                                {activeTab === 'json' && (
                                    <pre className="p-3 text-[11px] font-mono text-gray-600 dark:text-zinc-300 whitespace-pre-wrap break-all bg-gray-50/30">
                                        {typeof output.output === 'string'
                                            ? output.output
                                            : JSON.stringify(output.output, null, 2)}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
});

NodeInputPanel.displayName = 'NodeInputPanel';

// ---- Draggable Schema Fields ----

function DraggableSchemaFields({ data, nodeLabel }: { data: any; nodeLabel: string }) {
    const fields = useMemo(() => extractDraggableFields(data, nodeLabel), [data, nodeLabel]);

    if (fields.length === 0) {
        return <div className="p-4 text-[11px] text-gray-400 dark:text-zinc-400 italic">Nenhum campo encontrado</div>;
    }

    return (
        <div className="divide-y divide-gray-50">
            {fields.map((field, i) => (
                <DraggableFieldRow key={i} field={field} />
            ))}
        </div>
    );
}

interface DraggableFieldInfo {
    path: string;
    reference: string;
    type: string;
    value: string;
    depth: number;
}

function extractDraggableFields(data: any, nodeLabel: string, prefix = '', depth = 0): DraggableFieldInfo[] {
    if (!data || typeof data !== 'object') return [];

    const fields: DraggableFieldInfo[] = [];
    const entries = Object.entries(data);

    for (const [key, value] of entries) {
        const path = prefix ? `${prefix}.${key}` : key;
        const reference = `{{ ${nodeLabel}.${path} }}`;

        if (value === null || value === undefined) {
            fields.push({ path, reference, type: 'null', value: 'null', depth });
        } else if (typeof value === 'object' && !Array.isArray(value)) {
            fields.push({ path, reference, type: 'object', value: `{${Object.keys(value).length}}`, depth });
            if (depth < 3) {
                fields.push(...extractDraggableFields(value, nodeLabel, path, depth + 1));
            }
        } else if (Array.isArray(value)) {
            fields.push({ path, reference, type: 'array', value: `[${value.length}]`, depth });
        } else {
            fields.push({ path, reference, type: typeof value, value: String(value).slice(0, 50), depth });
        }
    }

    return fields;
}

function DraggableFieldRow({ field }: { field: DraggableFieldInfo }) {
    const [copied, setCopied] = useState(false);

    const typeColors: Record<string, string> = {
        string: 'bg-emerald-50 text-emerald-600',
        number: 'bg-blue-50 text-blue-600',
        boolean: 'bg-amber-50 text-amber-600',
        object: 'bg-violet-50 text-violet-600',
        array: 'bg-pink-50 text-pink-600',
        null: 'bg-gray-100 dark:bg-zinc-800/80 text-gray-400 dark:text-zinc-400',
    };

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', field.reference);
        e.dataTransfer.setData('application/x-n8n-field', JSON.stringify(field));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(field.reference);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-50/40 transition-colors cursor-grab active:cursor-grabbing group"
            style={{ paddingLeft: `${12 + field.depth * 16}px` }}
        >
            <GripVertical className="h-3 w-3 text-gray-200 group-hover:text-indigo-300 shrink-0 transition-colors" />
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${typeColors[field.type] || typeColors.null}`}>
                {field.type}
            </span>
            <span className="text-[11px] font-mono text-gray-700 dark:text-zinc-200 truncate flex-1">
                {field.path}
            </span>
            <span className="text-[10px] text-gray-300 truncate max-w-[80px] hidden group-hover:block">
                {field.value}
            </span>
            <button
                onClick={handleCopy}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                {copied ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                    <Copy className="h-3 w-3 text-gray-300 hover:text-indigo-400" />
                )}
            </button>
        </div>
    );
}

// ---- Table View ----

function TableView({ data }: { data: any }) {
    if (!data || typeof data !== 'object') {
        return <div className="p-4 text-[11px] text-gray-400 dark:text-zinc-400 italic">Dados não tabulares</div>;
    }

    const entries = Object.entries(data);
    if (entries.length === 0) {
        return <div className="p-4 text-[11px] text-gray-400 dark:text-zinc-400 italic">Vazio</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
                <thead>
                    <tr className="bg-gray-50 dark:bg-zinc-900/80">
                        <th className="text-left px-3 py-2 text-gray-400 dark:text-zinc-400 font-semibold border-b border-gray-100 dark:border-zinc-800/80">Campo</th>
                        <th className="text-left px-3 py-2 text-gray-400 dark:text-zinc-400 font-semibold border-b border-gray-100 dark:border-zinc-800/80">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map(([key, value]) => (
                        <tr key={key} className="hover:bg-gray-50/50 border-b border-gray-50">
                            <td className="px-3 py-2 font-mono text-violet-600 font-medium">{key}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-zinc-300 truncate max-w-[150px]">
                                {typeof value === 'object'
                                    ? JSON.stringify(value).slice(0, 80)
                                    : String(value).slice(0, 80)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
