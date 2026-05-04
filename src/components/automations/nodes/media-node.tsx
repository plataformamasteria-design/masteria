'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Image, FileText, Music, Film, X } from 'lucide-react';

const icons = {
    image: Image,
    audio: Music,
    video: Film,
    document: FileText,
};

const colors = {
    image: 'text-emerald-500',
    audio: 'text-amber-500',
    video: 'text-rose-500',
    document: 'text-sky-500',
};

const bgColors = {
    image: 'bg-emerald-500/10',
    audio: 'bg-amber-500/10',
    video: 'bg-rose-500/10',
    document: 'bg-sky-500/10',
};

const borderColors = {
    image: 'border-emerald-500/30',
    audio: 'border-amber-500/30',
    video: 'border-rose-500/30',
    document: 'border-sky-500/30',
};

const labels = {
    image: 'Imagem',
    audio: 'Áudio',
    video: 'Vídeo',
    document: 'Documento',
};

export const MediaNode = memo(({ data, selected }: any) => {
    const type = data.mediaType as keyof typeof icons || 'image';
    const Icon = icons[type];

    return (
        <div className={`px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white border ${selected ? 'border-primary' : borderColors[type]} min-w-[280px]  animate-in zoom-in duration-200 group/node relative transition-all`}>
            {/* Botão de Excluir */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    data.onDelete?.();
                }}
                className={`absolute -top-3 -right-3 w-8 h-8 bg-white border-2 border-slate-200 rounded-full shadow-xl text-gray-400 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center transition-all z-[100] ${selected ? 'scale-100 opacity-100' : 'scale-0 opacity-0'} group-hover/node:scale-100 group-hover/node:opacity-100 active:scale-90`}
            >
                <X className="h-4 w-4" />
            </button>

            <Handle
                type="target"
                position={Position.Top}
                style={{ borderColor: type === 'image' ? '#10b981' : type === 'audio' ? '#f59e0b' : type === 'video' ? '#f43f5e' : '#0ea5e9' }}
                className="!w-5 !h-5 !bg-white !border-[3px] shadow-md !-top-[10px] !left-1/2 !-translate-x-1/2 z-50 transition-transform hover:scale-125"
            />
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 ${bgColors[type]} rounded-xl shadow-inner`}>
                    <Icon className={`h-5 w-5 ${colors[type]}`} />
                </div>
                <div>
                    <span className={`block text-[10px] font-black ${colors[type]} opacity-70 uppercase tracking-[0.2em]`}>Arquivo Digital</span>
                    <span className="text-sm font-bold text-slate-900 tracking-tight">{labels[type]}</span>
                </div>
            </div>

            <div className="space-y-3">
                <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 overflow-visible">
                    <span className={`w-1.5 h-1.5 rounded-full ${colors[type].replace('text-', 'bg-')}`} />
                    <span className="truncate">{data.url ? data.url.split('/').pop() : 'Aguardando upload...'}</span>
                </div>

                {data.url ? (
                    <div className="relative group/media overflow-visible rounded-xl border border-slate-200 aspect-video bg-slate-50">
                        {type === 'image' ? (
                            <img src={data.url} alt="Preview" className="w-full h-full object-cover transition-transform group-hover/media:scale-110 duration-500" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                <Icon className={`h-8 w-8 ${colors[type]} opacity-20`} />
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Mídia Pronta</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/5 transition-colors" />
                    </div>
                ) : (
                    <div className="w-full h-24 border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center bg-slate-50/50">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sem Arquivo</span>
                    </div>
                )}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                style={{ borderColor: type === 'image' ? '#10b981' : type === 'audio' ? '#f59e0b' : type === 'video' ? '#f43f5e' : '#0ea5e9' }}
                className="!w-5 !h-5 !bg-white !border-[3px] shadow-md !-bottom-[10px] !left-1/2 !-translate-x-1/2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

MediaNode.displayName = 'MediaNode';
