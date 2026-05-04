'use client';

import React, { useState } from 'react';
import {
    ArrowLeft, Play, Sparkles, LayoutGrid, MoreHorizontal,
    History, Loader2, Radio, Check, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FlowToolbarProps {
    flowName: string;
    onFlowNameChange: (name: string) => void;
    isSaving: boolean;
    onSave: () => void;
    onBack: () => void;
    onAutoLayout: () => void;
    onTest: () => void;
    onAIGenerate: () => void;
    onHistory: () => void;
    isTestingFlow: boolean;
    flowTestProgress?: number;
    webhookListenState?: 'idle' | 'listening' | 'received';
}

export function FlowToolbar({
    flowName,
    onFlowNameChange,
    isSaving,
    onSave,
    onBack,
    onAutoLayout,
    onTest,
    onAIGenerate,
    onHistory,
    isTestingFlow,
    flowTestProgress = 0,
    webhookListenState = 'idle',
}: FlowToolbarProps) {
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState(flowName);

    const saveName = () => {
        const trimmed = nameValue.trim();
        if (trimmed) onFlowNameChange(trimmed);
        setEditingName(false);
    };

    const isListening = webhookListenState === 'listening';

    return (
        <div className="relative flex items-center gap-2 px-3 py-2 bg-white border-b border-zinc-200 shadow-[0_1px_4px_rgba(0,0,0,0.05)] z-10 shrink-0">
            {/* Voltar */}
            <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 text-xs font-medium transition-colors px-2 py-1.5 rounded-lg hover:bg-zinc-50"
            >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
            </button>

            <div className="w-px h-4 bg-zinc-200" />

            {/* Nome do fluxo */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {editingName ? (
                    <input
                        autoFocus
                        value={nameValue}
                        onChange={e => setNameValue(e.target.value)}
                        onBlur={saveName}
                        onKeyDown={e => {
                            if (e.key === 'Enter') saveName();
                            if (e.key === 'Escape') setEditingName(false);
                        }}
                        className="text-sm font-semibold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg px-2 py-1 outline-none focus:border-indigo-400 max-w-[280px] nodrag"
                    />
                ) : (
                    <button
                        onClick={() => { setNameValue(flowName); setEditingName(true); }}
                        className="flex items-center gap-1.5 group px-1 py-1 rounded-lg hover:bg-zinc-50 transition-colors"
                        title="Clique para renomear"
                    >
                        <span className="text-sm font-semibold text-zinc-800 truncate max-w-[240px]">{flowName}</span>
                        <Pencil className="w-3 h-3 text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0" />
                    </button>
                )}
            </div>

            {/* Ações secundárias */}
            <div className="flex items-center gap-1">
                <button
                    onClick={onAutoLayout}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors"
                    title="Organizar layout automaticamente"
                >
                    <LayoutGrid className="w-4 h-4" />
                </button>

                <button
                    onClick={onHistory}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors"
                    title="Histórico de execuções"
                >
                    <History className="w-4 h-4" />
                </button>

                <button
                    onClick={onAIGenerate}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors text-xs font-semibold"
                    title="Gerar fluxo com IA"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Gerar com IA</span>
                </button>
            </div>

            <div className="w-px h-4 bg-zinc-200" />

            {/* Testar */}
            <button
                onClick={onTest}
                disabled={isTestingFlow || isListening}
                className={[
                    'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors',
                    isListening
                        ? 'bg-emerald-500 text-white animate-pulse'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                ].join(' ')}
                title="Testar fluxo"
            >
                {isListening ? (
                    <><Radio className="w-3.5 h-3.5" /> Escutando...</>
                ) : isTestingFlow ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {flowTestProgress}%</>
                ) : (
                    <><Play className="w-3.5 h-3.5" /> Testar</>
                )}
            </button>

            {/* Publicar */}
            <button
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-60"
            >
                {isSaving ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</>
                ) : (
                    <>Publicar</>
                )}
            </button>
        </div>
    );
}
