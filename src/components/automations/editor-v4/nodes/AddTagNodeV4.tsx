'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { Hash } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const AddTagNodeV4 = memo(({ data, selected }: NodePropsV4<{ tagId?: string; tag_name?: string }>) => (
    <BaseNode selected={selected} accentColor="rose" icon={Hash}
        category="CRM" label={data.label || 'Adicionar Tag'}
        onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
        footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="rose" /></div>}
    >
        <NodeHandle type="target" position={Position.Top} accentColor="rose" />
        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/80 px-3 py-2.5">
            {data.tagId || data.tag_name
                ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800/50 px-2 py-0.5 rounded-full"># {data.tag_name || data.tagId}</span>
                : <p className="text-[11px] text-zinc-400 dark:text-zinc-400 italic">Selecionar tag...</p>}
        </div>
    </BaseNode>
));
AddTagNodeV4.displayName = 'AddTagNodeV4';
