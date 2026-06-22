'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Brain, Sparkles, WandSparkles, Mic, X } from 'lucide-react';

const aiIcons = {
    chat: Brain,
    audio: Mic,
    persona: WandSparkles,
    completion: Sparkles,
};

const aiLabels = {
    chat: 'IA Chat (Brain)',
    audio: 'IA Audio (ElevenLabs)',
    persona: 'Trocar Persona',
    completion: 'IA Texto Dinâmico',
};

export const AINode = memo(({ data, selected }: any) => {
    const type = data.aiType as keyof typeof aiIcons || 'chat';
    const Icon = aiIcons[type] || Brain;
    const isDialogue = !!data.dialogue_mode;

    return (
        <div className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white dark:bg-zinc-900 border ${selected ? 'border-indigo-600' : 'border-indigo-500/20'} min-w-[260px] animate-in zoom-in duration-200 group/node relative transition-all`}>
            {/* Botão de Excluir */}
            <button
                onClick={(e) => { e.stopPropagation(); data.onDelete?.(); }}
                className={`absolute -top-3 -right-3 w-8 h-8 bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-full shadow-xl text-gray-400 dark:text-zinc-400 hover:text-rose-600 dark:text-rose-400 hover:border-rose-200 dark:border-rose-800 flex items-center justify-center transition-all z-[100] ${selected ? 'scale-100 opacity-100' : 'scale-0 opacity-0'} group-hover/node:scale-100 group-hover/node:opacity-100 active:scale-90`}
            >
                <X className="h-4 w-4" />
            </button>

            <Handle
                type="target"
                position={Position.Top}
                className="!w-4 !h-4 !bg-white dark:bg-zinc-900 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] shadow-md !-top-[10px] !left-1/2 !-translate-x-1/2 z-50 transition-transform hover:scale-125"
            />

            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl shadow-inner">
                    <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <span className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 opacity-70 uppercase tracking-[0.2em]">Agente de IA</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">{data.label || aiLabels[type] || 'AI Agent'}</span>
                </div>
            </div>

            {/* Config summary */}
            <div className="text-sm font-semibold text-gray-700 dark:text-zinc-200 bg-gray-50/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase">✨ {data.provider?.toUpperCase() || 'GEMINI'}</span>
                    <span className="text-[10px] text-gray-400 dark:text-zinc-400 font-mono">{data.model || 'gemini-2.5-flash'}</span>
                </div>
                {isDialogue && (
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-50 dark:bg-violet-900/300 animate-pulse" />
                        <span className="text-[10px] text-violet-600 dark:text-violet-400 font-bold">Modo Diálogo</span>
                        {data.max_turns && (
                            <span className="text-[10px] text-gray-400 dark:text-zinc-400 ml-auto">{data.max_turns} turnos</span>
                        )}
                    </div>
                )}
                {data.include_history && (
                    <div className="text-[10px] text-gray-400 dark:text-zinc-400">
                        📜 Histórico: {data.history_count || 10} msgs
                    </div>
                )}
            </div>

            {/* Saídas dinâmicas */}
            {isDialogue ? (
                <>
                    <div className="flex justify-between mt-3 text-[9px] font-bold tracking-wider px-1">
                        <span className="text-emerald-600 dark:text-emerald-400">✓ CONCLUÍDO</span>
                        <span className="text-amber-600 dark:text-amber-400">⚠ MAX TURNOS</span>
                    </div>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="completed"
                        className="!w-4 !h-4 !bg-white dark:bg-zinc-900 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] shadow-md !-bottom-[10px] !left-[30%] z-50 transition-transform hover:scale-125"
                    />
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="max_turns"
                        className="!w-4 !h-4 !bg-white dark:bg-zinc-900 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] shadow-md !-bottom-[10px] !left-[70%] z-50 transition-transform hover:scale-125"
                    />
                </>
            ) : (
                <>
                    <div className="flex justify-center mt-3 text-[9px] font-bold tracking-wider">
                        <span className="text-emerald-600 dark:text-emerald-400">CONCLUÍDO</span>
                    </div>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="completed"
                        className="!w-4 !h-4 !bg-white dark:bg-zinc-900 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] shadow-md !-bottom-[10px] !left-1/2 !-translate-x-1/2 z-50 transition-transform hover:scale-125"
                    />
                </>
            )}
        </div>
    );
});

AINode.displayName = 'AINode';
