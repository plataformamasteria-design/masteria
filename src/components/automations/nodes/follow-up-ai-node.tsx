'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MessageSquareHeart } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const FollowUpAiNode = memo(({ data, selected }: any) => {
    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white border ${selected ? 'border-orange-500' : 'border-orange-500/30'} min-w-[280px] max-w-[320px] ring-1 ring-orange-500/10 animate-in zoom-in duration-200 group/node relative transition-all overflow-visible`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-orange-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-t-2xl" />

            <NodeHeader
                icon={MessageSquareHeart}
                category="Inteligência I.A"
                label={data.label || 'Follow Up I.A'}
                selected={selected}
                color={{ bg: 'bg-orange-500', text: 'text-white' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 shadow-inner space-y-2">
                {data.followup_prompt && (
                    <p className="text-[11px] text-gray-500 line-clamp-2 italic">{data.followup_prompt}</p>
                )}
                {data.response_timeout_minutes && (
                    <div className="text-[10px] text-orange-500 font-semibold">
                        Timeout: {data.response_timeout_minutes} min
                    </div>
                )}
                {!data.followup_prompt && !data.response_timeout_minutes && (
                    <span className="text-[11px] text-orange-400">Configurar follow-up...</span>
                )}
            </div>

            {/* Responded / Not Responded handles */}
            <div className="grid grid-cols-2 gap-4 mt-3 -mx-5 px-6 border-t border-orange-100 pt-3 bg-orange-50/30 rounded-b-2xl pb-3">
                <div className="flex flex-col items-center gap-1 relative">
                    <span className="text-[9px] text-emerald-600 font-black tracking-wider">RESPONDEU</span>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="responded"
                        className="!w-4 !h-4 !bg-emerald-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
                        
                    />
                </div>
                <div className="flex flex-col items-center gap-1 relative">
                    <span className="text-[9px] text-red-500 font-black tracking-wider">NÃO RESP.</span>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="not_responded"
                        className="!w-4 !h-4 !bg-red-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
                        
                    />
                </div>
            </div>
        </div>
    );
});

FollowUpAiNode.displayName = 'FollowUpAiNode';
