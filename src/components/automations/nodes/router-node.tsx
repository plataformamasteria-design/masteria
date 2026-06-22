'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Signpost } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

interface RouterRule {
    field: string;
    operator: string;
    value: string;
    outputName?: string;
}

const routeColors = [
    'bg-blue-50 dark:bg-blue-900/300', 'bg-emerald-50 dark:bg-emerald-900/300', 'bg-amber-50 dark:bg-amber-900/300', 'bg-pink-50 dark:bg-pink-900/300',
    'bg-purple-50 dark:bg-purple-900/300', 'bg-red-50 dark:bg-red-900/300', 'bg-teal-50 dark:bg-teal-900/300', 'bg-orange-50 dark:bg-orange-900/300',
];

const routeTextColors = [
    'text-blue-600 dark:text-blue-400', 'text-emerald-600 dark:text-emerald-400', 'text-amber-600 dark:text-amber-400', 'text-pink-600 dark:text-pink-400',
    'text-purple-600 dark:text-purple-400', 'text-red-600 dark:text-red-400', 'text-teal-600 dark:text-teal-400', 'text-orange-600 dark:text-orange-400',
];

export const RouterNode = memo(({ data, selected }: any) => {
    const rules: RouterRule[] = data.rules || [];

    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-violet-500' : 'border-violet-500/20'} min-w-[280px] max-w-[360px]  animate-in zoom-in duration-200 group/node relative transition-all overflow-visible`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-violet-50 dark:bg-violet-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={Signpost}
                category="Lógica"
                label={data.label || 'Caminho'}
                selected={selected}
                color={{ bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            {/* Rules */}
            <div className="bg-gray-50 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80 space-y-1.5 mb-3">
                {rules.length > 0 ? (
                    ((Array.isArray(rules) ? rules : []) || []).map((rule, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                            <div className={`w-2 h-2 rounded-full ${routeColors[i % routeColors.length]} shrink-0`} />
                            <span className="font-semibold text-gray-500 dark:text-zinc-400 truncate">
                                {rule.outputName || `Rota ${i + 1}`}
                            </span>
                        </div>
                    ))
                ) : (
                    <span className="text-[11px] text-gray-400 dark:text-zinc-400">Sem rotas configuradas</span>
                )}
            </div>

            {/* Dynamic route handles + fallback */}
            <div className={`grid gap-3 mt-3 -mx-5 px-5 relative border-t border-gray-100 dark:border-zinc-800/80 pt-4 bg-gray-50/50 rounded-b-2xl pb-4`}
                style={{ gridTemplateColumns: `repeat(${Math.min(rules.length + 1, 5)}, 1fr)` }}
            >
                {((Array.isArray(rules) ? rules : []) || []).map((rule, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 relative">
                        <span className={`text-[8px] font-black tracking-wider ${routeTextColors[i % routeTextColors.length]} truncate max-w-[60px]`}>
                            {(rule.outputName || `R${i + 1}`).toUpperCase()}
                        </span>
                        <Handle
                            type="source"
                            position={Position.Bottom}
                            id={`route-${i}`}
                            className={`!w-4 !h-4 ${routeColors[i % routeColors.length]} !border-2 !border-white dark:border-zinc-900 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125`}
                            
                        />
                    </div>
                ))}
                <div className="flex flex-col items-center gap-1 relative">
                    <span className="text-[8px] font-black tracking-wider text-gray-400 dark:text-zinc-400">PADRÃO</span>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="fallback"
                        className="!w-4 !h-4 !bg-slate-400 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
                        
                    />
                </div>
            </div>
        </div>
    );
});

RouterNode.displayName = 'RouterNode';
