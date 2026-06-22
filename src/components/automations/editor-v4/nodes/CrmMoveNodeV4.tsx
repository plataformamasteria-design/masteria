'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { Columns3 } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const CrmMoveNodeV4 = memo(({ data, selected }: NodePropsV4<{ funnel_name?: string; stage_name?: string }>) => (
    <BaseNode selected={selected} accentColor="orange" icon={Columns3}
        category="CRM" label={data.label || 'Mover Kanban'}
        onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
        footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="orange" /></div>}
    >
        <NodeHandle type="target" position={Position.Top} accentColor="orange" />
        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/80 px-3 py-2.5 space-y-1">
            {data.funnel_name && <p className="text-[11px] text-zinc-700 dark:text-zinc-200 font-medium">📊 {data.funnel_name}</p>}
            {data.stage_name && <p className="text-[10px] text-zinc-500 dark:text-zinc-400">→ {data.stage_name}</p>}
            {!data.funnel_name && <p className="text-[11px] text-zinc-400 dark:text-zinc-400 italic">Selecionar funil e etapa...</p>}
        </div>
    </BaseNode>
));
CrmMoveNodeV4.displayName = 'CrmMoveNodeV4';
