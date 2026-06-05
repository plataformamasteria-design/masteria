'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Trash2, Image as ImageIcon, FileText, Mic, Video, Loader2, Sparkles, X, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AgentLibraryFile {
    id: string;
    file_name: string;
    file_url: string;
    file_type: 'image' | 'document' | 'audio' | 'video';
    file_size?: number;
    description?: string;
    created_at?: string;
}

interface ImageTransformModalProps {
    files: AgentLibraryFile[];
    onClose: () => void;
}

const FILE_ICONS: Record<string, React.ElementType> = {
    image: ImageIcon,
    document: FileText,
    audio: Mic,
    video: Video,
};

export function ImageTransformModal({ files, onClose }: ImageTransformModalProps) {
    const imageFiles = files.filter(f => f.file_type === 'image');
    const [selectedLibraryFile, setSelectedLibraryFile] = useState<AgentLibraryFile | null>(imageFiles[0] || null);
    const [leadImageUrl, setLeadImageUrl] = useState('');
    const [leadImagePreview, setLeadImagePreview] = useState<string | null>(null);
    const [customPrompt, setCustomPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleLeadFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setLeadImageUrl(url);
        setLeadImagePreview(url);
    }, []);

    const handleGenerate = async () => {
        if (!selectedLibraryFile || !leadImageUrl) {
            setError('Selecione uma imagem da biblioteca e envie a foto do lead.');
            return;
        }
        setIsGenerating(true);
        setError(null);
        setResultUrl(null);
        try {
            const res = await fetch('/api/v1/agent-library/transform-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    libraryImageUrl: selectedLibraryFile.file_url,
                    leadImageUrl,
                    prompt: customPrompt || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao gerar imagem');
            setResultUrl(data.resultUrl);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Transformar Imagem</p>
                            <p className="text-[10px] text-zinc-500">Simulação realista via OpenAI DALL-E</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Library image selector */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-500">
                            1. Imagem da Biblioteca (Produto/Referência)
                        </label>
                        {imageFiles.length === 0 ? (
                            <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 border border-amber-200">
                                Nenhuma imagem na biblioteca. Adicione imagens primeiro.
                            </p>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {imageFiles.map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => setSelectedLibraryFile(f)}
                                        className={cn(
                                            'relative rounded-xl overflow-hidden border-2 transition-all aspect-square',
                                            selectedLibraryFile?.id === f.id
                                                ? 'border-violet-500 ring-2 ring-violet-300'
                                                : 'border-zinc-200 dark:border-zinc-700 hover:border-violet-300'
                                        )}
                                    >
                                        <img src={f.file_url} alt={f.file_name} className="w-full h-full object-cover" />
                                        <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1">
                                            <p className="text-[9px] text-white truncate">{f.file_name}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Lead image upload */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-500">
                            2. Foto do Lead (Ambiente/Local)
                        </label>
                        {leadImagePreview ? (
                            <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                <img src={leadImagePreview} alt="lead" className="w-full max-h-40 object-cover" />
                                <button
                                    onClick={() => { setLeadImageUrl(''); setLeadImagePreview(null); }}
                                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center gap-2 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl py-6 cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-all">
                                <Upload className="w-6 h-6 text-zinc-400" />
                                <span className="text-xs text-zinc-500">Clique para enviar foto do lead</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleLeadFileUpload} />
                            </label>
                        )}
                    </div>

                    {/* Custom prompt (optional) */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-500">
                            3. Instrução Personalizada (Opcional)
                        </label>
                        <Input
                            value={customPrompt}
                            onChange={e => setCustomPrompt(e.target.value)}
                            placeholder="Ex: Aplique o mármore branco como bancada da pia do lead..."
                            className="rounded-xl text-sm"
                        />
                    </div>

                    {error && (
                        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                            {error}
                        </p>
                    )}

                    {/* Result */}
                    {resultUrl && (
                        <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-600">
                                ✅ Resultado da Simulação
                            </label>
                            <div className="rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-800">
                                <img src={resultUrl} alt="resultado" className="w-full object-cover" />
                            </div>
                            <a
                                href={resultUrl}
                                download="simulacao.png"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-violet-600 hover:text-violet-700 font-semibold"
                            >
                                <Download className="w-3.5 h-3.5" /> Baixar Imagem
                            </a>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <Button
                            onClick={handleGenerate}
                            disabled={isGenerating || !selectedLibraryFile || !leadImageUrl}
                            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 text-sm font-semibold"
                        >
                            {isGenerating ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
                            ) : (
                                <><Sparkles className="w-4 h-4 mr-2" /> Gerar Simulação</>
                            )}
                        </Button>
                        <Button variant="outline" onClick={onClose} className="rounded-xl h-10 border-zinc-200 dark:border-zinc-700">
                            Fechar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
