'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { Wifi } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const AssignConnectionNodeV4 = memo(({ data, selected }: NodePropsV4<{ connection_id?: string; connection_name?: string }>) => {
    return (
        <BaseNode selected={selected} accentColor="indigo" icon={Wifi}
            category="CRM" label={data.label || 'Atribuir Conexão'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="indigo" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="indigo" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5 space-y-1">
                <p className="text-[11px] text-zinc-600 font-medium">
                    {data.connection_id ? 'Conexão definida:' : 'Não configurado'}
                </p>
                {data.connection_id && (
                    <p className="text-[10px] text-zinc-500 font-medium bg-zinc-200/50 px-2 py-0.5 rounded inline-block truncate max-w-full">
                        🌐 {data.connection_name || 'Conexão'}
                    </p>
                )}
            </div>
        </BaseNode>
    );
});
AssignConnectionNodeV4.displayName = 'AssignConnectionNodeV4';
