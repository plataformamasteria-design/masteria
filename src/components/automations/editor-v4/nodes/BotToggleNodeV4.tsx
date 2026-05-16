'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { Bot } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const BotToggleNodeV4 = memo(({ data, selected }: NodePropsV4<{ action?: 'stop' | 'start' }>) => (
    <BaseNode selected={selected} accentColor="zinc" icon={Bot}
        category="Controle" label={data.label || 'Controlar Robô'}
        onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
        footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="zinc" /></div>}
    >
        <NodeHandle type="target" position={Position.Top} accentColor="zinc" />
        <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
            <span className={`text-[11px] font-semibold ${data.action === 'stop' ? 'text-rose-500' : 'text-green-500'}`}>
                {data.action === 'stop' ? '⏹ Pausar robô' : '▶ Retomar robô'}
            </span>
        </div>
    </BaseNode>
));
BotToggleNodeV4.displayName = 'BotToggleNodeV4';
