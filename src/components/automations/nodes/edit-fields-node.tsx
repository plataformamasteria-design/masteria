'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { PenLine } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

interface EditField {
    name: string;
    value: string;
}

export const EditFieldsNode = memo(({ data, selected }: any) => {
    const fields: EditField[] = data.fields || [];
    const mode = data.mode || 'pairs';

    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-teal-500' : 'border-teal-500/20'} min-w-[280px] max-w-[340px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-teal-50 dark:bg-teal-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={PenLine}
                category="Avançado"
                label={data.label || 'Edit Fields'}
                selected={selected}
                color={{ bg: 'bg-teal-50 dark:bg-teal-900/30', text: 'text-teal-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-gray-50 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80 space-y-1.5">
                {mode === 'pairs' && fields.length > 0 ? (
                    ((Array.isArray(fields) ? fields : []) || []).map((field, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-mono text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                                {field.name || '?'}
                            </span>
                            <span className="text-gray-400 dark:text-zinc-400">=</span>
                            <span className="text-gray-500 dark:text-zinc-400 truncate max-w-[100px]">{field.value || '...'}</span>
                        </div>
                    ))
                ) : mode === 'json' ? (
                    <pre className="text-[10px] text-teal-700 dark:text-teal-300 font-mono line-clamp-3 whitespace-pre-wrap">
                        {data.json_value || '{}'}
                    </pre>
                ) : (
                    <span className="text-[11px] text-teal-400">Sem campos configurados</span>
                )}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-teal-50 dark:bg-teal-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

EditFieldsNode.displayName = 'EditFieldsNode';
