'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Image as ImageIcon } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const SendImageNode = memo(({ data, selected }: any) => {
    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-pink-500' : 'border-pink-500/20'} min-w-[280px] max-w-[320px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-pink-50 dark:bg-pink-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={ImageIcon}
                category="Mensagens"
                label={data.label || 'Enviar Imagem'}
                selected={selected}
                color={{ bg: 'bg-pink-50 dark:bg-pink-900/30', text: 'text-pink-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-gray-50 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80 space-y-2">
                {data.file_url ? (
                    <div className="w-full h-20 rounded-lg bg-pink-50 dark:bg-pink-900/30 border border-pink-100 dark:border-pink-800/50 flex items-center justify-center overflow-visible">
                        <img src={data.file_url} alt="Preview" className="max-h-full max-w-full object-cover rounded-lg" />
                    </div>
                ) : (
                    <div className="w-full h-16 rounded-lg bg-pink-50/50 border border-dashed border-pink-200 dark:border-pink-800 flex items-center justify-center">
                        <span className="text-[11px] text-pink-400 font-semibold">Nenhuma imagem</span>
                    </div>
                )}
                {data.caption && (
                    <p className="text-[12px] text-gray-500 dark:text-zinc-400 italic line-clamp-2">{data.caption}</p>
                )}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-pink-50 dark:bg-pink-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

SendImageNode.displayName = 'SendImageNode';
