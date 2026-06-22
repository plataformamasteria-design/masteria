'use client';

import React, { memo, useState, useRef, useCallback } from 'react';
import { Position } from '@xyflow/react';
import { Image as ImageIcon, Mic, FileText, Video, Play, Pause, Volume2, type LucideIcon } from 'lucide-react';
import { BaseNode, type NodeColorKey } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

type MediaType = 'send_image' | 'send_audio' | 'send_document' | 'send_video';

const MEDIA_CONFIG: Record<MediaType, { icon: LucideIcon; label: string; color: NodeColorKey; ext: string }> = {
    send_image:    { icon: ImageIcon, label: 'Enviar Imagem',    color: 'blue',   ext: 'PNG, JPG, GIF' },
    send_audio:    { icon: Mic,       label: 'Enviar Áudio',     color: 'rose',   ext: 'MP3, OGG, M4A'  },
    send_document: { icon: FileText,  label: 'Enviar Documento', color: 'orange', ext: 'PDF, DOCX'      },
    send_video:    { icon: Video,     label: 'Enviar Vídeo',     color: 'violet', ext: 'MP4, MOV'       },
};

// ─── Preview de Imagem ────────────────────────────────────────────────────────
function ImagePreview({ url }: { url: string }) {
    const [error, setError] = useState(false);
    if (error) return (
        <div className="flex items-center justify-center h-28 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <ImageIcon className="w-8 h-8 text-zinc-300" />
        </div>
    );
    return (
        <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/80 h-28">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={url}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={() => setError(true)}
            />
        </div>
    );
}

// ─── Preview de Vídeo ─────────────────────────────────────────────────────────
function VideoPreview({ url }: { url: string }) {
    return (
        <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-28 relative">
            <video
                src={url}
                className="w-full h-full object-cover opacity-80"
                muted
                preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow">
                    <Play className="w-4 h-4 text-zinc-700 dark:text-zinc-200 ml-0.5" />
                </div>
            </div>
        </div>
    );
}

// ─── Preview de Documento ─────────────────────────────────────────────────────
function DocumentPreview({ url, caption }: { url: string; caption?: string }) {
    const filename = url.split('/').pop()?.split('?')[0] || 'documento';
    const ext = filename.split('.').pop()?.toUpperCase() || 'DOC';

    const EXT_COLOR: Record<string, string> = {
        PDF: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
        DOCX: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        DOC: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        XLSX: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
        XLS: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
        PPTX: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    };
    const extClass = EXT_COLOR[ext] || 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800';

    return (
        <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5">
            <div className={`flex items-center justify-center w-9 h-9 rounded-lg border text-[10px] font-black shrink-0 ${extClass}`}>
                {ext}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200 truncate">{filename}</p>
                {caption && <p className="text-[10px] text-zinc-400 dark:text-zinc-400 truncate">{caption}</p>}
            </div>
        </div>
    );
}

// ─── Player de Áudio ─────────────────────────────────────────────────────────
function AudioPlayer({ url }: { url: string }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    const toggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio) return;
        if (playing) { audio.pause(); setPlaying(false); }
        else { audio.play().then(() => setPlaying(true)).catch(() => {}); }
    }, [playing]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const ss = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${ss}`;
    };

    return (
        <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800/50 rounded-xl px-3 py-2.5 nodrag nowheel">
            <audio
                ref={audioRef}
                src={url}
                onTimeUpdate={e => setProgress((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100)}
                onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
                onEnded={() => setPlaying(false)}
            />
            {/* Play/Pause */}
            <button
                onClick={toggle}
                className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-900/300 hover:bg-rose-600 text-zinc-900 dark:text-white flex items-center justify-center shrink-0 transition-colors"
            >
                {playing
                    ? <Pause className="w-3.5 h-3.5" />
                    : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>
            {/* Barra de progresso */}
            <div className="flex-1 space-y-1">
                <div className="h-1.5 bg-rose-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-rose-50 dark:bg-rose-900/300 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between">
                    <span className="text-[9px] text-rose-400 font-medium flex items-center gap-0.5">
                        <Volume2 className="w-2.5 h-2.5" /> Áudio
                    </span>
                    <span className="text-[9px] text-rose-400">
                        {duration > 0 ? formatTime(duration) : '--:--'}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Node Principal ───────────────────────────────────────────────────────────
export const SendMediaNodeV4 = memo(({ data, selected, type }: { data: Record<string, unknown>; selected?: boolean; type: MediaType }) => {
    const cfg = MEDIA_CONFIG[type] ?? MEDIA_CONFIG.send_image;
    const url: string = data.file_url || data.url || '';
    const caption: string = data.caption || '';
    const hasFile = !!url;

    return (
        <BaseNode
            selected={selected}
            accentColor={cfg.color}
            icon={cfg.icon}
            category="Mensagens"
            label={data.label || cfg.label}
            onDelete={data.onDelete}
            onDuplicate={data.onDuplicate}
            onLabelChange={data.onLabelChange}
            footer={
                <div className="relative flex justify-center py-3">
                    <NodeHandle type="source" position={Position.Bottom} accentColor={cfg.color} colIndex={0} colTotal={1} />
                </div>
            }
        >
            <NodeHandle type="target" position={Position.Top} accentColor={cfg.color} />

            {hasFile ? (
                <div className="space-y-2">
                    {/* Preview específico por tipo */}
                    {type === 'send_image'    && <ImagePreview url={url} />}
                    {type === 'send_video'    && <VideoPreview url={url} />}
                    {type === 'send_document' && <DocumentPreview url={url} caption={caption} />}
                    {type === 'send_audio'    && <AudioPlayer url={url} />}

                    {/* Legenda (apenas para imagem e vídeo) */}
                    {caption && (type === 'send_image' || type === 'send_video') && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic line-clamp-2 px-0.5">{caption}</p>
                    )}
                </div>
            ) : (
                /* Estado vazio */
                <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-3 py-4 flex flex-col items-center gap-1.5">
                    <cfg.icon className="w-6 h-6 text-zinc-300" />
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-400 font-medium text-center">
                        Nenhum arquivo.<br />
                        <span className="text-zinc-300">{cfg.ext}</span>
                    </span>
                </div>
            )}
        </BaseNode>
    );
});
SendMediaNodeV4.displayName = 'SendMediaNodeV4';

// Wrappers individuais para compatibilidade com nodeTypes do ReactFlow
export const SendImageNodeV4    = (props: NodePropsV4) => <SendMediaNodeV4 {...props} type="send_image" />;
export const SendAudioNodeV4    = (props: NodePropsV4) => <SendMediaNodeV4 {...props} type="send_audio" />;
export const SendDocumentNodeV4 = (props: NodePropsV4) => <SendMediaNodeV4 {...props} type="send_document" />;
export const SendVideoNodeV4    = (props: NodePropsV4) => <SendMediaNodeV4 {...props} type="send_video" />;
