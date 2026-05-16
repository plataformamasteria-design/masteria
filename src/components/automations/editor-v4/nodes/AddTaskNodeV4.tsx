import { NodePropsV4 } from './types';
import { memo } from 'react';
import { Position } from '@xyflow/react';
import { CalendarCheck } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

export const AddTaskNodeV4 = memo(({ data, selected }: NodePropsV4) => {
    const taskText = data.task_text || data.text || '';
    const dueDate = data.due_date || '';
    const assignee = data.assignee || '';

    return (
        <BaseNode selected={selected} accentColor="rose" icon={CalendarCheck}
            category="Agendamentos" label={data.label || 'Adicionar Tarefa'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="rose" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="rose" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5 space-y-2">
                {taskText ? (
                    <p className="text-[11px] text-zinc-700 line-clamp-2 leading-relaxed">{taskText}</p>
                ) : (
                    <p className="text-[11px] text-zinc-400 italic">Configurar tarefa...</p>
                )}
                
                {(dueDate || assignee) && (
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-100/60">
                        {dueDate && (
                            <span className="text-[9px] font-medium text-zinc-500 bg-zinc-200/50 px-1.5 py-0.5 rounded">
                                ⏱️ {dueDate}
                            </span>
                        )}
                        {assignee && (
                            <span className="text-[9px] font-medium text-zinc-500 bg-zinc-200/50 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                                👤 {assignee}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </BaseNode>
    );
});

AddTaskNodeV4.displayName = 'AddTaskNodeV4';
