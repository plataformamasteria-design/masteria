'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { Database } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const UpdateContactNodeV4 = memo(({ data, selected }: NodePropsV4<{ fields?: unknown[] }>) => {
    const fields = data.fields || [];
    return (
        <BaseNode selected={selected} accentColor="blue" icon={Database}
            category="Ações CRM" label={data.label || 'Campos Personalizados'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="blue" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="blue" />
            <div className="bg-blue-50/50 rounded-xl border border-blue-100/50 px-3 py-2.5 flex flex-col gap-1">
                <p className="text-[11px] text-blue-900 font-medium leading-tight">
                    Cria, atualiza ou gerencia campos.
                </p>
                <p className="text-[10px] text-blue-600/80">
                    {fields.length > 0 ? `${fields.length} campo(s) mapeado(s)` : 'Nenhum campo mapeado'}
                </p>
            </div>
        </BaseNode>
    );
});
UpdateContactNodeV4.displayName = 'UpdateContactNodeV4';
