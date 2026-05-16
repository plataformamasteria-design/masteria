'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { UserPlus } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const AssignUserNodeV4 = memo(({ data, selected }: NodePropsV4<{ assign_type?: string; user_name?: string; team_name?: string }>) => {
    const labelMap: Record<string, string> = {
        user: 'Agente específico',
        team: 'Equipe específica',
        random_in_team: 'Aleatório na equipe',
    };
    return (
        <BaseNode selected={selected} accentColor="fuchsia" icon={UserPlus}
            category="CRM" label={data.label || 'Atribuir Lead'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="fuchsia" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="fuchsia" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5 space-y-1">
                <p className="text-[11px] text-zinc-600 font-medium">
                    {data.assign_type && labelMap[data.assign_type] ? labelMap[data.assign_type] : 'Não configurado'}
                </p>
                {data.assign_type === 'user' && data.user_name && (
                    <p className="text-[10px] text-zinc-500 font-medium bg-zinc-200/50 px-2 py-0.5 rounded inline-block truncate max-w-full">
                        👤 {data.user_name}
                    </p>
                )}
                {(data.assign_type === 'team' || data.assign_type === 'random_in_team') && data.team_name && (
                    <p className="text-[10px] text-zinc-500 font-medium bg-zinc-200/50 px-2 py-0.5 rounded inline-block truncate max-w-full">
                        👥 {data.team_name}
                    </p>
                )}
            </div>
        </BaseNode>
    );
});
AssignUserNodeV4.displayName = 'AssignUserNodeV4';
