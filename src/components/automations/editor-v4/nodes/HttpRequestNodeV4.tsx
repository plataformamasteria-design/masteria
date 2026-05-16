'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const HttpRequestNodeV4 = memo(({ data, selected }: NodePropsV4<{ method?: string; url?: string }>) => {
    const METHOD_COLORS: Record<string, string> = {
        GET: 'text-green-600 bg-green-50 border-green-100',
        POST: 'text-blue-600 bg-blue-50 border-blue-100',
        PUT: 'text-amber-600 bg-amber-50 border-amber-100',
        PATCH: 'text-orange-600 bg-orange-50 border-orange-100',
        DELETE: 'text-rose-600 bg-rose-50 border-rose-100',
    };
    const method = data.method || 'GET';
    return (
        <BaseNode selected={selected} accentColor="teal" icon={Globe}
            category="Avançado" label={data.label || 'HTTP Request'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="teal" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="teal" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5 flex items-center gap-2">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${METHOD_COLORS[method] || METHOD_COLORS.GET}`}>
                    {method}
                </span>
                <span className="text-[11px] text-zinc-500 font-mono truncate">{data.url || 'URL não configurada'}</span>
            </div>
        </BaseNode>
    );
});
HttpRequestNodeV4.displayName = 'HttpRequestNodeV4';
