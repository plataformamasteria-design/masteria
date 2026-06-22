'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const ConditionNode = memo(({ data, selected }: any) => {
    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-amber-500' : 'border-amber-500/20'} min-w-[280px] max-w-[320px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-amber-50 dark:bg-amber-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={GitBranch}
                category="Lógica"
                label={data.label || 'Condição'}
                selected={selected}
                color={{ bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-gray-50 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80 text-sm text-gray-500 dark:text-zinc-400">
                {data.condition_type ? (
                    <div className="space-y-1">
                        <span className="text-[10px] font-bold text-amber-500 uppercase">
                            {data.condition_type === 'has_tag' && 'Tem Tag'}
                            {data.condition_type === 'is_assigned' && 'Está Atribuído'}
                            {data.condition_type === 'response_equals' && 'Resposta ='}
                            {data.condition_type === 'response_contains' && 'Resposta Contém'}
                            {data.condition_type === 'response_in' && 'Resposta Em'}
                        </span>
                        {data.condition_value && (
                            <p className="text-xs font-mono bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded border border-amber-100 dark:border-amber-800/50 truncate">
                                {data.condition_value}
                            </p>
                        )}
                    </div>
                ) : (
                    <span className="text-gray-400 dark:text-zinc-400">Configurar condição...</span>
                )}
            </div>

            {/* Bifurcation: Yes / No handles */}
            <div className="grid grid-cols-2 gap-4 mt-4 -mx-5 px-6 relative border-t border-gray-100 dark:border-zinc-800/80 pt-4 bg-gray-50/50 rounded-b-2xl pb-4">
                <div className="flex flex-col items-center gap-1.5 relative">
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black tracking-[0.2em]">SIM</span>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="yes"
                        className="!w-4 !h-4 !bg-emerald-50 dark:bg-emerald-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg shadow-emerald-500/30 !-bottom-2 z-50 transition-transform hover:scale-125"
                        
                    />
                </div>
                <div className="flex flex-col items-center gap-1.5 relative">
                    <span className="text-[9px] text-red-500 font-black tracking-[0.2em]">NÃO</span>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="no"
                        className="!w-4 !h-4 !bg-red-50 dark:bg-red-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg shadow-red-500/30 !-bottom-2 z-50 transition-transform hover:scale-125"
                        
                    />
                </div>
            </div>
        </div>
    );
});

ConditionNode.displayName = 'ConditionNode';
