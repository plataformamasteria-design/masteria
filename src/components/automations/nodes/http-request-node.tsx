'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

const methodColors: Record<string, string> = {
    GET: 'bg-green-50 text-green-700',
    POST: 'bg-blue-50 text-blue-700',
    PUT: 'bg-amber-50 text-amber-700',
    PATCH: 'bg-orange-50 text-orange-700',
    DELETE: 'bg-red-50 text-red-700',
};

export const HttpRequestNode = memo(({ data, selected }: any) => {
    const method = data.method || 'GET';

    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white border ${selected ? 'border-sky-500' : 'border-sky-500/20'} min-w-[280px] max-w-[340px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-sky-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={Globe}
                category="Avançado"
                label={data.label || 'HTTP Request'}
                selected={selected}
                color={{ bg: 'bg-sky-500/10', text: 'text-sky-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 space-y-2">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${methodColors[method] || 'bg-slate-100 text-gray-500'}`}>
                        {method}
                    </span>
                    <span className="text-[11px] text-gray-500 font-mono truncate flex-1">
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
                className="!w-4 !h-4 !bg-sky-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

HttpRequestNode.displayName = 'HttpRequestNode';
