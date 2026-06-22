'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Clock, CircleHelp, Filter, GitBranch, X } from 'lucide-react';

const icons = {
    wait: Clock,
    condition: CircleHelp,
    filter: Filter,
    branch: GitBranch,
};

const colors = {
    wait: 'text-orange-500',
    condition: 'text-indigo-500',
    filter: 'text-pink-500',
    branch: 'text-cyan-500',
};

const bgColors = {
    wait: 'bg-orange-50 dark:bg-orange-900/30',
    condition: 'bg-indigo-50 dark:bg-indigo-900/30',
    filter: 'bg-pink-50 dark:bg-pink-900/30',
    branch: 'bg-cyan-50 dark:bg-cyan-900/30',
};

const borderColors = {
    wait: 'border-orange-500/30',
    condition: 'border-indigo-500/30',
    filter: 'border-pink-500/30',
    branch: 'border-cyan-500/30',
};

const labels = {
    wait: 'Aguardar',
    condition: 'Condição',
    filter: 'Filtro',
    branch: 'Se / Senão',
};

export const LogicNode = memo(({ data, selected }: any) => {
    const type = data.logicType as keyof typeof icons || 'wait';
    const Icon = icons[type];

    return (
        <div className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-primary' : borderColors[type]} min-w-[240px]  animate-in zoom-in duration-200 group/node relative transition-all`}>
            {/* Botão de Excluir */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    data.onDelete?.();
                }}
                className={`absolute -top-3 -right-3 w-8 h-8 bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-full shadow-xl text-gray-400 dark:text-zinc-400 hover:text-rose-600 dark:text-rose-400 hover:border-rose-200 dark:border-rose-800 flex items-center justify-center transition-all z-[100] ${selected ? 'scale-100 opacity-100' : 'scale-0 opacity-0'} group-hover/node:scale-100 group-hover/node:opacity-100 active:scale-90`}
            >
                <X className="h-4 w-4" />
            </button>

            <Handle
                type="target"
                position={Position.Top}
                style={{ top: -8, width: 20, height: 20, backgroundColor: 'white', border: '3px solid #94a3b8', borderRadius: '50%', zIndex: 50 }}
                className="shadow-md transition-transform hover:scale-125"
            />
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 ${bgColors[type]} rounded-xl shadow-inner`}>
                    <Icon className={`h-5 w-5 ${colors[type]}`} />
                </div>
                <div>
                    <span className={`block text-[10px] font-black ${colors[type]} opacity-70 uppercase tracking-[0.2em]`}>Lógica Inteligente</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">{labels[type]}</span>
                </div>
            </div>
            <div className="text-sm text-gray-500 dark:text-zinc-400 font-semibold bg-gray-50/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80">
                {data.description || 'Configurar regra...'}
            </div>

            {type === 'branch' ? (
                <div className="grid grid-cols-2 gap-4 mt-6 -mx-5 px-6 relative border-t border-gray-100 dark:border-zinc-800/80 pt-5 bg-gray-50/50 rounded-b-2xl">
                    <div className="flex flex-col items-center gap-2 border-r border-slate-200 dark:border-zinc-800">
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black tracking-[0.2em]">SUCESSO</span>
                        <Handle
                            type="source"
                            position={Position.Bottom}
                            id="true"
                            style={{ bottom: -8, width: 22, height: 22, backgroundColor: '#10b981', border: '3px solid white', borderRadius: '50%', zIndex: 50 }}
                            className="shadow-lg shadow-emerald-500/40 transition-transform hover:scale-125"
                        />
                    </div>
                    <div className="flex flex-col items-center gap-2 relative">
                        <span className="text-[9px] text-rose-600 dark:text-rose-400 font-black tracking-[0.2em]">FALHA</span>
                        <Handle
                            type="source"
                            position={Position.Bottom}
                            id="false"
                            style={{ bottom: -8, width: 22, height: 22, backgroundColor: '#f43f5e', border: '3px solid white', borderRadius: '50%', zIndex: 50 }}
                            className="shadow-lg shadow-rose-500/40 transition-transform hover:scale-125"
                        />
                    </div>
                </div>
            ) : (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    style={{ bottom: -8, width: 20, height: 20, backgroundColor: 'white', border: '3px solid #94a3b8', borderRadius: '50%', zIndex: 50 }}
                    className="shadow-md transition-transform hover:scale-125"
                />
            )}
        </div>
    );
});

LogicNode.displayName = 'LogicNode';
