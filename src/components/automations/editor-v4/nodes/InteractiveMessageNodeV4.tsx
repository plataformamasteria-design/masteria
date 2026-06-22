'use client';

import React, { memo, useEffect } from 'react';
import { Position, useUpdateNodeInternals, useNodeId } from '@xyflow/react';
import { MessageSquareDashed, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { BaseNode } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';
import { useFlowAnalyticsContext } from '../FlowAnalyticsContext';

export const InteractiveMessageNodeV4 = memo(({ id, data, selected }: NodePropsV4) => {
    const message = data.message || data.content || data.text || '';
    const preview = message.length > 80 ? message.slice(0, 80) + '...' : message;
    
    // Normaliza botões: pode vir como array de strings ou array de objetos {id, text, type}
    const rawButtons: Record<string, unknown>[] = (data.buttons as Record<string, unknown>[]) || [];
    const buttons = rawButtons.map((btn, i) => 
        typeof btn === 'string' 
            ? { id: `btn_${i}`, text: btn, type: 'inline' }
            : { id: btn.id || `btn_${i}`, text: btn.text || btn.label || `Botão ${i+1}`, type: btn.type || 'inline' }
    );
    
    const hasAttachments = Array.isArray(data.attachments) && data.attachments.length > 0;
    const attachment = hasAttachments ? data.attachments[0] : null;

    // Handles estáticos sempre presentes nesse super-nó
    // "Outra resposta", "Sem resposta (timeout)", "Erro"
    const staticHandles = [
        { id: 'other_response', label: 'Outra resp.', color: 'zinc' },
        { id: 'no_response', label: 'Sem resp.', color: 'amber' },
        { id: 'error', label: 'Falha', color: 'rose' }
    ];

    const colTotal = buttons.length + staticHandles.length;

    const updateNodeInternals = useUpdateNodeInternals();
    useEffect(() => {
        if (id) updateNodeInternals(id);
    }, [id, buttons.length, updateNodeInternals]);

    const nodeId = useNodeId();
    const { stats: allStats } = useFlowAnalyticsContext();
    const stats = allStats?.find((s) => s.nodeId === nodeId);

    const getPercentage = (handleId: string) => {
        if (!stats || !stats.totalReached) return null;
        const count = stats.responses?.[handleId] || 0;
        if (count === 0) return '0%';
        return Math.round((count / stats.totalReached) * 100) + '%';
    };

    const footer = (
        <div style={{ position: 'relative' }}>
            {/* Labels visuais */}
            <div className="grid divide-x divide-zinc-100" style={{ gridTemplateColumns: `repeat(${colTotal}, 1fr)` }}>
                {buttons.map((btn, i) => (
                    <div key={btn.id} className="flex flex-col items-center justify-center gap-1 py-3 bg-blue-50/30">
                        <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide truncate px-1 max-w-[50px]" title={btn.text}>
                            {btn.text}
                        </span>
                        {getPercentage(btn.id) && (
                            <span className="text-[10px] font-bold text-blue-500 dark:text-blue-300">
                                {getPercentage(btn.id)}
                            </span>
                        )}
                    </div>
                ))}
                {staticHandles.map((handle, i) => (
                    <div key={handle.id} className="flex flex-col items-center justify-center gap-1 py-3">
                        <span className={`text-[9px] font-semibold text-${handle.color}-500 uppercase tracking-wide truncate px-1 max-w-[50px]`} title={handle.label}>
                            {handle.label}
                        </span>
                        {getPercentage(handle.id) && (
                            <span className={`text-[10px] font-bold text-${handle.color}-400`}>
                                {getPercentage(handle.id)}
                            </span>
                        )}
                    </div>
                ))}
            </div>
            
            {/* Handles absolutamente posicionados */}
            {buttons.map((btn, i) => (
                <NodeHandle
                    key={btn.id}
                    type="source"
                    position={Position.Bottom}
                    id={btn.id}
                    accentColor="blue"
                    colIndex={i}
                    colTotal={colTotal}
                />
            ))}
            {staticHandles.map((handle, i) => (
                <NodeHandle
                    key={handle.id}
                    type="source"
                    position={Position.Bottom}
                    id={handle.id}
                    accentColor={handle.color as "orange" | "violet" | "rose" | "zinc" | "cyan" | "fuchsia" | "amber" | "teal" | "blue" | "green" | "red" | "indigo" | "emerald" | "yellow" | "sky"}
                    colIndex={buttons.length + i}
                    colTotal={colTotal}
                />
            ))}
        </div>
    );

    return (
        <BaseNode
            selected={selected}
            accentColor="blue"
            icon={MessageSquareDashed}
            category="Mensagens"
            label={data.label || 'Mensagem Interativa'}
            onDelete={data.onDelete}
            onDuplicate={data.onDuplicate}
            onLabelChange={data.onLabelChange}
            footer={footer}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="blue" />
            
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/80 p-2.5 flex flex-col gap-2 min-w-[200px]">
                {/* Media Preview Seção */}
                {hasAttachments && (
                    <div className="flex items-center gap-2 bg-zinc-200/50 dark:bg-zinc-800/50 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        {attachment.type === 'video' ? <Video className="w-4 h-4 text-zinc-500 dark:text-zinc-400" /> :
                         attachment.type === 'image' ? <ImageIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" /> :
                         <FileText className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />}
                        <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300 truncate flex-1">
                            {attachment.is_external ? 'Mídia Externa' : 'Mídia Local'} ({attachment.type})
                        </span>
                    </div>
                )}
                
                {/* Text Preview Seção */}
                {preview ? (
                    <p className="text-[12px] text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">{preview}</p>
                ) : (
                    <p className="text-[12px] text-zinc-400 dark:text-zinc-400 italic">Sem texto principal...</p>
                )}
                
                {/* Inline Buttons Preview Seção */}
                {buttons.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1">
                        {buttons.map((btn) => (
                            <div key={btn.id} className="w-full py-1.5 px-3 bg-white dark:bg-zinc-900 border border-blue-100 dark:border-blue-800/50 rounded-lg flex items-center justify-center">
                                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 truncate">{btn.text}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </BaseNode>
    );
});

InteractiveMessageNodeV4.displayName = 'InteractiveMessageNodeV4';
