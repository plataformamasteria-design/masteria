'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Filter } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

interface FilterCondition {
    field: string;
    operator: string;
    value: string;
}

export const FilterNode = memo(({ data, selected }: any) => {
    const conditions: FilterCondition[] = data.conditions || [];
    const matchMode = data.match_mode || 'all';

    const operatorLabel: Record<string, string> = {
        equals: '=',
        not_equals: '≠',
        contains: '∋',
        not_contains: '∌',
        starts_with: 'inicia com',
        ends_with: 'termina com',
        is_empty: 'vazio',
        is_not_empty: 'não vazio',
        greater_than: '>',
        less_than: '<',
        regex: 'regex',
    };

    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white border ${selected ? 'border-indigo-500' : 'border-indigo-500/20'} min-w-[280px] max-w-[340px]  animate-in zoom-in duration-200 group/node relative transition-all overflow-visible`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-indigo-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={Filter}
                category="Lógica"
                label={data.label || 'Filtro'}
                selected={selected}
                color={{ bg: 'bg-indigo-500/10', text: 'text-indigo-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            {/* Match mode badge */}
            <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${matchMode === 'all' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                    {matchMode === 'all' ? 'TODAS' : 'QUALQUER'}
                </span>
                <span className="text-[10px] text-gray-400">condições devem passar</span>
            </div>

            {/* Conditions */}
            <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 space-y-1.5">
                {conditions.length > 0 ? (
                    ((Array.isArray(conditions) ? conditions : []) || []).map((cond, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{cond.field || '?'}</span>
                            <span className="text-gray-400 font-bold">{operatorLabel[cond.operator] || cond.operator}</span>
                            <span className="text-gray-500 truncate max-w-[80px]">{cond.value || '...'}</span>
                        </div>
                    ))
                ) : (
                    <span className="text-[11px] text-gray-400">Sem condições configuradas</span>
                )}
            </div>

            {/* Pass / Block handles */}
            <div className="grid grid-cols-2 gap-4 mt-4 -mx-5 px-6 relative border-t border-gray-100 pt-4 bg-gray-50/50 rounded-b-2xl pb-4">
                <div className="flex flex-col items-center gap-1.5 relative">
                    <span className="text-[9px] text-emerald-600 font-black tracking-[0.2em]">PASSOU</span>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="pass"
                        className="!w-4 !h-4 !bg-emerald-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg shadow-emerald-500/30 !-bottom-2 z-50 transition-transform hover:scale-125"
                        
                    />
                </div>
                <div className="flex flex-col items-center gap-1.5 relative">
                    <span className="text-[9px] text-red-500 font-black tracking-[0.2em]">BLOQUEADO</span>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="block"
                        className="!w-4 !h-4 !bg-red-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg shadow-red-500/30 !-bottom-2 z-50 transition-transform hover:scale-125"
                        
                    />
                </div>
            </div>
        </div>
    );
});

FilterNode.displayName = 'FilterNode';
