'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Signpost } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

const intentColors = [
    'bg-indigo-50 dark:bg-indigo-900/300', 'bg-purple-50 dark:bg-purple-900/300', 'bg-pink-50 dark:bg-pink-900/300', 'bg-blue-50 dark:bg-blue-900/300',
    'bg-emerald-50 dark:bg-emerald-900/300', 'bg-amber-50 dark:bg-amber-900/300',
];

const intentTextColors = [
    'text-indigo-600 dark:text-indigo-400', 'text-purple-600 dark:text-purple-400', 'text-pink-600 dark:text-pink-400', 'text-blue-600 dark:text-blue-400',
    'text-emerald-600 dark:text-emerald-400', 'text-amber-600 dark:text-amber-400',
];

export const IntentRouterNode = memo(({ data, selected }: any) => {
    const intents: string[] = data.intents || [];

    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-purple-600' : 'border-purple-500/30'} min-w-[280px] max-w-[360px] ring-1 ring-purple-500/10 animate-in zoom-in duration-200 group/node relative transition-all overflow-visible`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-purple-600 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 rounded-t-2xl" />

            <NodeHeader
                icon={Signpost}
                category="Inteligência I.A"
                label={data.label || 'Classificador de Intenções'}
                selected={selected}
                color={{ bg: 'bg-purple-600', text: 'text-zinc-900 dark:text-white' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            {/* Intents list */}
            <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100 dark:border-purple-800/50 shadow-inner space-y-1.5 mb-3">
                {intents.length > 0 ? (
                    ((Array.isArray(intents) ? intents : []) || []).map((intent, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                            <div className={`w-2.5 h-2.5 rounded-full ${intentColors[i % intentColors.length]} shrink-0`} />
                            <span className="font-bold text-gray-700 dark:text-zinc-200">{intent}</span>
                        </div>
                    ))
                ) : (
                    <span className="text-[11px] text-purple-400">Configurar intenções...</span>
                )}
            </div>

            {/* Dynamic intent handles + fallback */}
            <div
                className="grid gap-2 mt-3 -mx-5 px-5 border-t border-purple-100 dark:border-purple-800/50 pt-3 bg-purple-50/30 rounded-b-2xl pb-3"
                style={{ gridTemplateColumns: `repeat(${Math.min(intents.length + 1, 6)}, 1fr)` }}
            >
                {((Array.isArray(intents) ? intents : []) || []).map((intent, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 relative">
                        <span className={`text-[7px] font-black tracking-wider ${intentTextColors[i % intentTextColors.length]} truncate max-w-[50px]`}>
                            {intent.toUpperCase().slice(0, 6)}
                        </span>
                        <Handle
                            type="source"
                            position={Position.Bottom}
                            id={intent}
                            className={`!w-4 !h-4 ${intentColors[i % intentColors.length]} !border-2 !border-white dark:border-zinc-900 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125`}
                            
                        />
                    </div>
                ))}
                <div className="flex flex-col items-center gap-1 relative">
                    <span className="text-[7px] font-black tracking-wider text-gray-400 dark:text-zinc-400">OUTRO</span>
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

IntentRouterNode.displayName = 'IntentRouterNode';
