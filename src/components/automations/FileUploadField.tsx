'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, Mic, FileText, Video, CheckCircle2 } from 'lucide-react';

interface FileUploadFieldProps {
    value: string;
    onChange: (url: string) => void;
    accept: string;
    mediaType: 'image' | 'audio' | 'video' | 'document';
    label?: string;
}

const typeConfig = {
    image: { icon: ImageIcon, color: 'pink', extensions: 'PNG, JPG, WebP' },
    audio: { icon: Mic, color: 'green', extensions: 'MP3, OGG, WAV' },
    video: { icon: Video, color: 'red', extensions: 'MP4, MOV' },
    document: { icon: FileText, color: 'orange', extensions: 'PDF, DOCX, XLSX' },
};

export function FileUploadField({ value, onChange, accept, mediaType, label }: FileUploadFieldProps) {
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState('');
    const [fileName, setFileName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const config = typeConfig[mediaType] || typeConfig.document;
    const Icon = config.icon;

    const handleUpload = useCallback(async (file: File) => {
        setError('');
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/v1/media/upload-url', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Upload falhou' }));
                throw new Error(err.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            const url = data.s3Url || data.url || '';
            setFileName(file.name);
            onChange(url);
        } catch (err: any) {
            setError(err.message || 'Erro ao fazer upload');
            console.error('[FileUpload]', err);
        } finally {
            setUploading(false);
        }
    }, [onChange]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
    }, [handleUpload]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
        // Reset input so the same file can be re-selected
        if (inputRef.current) inputRef.current.value = '';
    }, [handleUpload]);

    const handleRemove = useCallback(() => {
        onChange('');
        setFileName('');
        setError('');
    }, [onChange]);

    // Has a file uploaded
    if (value) {
        return (
            <div className="space-y-2">
                {label && <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">{label}</label>}
                <div className={`relative rounded-xl border-2 border-${config.color}-200 bg-${config.color}-50/30 p-3 transition-all`}>
                    {/* Preview area */}
                    {mediaType === 'image' ? (
                        <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white">
                            <img
                                src={value}
                                alt="Preview"
                                className="w-full h-32 object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg bg-${config.color}-500/10 flex items-center justify-center shrink-0`}>
                                <Icon className={`h-5 w-5 text-${config.color}-500`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200 truncate">
                                    {fileName || value.split('/').pop() || 'Arquivo carregado'}
                                </p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    <span className="text-[10px] text-green-600 font-medium">Upload completo</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Remove button */}
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center justify-center text-gray-400 dark:text-zinc-400 hover:text-red-500 hover:border-red-200 transition-all"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* URL display */}
                <div className="text-[10px] text-gray-400 dark:text-zinc-400 font-mono truncate px-1">{value}</div>
            </div>
        );
    }

    // Upload area (no file yet)
    return (
        <div className="space-y-2">
            {label && <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">{label}</label>}

            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !uploading && inputRef.current?.click()}
                className={`
                    relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200
                    ${dragOver
                        ? `border-${config.color}-400 bg-${config.color}-50/50 scale-[1.01]`
                        : `border-gray-200 dark:border-zinc-800 bg-gray-50/50 hover:border-${config.color}-300 hover:bg-${config.color}-50/20`
                    }
                    ${uploading ? 'pointer-events-none opacity-70' : ''}
                `}
            >
                <div className="flex flex-col items-center justify-center py-6 px-4">
                    {uploading ? (
                        <>
                            <Loader2 className={`h-8 w-8 text-${config.color}-400 animate-spin mb-2`} />
                            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Enviando arquivo...</span>
                        </>
                    ) : (
                        <>
                            <div className={`w-12 h-12 rounded-xl bg-${config.color}-500/10 flex items-center justify-center mb-3`}>
                                <Upload className={`h-5 w-5 text-${config.color}-500`} />
                            </div>
                            <span className="text-sm font-semibold text-gray-600 dark:text-zinc-300">
                                Arraste ou clique para enviar
                            </span>
                            <span className="text-[11px] text-gray-400 dark:text-zinc-400 mt-1">
                                Formatos: {config.extensions}
                            </span>
                        </>
                    )}
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {error && (
                <p className="text-xs text-red-500 font-medium px-1">{error}</p>
            )}
        </div>
    );
}
