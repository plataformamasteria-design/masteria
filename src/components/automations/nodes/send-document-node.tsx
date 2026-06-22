'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileText } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const SendDocumentNode = memo(({ data, selected }: any) => {
    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-orange-500' : 'border-orange-500/20'} min-w-[280px] max-w-[320px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-orange-50 dark:bg-orange-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={FileText}
                category="Mensagens"
                label={data.label || 'Enviar Documento'}
                selected={selected}
                color={{ bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-500' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-gray-50 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80">
                {data.file_url ? (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-12 rounded-lg bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200 truncate">{data.file_name || 'documento.pdf'}</p>
                            <p className="text-[10px] text-gray-400 dark:text-zinc-400 truncate">{data.file_url}</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-2">
                        <span className="text-[11px] text-orange-400 font-semibold">Nenhum documento</span>
                    </div>
                )}
                {data.caption && (
                    <p className="text-[12px] text-gray-500 dark:text-zinc-400 italic mt-2 line-clamp-2">{data.caption}</p>
                )}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-orange-50 dark:bg-orange-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

SendDocumentNode.displayName = 'SendDocumentNode';
