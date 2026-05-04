'use client';

import React, { memo, useState, useMemo } from 'react';
import {
    Play, Loader2, Clock, CheckCircle, XCircle,
    FileJson, FileText, List, ChevronRight, ChevronDown,
    Copy, Check, GripVertical, Pin, Database,
} from 'lucide-react';
import type { NodeTestOutput } from '@/hooks/useNodeTestOutputs';

interface NodeOutputPanelProps {
    nodeId: string;
    nodeType: string;
    nodeData: any;
    output: NodeTestOutput | undefined;
    isLoading: boolean;
    onTest: () => void;
    isListening?: boolean;
    onListen?: () => void;
    onCancelListen?: () => void;
}

type ViewTab = 'schema' | 'table' | 'json';

export const NodeOutputPanel = memo(({
    nodeId,
    nodeType,
    nodeData,
    output,
    isLoading,
    onTest,
    isListening,
    onListen,
    onCancelListen,
}: NodeOutputPanelProps) => {
    const [activeTab, setActiveTab] = useState<ViewTab>('schema');
    const [copied, setCopied] = useState(false);

    const canTest = ['http_request', 'code', 'condition', 'filter', 'edit_fields', 'ai_agent', 'send_message', 'message', 'delay', 'router', 'action', 'trigger'].includes(nodeType);

    // Detect webhook trigger
    const isWebhookTrigger = nodeType === 'trigger' && ['webhook', 'webhook_pix', 'webhook_sale', 'manual'].includes(nodeData?.triggerType || '');

    const tabs: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
        { id: 'schema', label: 'Schema', icon: <List className="h-3 w-3" /> },
        { id: 'table', label: 'Table', icon: <Database className="h-3 w-3" /> },
        { id: 'json', label: 'JSON', icon: <FileJson className="h-3 w-3" /> },
    ];

    const handleCopy = () => {
        if (!output?.output) return;
        const text = activeTab === 'json'
            ? JSON.stringify(output.output, null, 2)
            : (typeof output.output === 'string' ? output.output : JSON.stringify(output.output));
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Output</span>
                <div className="flex items-center gap-1.5">
                    {/* Webhook listen button */}
                    {isWebhookTrigger && onListen && (
                        <button
                            onClick={isListening ? onCancelListen : onListen}
                            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md transition-all active:scale-95 ${isListening
                                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                : 'bg-teal-50 text-teal-600 hover:bg-teal-100 border border-teal-200'
                                }`}
                        >
                            {isListening ? (
                                <>
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                                    </span>
                                    Cancelar
                                </>
                            ) : '🎧 Escutar'}
                        </button>
                    )}

                    {/* Execute button */}
                    <button
                        onClick={onTest}
                        disabled={isLoading || !canTest}
                        className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all active:scale-95 ${isLoading
                            ? 'bg-gray-100 text-gray-400 cursor-wait'
                            : canTest
                                ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            }`}
                    >
                        {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <Play className="h-3 w-3" />
                        )}
                        {isLoading ? 'Executando...' : 'Execute step'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            {output && (
                <div className="flex border-b border-gray-100 bg-white px-2 shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1 px-3 py-2 text-[11px] font-medium transition-colors border-b-2 ${activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                    <div className="flex-1" />
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 px-2 py-2 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Has output */}
                {output && (
                    <>
                        {/* Status bar */}
                        <div className={`flex items-center gap-2 px-4 py-2 text-[11px] border-b ${output.status === 'ok' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                            {output.status === 'ok'
                                ? <CheckCircle className="h-3 w-3 text-emerald-500" />
                                : <XCircle className="h-3 w-3 text-red-500" />}
                            <span className={output.status === 'ok' ? 'text-emerald-700' : 'text-red-600'}>
                                {output.message || (output.status === 'ok' ? 'Sucesso' : 'Erro')}
                            </span>
                            <div className="flex-1" />
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-gray-400">{output.executionTime}ms</span>
                        </div>

                        {activeTab === 'schema' && (
                            <OutputSchemaView data={output.output} nodeLabel={output.nodeLabel} />
                        )}
                        {activeTab === 'table' && (
                            <OutputTableView data={output.output} />
                        )}
                        {activeTab === 'json' && (
                            <JsonTreeView data={output.output} />
                        )}
                    </>
                )}

                {/* Loading state */}
                {isLoading && !output && (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center">
                            <Loader2 className="h-7 w-7 text-indigo-400 animate-spin mx-auto mb-3" />
                            <p className="text-xs text-gray-400">Executando...</p>
                        </div>
                    </div>
                )}

                {/* Listening state */}
                {isListening && !output && (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center">
                            <div className="relative flex h-8 w-8 mx-auto mb-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-8 w-8 bg-teal-500 items-center justify-center">
                                    <span className="text-white text-sm">🎧</span>
                                </span>
                            </div>
                            <p className="text-xs text-teal-600 font-medium">Aguardando webhook...</p>
                            <p className="text-[10px] text-gray-400 mt-1">Envie dados para a URL do webhook</p>
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!output && !isLoading && !isListening && (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center">
                            <div className="text-3xl mb-3">|→</div>
                            <p className="text-xs font-medium text-gray-500">No output data</p>
                            <p className="text-[10px] text-gray-400 mt-1.5">
                                <button onClick={onTest} className="text-indigo-500 hover:text-indigo-600 font-medium">Execute step</button>
                                {' '}or{' '}
                                <button className="text-indigo-500 hover:text-indigo-600 font-medium">set mock data</button>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

NodeOutputPanel.displayName = 'NodeOutputPanel';

// ---- JSON Tree View ----

function JsonTreeView({ data }: { data: any }) {
    if (data === null || data === undefined) {
        return <div className="p-4 text-[11px] text-gray-400 italic">null</div>;
    }
    return (
        <div className="p-3 text-[11px] font-mono">
            <JsonNode value={data} path="" depth={0} />
        </div>
    );
}

function JsonNode({ value, path, depth }: { value: any; path: string; depth: number }) {
    const [expanded, setExpanded] = useState(depth < 2);

    if (value === null) return <span className="text-gray-400">null</span>;
    if (value === undefined) return <span className="text-gray-400">undefined</span>;
    if (typeof value === 'boolean') return <span className="text-amber-600">{value ? 'true' : 'false'}</span>;
    if (typeof value === 'number') return <span className="text-blue-600">{value}</span>;
    if (typeof value === 'string') {
        if (value.length > 80) {
            return <span className="text-emerald-700">&quot;{value.slice(0, 80)}...&quot;</span>;
        }
        return <span className="text-emerald-700">&quot;{value}&quot;</span>;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return <span className="text-gray-400">[]</span>;
        return (
            <div>
                <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors">
                    {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="text-gray-400">Array ({value.length})</span>
                </button>
                {expanded && (
                    <div className="ml-4 border-l border-gray-100 pl-3 mt-1 space-y-0.5">
                        {value.map((item, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <span className="text-gray-300 select-none shrink-0">{i}:</span>
                                <JsonNode value={item} path={`${path}[${i}]`} depth={depth + 1} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) return <span className="text-gray-400">{'{}'}</span>;
        return (
            <div>
                <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors">
                    {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="text-gray-400">Object ({keys.length} keys)</span>
                </button>
                {expanded && (
                    <div className="ml-4 border-l border-gray-100 pl-3 mt-1 space-y-0.5">
                        {keys.map(key => (
                            <div key={key} className="flex items-start gap-2">
                                <span className="text-violet-600 shrink-0">&quot;{key}&quot;:</span>
                                <JsonNode value={value[key]} path={`${path}.${key}`} depth={depth + 1} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return <span className="text-gray-500">{String(value)}</span>;
}

// ---- Output Schema View (draggable fields) ----

function OutputSchemaView({ data, nodeLabel }: { data: any; nodeLabel: string }) {
    const fields = useMemo(() => extractFields(data, nodeLabel), [data, nodeLabel]);

    if (fields.length === 0) {
        return <div className="p-4 text-[11px] text-gray-400 italic">Nenhum campo encontrado</div>;
    }

    return (
        <div className="divide-y divide-gray-50">
            {fields.map((field, i) => (
                <DraggableOutputField key={i} field={field} />
            ))}
        </div>
    );
}

interface FieldInfo {
    path: string;
    reference: string;
    type: string;
    value: string;
    depth: number;
}

function extractFields(data: any, nodeLabel: string, prefix = '', depth = 0): FieldInfo[] {
    if (!data || typeof data !== 'object') return [];

    const fields: FieldInfo[] = [];
    const entries = Object.entries(data);

    for (const [key, value] of entries) {
        const path = prefix ? `${prefix}.${key}` : key;
        const reference = `{{ ${nodeLabel}.${path} }}`;

        if (value === null || value === undefined) {
            fields.push({ path, reference, type: 'null', value: 'null', depth });
        } else if (typeof value === 'object' && !Array.isArray(value)) {
            fields.push({ path, reference, type: 'object', value: `{${Object.keys(value).length}}`, depth });
            if (depth < 3) {
                fields.push(...extractFields(value, nodeLabel, path, depth + 1));
            }
        } else if (Array.isArray(value)) {
            fields.push({ path, reference, type: 'array', value: `[${value.length}]`, depth });
        } else {
            fields.push({ path, reference, type: typeof value, value: String(value).slice(0, 50), depth });
        }
    }

    return fields;
}

function DraggableOutputField({ field }: { field: FieldInfo }) {
    const [copied, setCopied] = useState(false);

    const typeColors: Record<string, string> = {
        string: 'bg-emerald-50 text-emerald-600',
        number: 'bg-blue-50 text-blue-600',
        boolean: 'bg-amber-50 text-amber-600',
        object: 'bg-violet-50 text-violet-600',
        array: 'bg-pink-50 text-pink-600',
        null: 'bg-gray-100 text-gray-400',
    };

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', field.reference);
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
            style={{ paddingLeft: `${12 + field.depth * 14}px` }}
        >
            <GripVertical className="h-3 w-3 text-gray-200 group-hover:text-indigo-300 shrink-0 transition-colors" />
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${typeColors[field.type] || typeColors.null}`}>
                {field.type}
            </span>
            <span className="text-[11px] font-mono text-gray-700 truncate flex-1">{field.path}</span>
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

function OutputTableView({ data }: { data: any }) {
    if (!data || typeof data !== 'object') {
        return <div className="p-4 text-[11px] text-gray-400 italic">Dados não tabulares</div>;
    }

    const entries = Object.entries(data);
    if (entries.length === 0) {
        return <div className="p-4 text-[11px] text-gray-400 italic">Vazio</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
                <thead>
                    <tr className="bg-gray-50/80">
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold border-b border-gray-100">Campo</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold border-b border-gray-100">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map(([key, val]) => (
                        <tr key={key} className="hover:bg-gray-50/50 border-b border-gray-50">
                            <td className="px-3 py-2 font-mono text-violet-600 font-medium">{key}</td>
                            <td className="px-3 py-2 text-gray-600 truncate max-w-[160px]">
                                {typeof val === 'object'
                                    ? JSON.stringify(val).slice(0, 80)
                                    : String(val).slice(0, 80)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
