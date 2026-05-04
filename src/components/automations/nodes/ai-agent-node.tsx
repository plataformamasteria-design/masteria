'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Brain, Sparkles } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const AiAgentNode = memo(({ data, selected }: any) => {
    const provider = data.provider || 'gemini';
    const model = data.model || 'gemini-2.0-flash';
    const dialogueMode = data.dialogue_mode || false;

    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white border ${selected ? 'border-violet-600' : 'border-violet-500/30'} min-w-[280px] max-w-[340px]  animate-in zoom-in duration-200 group/node relative transition-all overflow-visible`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-violet-600 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            {/* Premium gradient accent */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-t-2xl" />

            <NodeHeader
                icon={Brain}
                category="Inteligência I.A"
                label={data.label || 'Agente I.A'}
                selected={selected}
                color={{ bg: 'bg-violet-600', text: 'text-white' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 space-y-2">
                {/* Provider + Model */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-violet-500" />
                        <span className="text-[10px] font-bold text-violet-600 uppercase">{provider}</span>
                    </div>
                    <span className="text-[10px] font-mono text-violet-400 bg-violet-50 px-2 py-0.5 rounded">{model}</span>
                </div>

                {/* Dialogue mode indicator */}
                {dialogueMode && (
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] text-green-600 font-semibold">Modo Diálogo</span>
                    </div>
                )}

                {/* System message preview */}
                {data.system_message && (
                    <p className="text-[11px] text-gray-500 line-clamp-2 italic">
                        {data.system_message}
                    </p>
                )}
            </div>

            {/* Multiple output handles: completed + optional timeout */}
            <div className={`grid ${data.response_timeout_enabled ? 'grid-cols-2' : 'grid-cols-1'} gap-4 mt-3 -mx-5 px-6 border-t border-violet-100 pt-3 bg-gray-50/50 rounded-b-2xl pb-3`}>
                <div className="flex flex-col items-center gap-1 relative">
                    <span className="text-[9px] text-emerald-600 font-black tracking-wider">CONCLUÍDO</span>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="completed"
                        className="!w-4 !h-4 !bg-emerald-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
                        
                    />
                </div>
                {data.response_timeout_enabled && (
                    <div className="flex flex-col items-center gap-1 relative">
                        <span className="text-[9px] text-red-500 font-black tracking-wider">TIMEOUT</span>
                        <Handle
                            type="source"
                            position={Position.Bottom}
                            id="timeout"
                            className="!w-4 !h-4 !bg-red-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
                            
                        />
                    </div>
                )}
            </div>
        </div>
    );
});

AiAgentNode.displayName = 'AiAgentNode';
