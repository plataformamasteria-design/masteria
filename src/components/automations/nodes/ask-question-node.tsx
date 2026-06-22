'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { HelpCircle, Plus, X as XIcon } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const AskQuestionNode = memo(({ data, selected }: any) => {
    const options: string[] = data.options || [];

    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-emerald-500' : 'border-emerald-500/20'} min-w-[280px] max-w-[320px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-emerald-50 dark:bg-emerald-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={HelpCircle}
                category="Interação"
                label={data.label || 'Fazer Pergunta'}
                selected={selected}
                color={{ bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            {/* Question text */}
            <div className="bg-gray-50 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80 mb-3">
                <p className="text-sm text-gray-700 dark:text-zinc-200 line-clamp-2">
                    {data.question || 'Digite sua pergunta...'}
                </p>
            </div>

            {/* Answer options */}
            {options.length > 0 && (
                <div className="space-y-1.5">
                    {((Array.isArray(options) ? options : []) || []).map((opt: string, i: number) => (
                        <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-100 dark:border-emerald-800/50"
                        >
                            <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-900/300/20 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{i + 1}</span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-zinc-400 truncate">{opt}</span>
                        </div>
                    ))}
                </div>
            )}

            {options.length === 0 && (
                <div className="text-center py-2 bg-emerald-50/50 rounded-lg border border-dashed border-emerald-200 dark:border-emerald-800">
                    <span className="text-[11px] text-emerald-400 font-semibold">Sem opções configuradas</span>
                </div>
            )}

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-emerald-50 dark:bg-emerald-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

AskQuestionNode.displayName = 'AskQuestionNode';
