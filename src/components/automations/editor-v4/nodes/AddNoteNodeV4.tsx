'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { StickyNote } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { NodePropsV4 } from './types';

export const AddNoteNodeV4 = memo(({ data, selected }: NodePropsV4<{ note_text?: string; note?: string }>) => {
    const note = data.note_text || data.note || '';
    return (
        <BaseNode selected={selected} accentColor="amber" icon={StickyNote}
            category="CRM" label={data.label || 'Adicionar Nota'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="amber" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="amber" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
                {note
                    ? <p className="text-[11px] text-zinc-700 line-clamp-2">{note}</p>
                    : <p className="text-[11px] text-zinc-400 italic">Configurar nota interna...</p>}
            </div>
        </BaseNode>
    );
});
AddNoteNodeV4.displayName = 'AddNoteNodeV4';
