'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ArrowRightLeft } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const CrmMoveNode = memo(({ data, selected }: any) => {
    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white border ${selected ? 'border-cyan-500' : 'border-cyan-500/20'} min-w-[280px] max-w-[320px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-cyan-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={ArrowRightLeft}
                category="CRM & Ações"
                label={data.label || 'Mover no CRM'}
                selected={selected}
                color={{ bg: 'bg-cyan-500/10', text: 'text-cyan-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 space-y-2">
                {data.funnel_id ? (
                    <>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider">Funil:</span>
                            <span className="text-xs text-gray-500 truncate">{data.funnel_name || data.funnel_id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider">Etapa:</span>
                            <span className="text-xs text-gray-500 truncate">{data.stage_name || data.stage_id || '—'}</span>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-1">
                        <span className="text-[11px] text-cyan-400 font-semibold">Selecionar funil e etapa...</span>
                    </div>
                )}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-cyan-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

CrmMoveNode.displayName = 'CrmMoveNode';
