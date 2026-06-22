'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const HttpRequestNodeV4 = memo(({ data, selected }: NodePropsV4<{ method?: string; url?: string }>) => {
    const METHOD_COLORS: Record<string, string> = {
        GET: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-100 dark:border-green-800/50',
        POST: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800/50',
        PUT: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800/50',
        PATCH: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-100 dark:border-orange-800/50',
        DELETE: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border-rose-100 dark:border-rose-800/50',
    };
    const method = data.method || 'GET';
    return (
        <BaseNode selected={selected} accentColor="teal" icon={Globe}
            category="Avançado" label={data.label || 'HTTP Request'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="teal" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="teal" />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/80 px-3 py-2.5 flex items-center gap-2">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${METHOD_COLORS[method] || METHOD_COLORS.GET}`}>
                    {method}
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">{data.url || 'URL não configurada'}</span>
            </div>
        </BaseNode>
    );
});
HttpRequestNodeV4.displayName = 'HttpRequestNodeV4';
