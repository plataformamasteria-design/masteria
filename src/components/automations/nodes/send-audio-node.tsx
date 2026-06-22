'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Mic } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const SendAudioNode = memo(({ data, selected }: any) => {
    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-green-500' : 'border-green-500/20'} min-w-[280px] max-w-[320px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-green-50 dark:bg-green-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={Mic}
                category="Mensagens"
                label={data.label || 'Enviar Áudio'}
                selected={selected}
                color={{ bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-gray-50 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80">
                {data.file_url ? (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/300/20 flex items-center justify-center shrink-0">
                            <Mic className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="h-1.5 bg-green-200 rounded-full overflow-visible">
                                <div className="w-2/3 h-full bg-green-50 dark:bg-green-900/300 rounded-full" />
                            </div>
                            <p className="text-[10px] text-gray-400 dark:text-zinc-400 mt-1 truncate">{data.file_url}</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-2">
                        <span className="text-[11px] text-green-400 font-semibold">Sem arquivo de áudio</span>
                    </div>
                )}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-green-50 dark:bg-green-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

SendAudioNode.displayName = 'SendAudioNode';
