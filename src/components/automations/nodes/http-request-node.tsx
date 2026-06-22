'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

const methodColors: Record<string, string> = {
    GET: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    POST: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    PUT: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    PATCH: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    DELETE: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

export const HttpRequestNode = memo(({ data, selected }: any) => {
    const method = data.method || 'GET';

    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-sky-500' : 'border-sky-500/20'} min-w-[280px] max-w-[340px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-sky-50 dark:bg-sky-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={Globe}
                category="Avançado"
                label={data.label || 'HTTP Request'}
                selected={selected}
                color={{ bg: 'bg-sky-50 dark:bg-sky-900/30', text: 'text-sky-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-gray-50 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80 space-y-2">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${methodColors[method] || 'bg-slate-100 dark:bg-zinc-800/80 text-gray-500 dark:text-zinc-400'}`}>
                        {method}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-zinc-400 font-mono truncate flex-1">
                        {data.url || 'https://...'}
                    </span>
                </div>

                {data.auth_type && data.auth_type !== 'none' && (
                    <div className="text-[10px] text-sky-500 font-semibold">
                        🔒 Auth: {data.auth_type}
                    </div>
                )}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-sky-50 dark:bg-sky-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

HttpRequestNode.displayName = 'HttpRequestNode';
