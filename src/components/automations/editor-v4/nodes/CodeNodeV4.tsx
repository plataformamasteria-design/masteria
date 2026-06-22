'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { Code2 } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const CodeNodeV4 = memo(({ data, selected }: NodePropsV4<{ language?: string; code?: string }>) => {
    const lang = data.language || 'javascript';
    const hasCode = !!(data.code?.trim());
    return (
        <BaseNode selected={selected} accentColor="zinc" icon={Code2}
            category="Avançado" label={data.label || 'Executar Código'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="zinc" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="zinc" />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/80 px-3 py-2.5 flex items-center gap-2">
                <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{lang}</span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{hasCode ? 'Código configurado' : 'Clique para escrever o código'}</span>
            </div>
        </BaseNode>
    );
});
CodeNodeV4.displayName = 'CodeNodeV4';
