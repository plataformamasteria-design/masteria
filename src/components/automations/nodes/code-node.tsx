'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Code2 } from 'lucide-react';
import { NodeHeader } from './NodeHeader';

export const CodeNode = memo(({ data, selected }: any) => {
    const language = data.language || 'javascript';

    return (
        <div
            className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-gray-700' : 'border-gray-300/50'} min-w-[280px] max-w-[340px]  animate-in zoom-in duration-200 group/node relative transition-all`}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-gray-700 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-top-2 z-50 transition-transform hover:scale-125"
            />

            <NodeHeader
                icon={Code2}
                category="Avançado"
                label={data.label || 'Código'}
                selected={selected}
                color={{ bg: 'bg-gray-800', text: 'text-gray-100' }}
                onDelete={data.onDelete}
                onDuplicate={data.onDuplicate}
                onLabelChange={data.onLabelChange}
            />

            <div className="bg-gray-900 p-3 rounded-xl border border-gray-700 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${language === 'javascript' ? 'bg-yellow-400/20 text-yellow-400' : 'bg-blue-400/20 text-blue-400'}`}>
                        {language === 'javascript' ? 'JS' : 'PY'}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-zinc-400 font-mono">{data.code ? `${data.code.split('\n').length} linhas` : '0 linhas'}</span>
                </div>
                <pre
                    className="text-[10px] text-green-400 font-mono leading-relaxed whitespace-pre-wrap line-clamp-4 nopan"
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    {data.code || '// seu código aqui...'}
                </pre>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-gray-700 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

CodeNode.displayName = 'CodeNode';
