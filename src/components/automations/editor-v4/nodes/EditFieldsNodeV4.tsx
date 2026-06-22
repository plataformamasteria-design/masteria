'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { PenLine } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const EditFieldsNodeV4 = memo(({ data, selected }: NodePropsV4<{ fields?: unknown[] }>) => {
    const fields = data.fields || [];
    return (
        <BaseNode selected={selected} accentColor="teal" icon={PenLine}
            category="Avançado" label={data.label || 'Editar Campos'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="teal" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="teal" />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/80 px-3 py-2.5">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {fields.length > 0 ? `${fields.length} campo(s) configurado(s)` : 'Nenhum campo configurado'}
                </p>
            </div>
        </BaseNode>
    );
});
EditFieldsNodeV4.displayName = 'EditFieldsNodeV4';
