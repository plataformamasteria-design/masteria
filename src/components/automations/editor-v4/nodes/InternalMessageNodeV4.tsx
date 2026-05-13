import { memo } from 'react';
import { Position } from '@xyflow/react';
import { MessageSquareWarning } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

export const InternalMessageNodeV4 = memo(({ data, selected }: any) => {
    const message = data.message || data.note || '';

    return (
        <BaseNode selected={selected} accentColor="amber" icon={MessageSquareWarning}
            category="CRM & Ações" label={data.label || 'Mensagem Interna'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="amber" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="amber" />
            <div className="bg-amber-50 rounded-xl border border-amber-200 px-3 py-2.5">
                {message ? (
                    <p className="text-[11px] text-amber-800 line-clamp-3 leading-relaxed font-medium">{message}</p>
                ) : (
                    <p className="text-[11px] text-amber-600/60 italic">Configurar mensagem interna...</p>
                )}
            </div>
        </BaseNode>
    );
});

InternalMessageNodeV4.displayName = 'InternalMessageNodeV4';
