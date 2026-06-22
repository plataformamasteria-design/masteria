'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Upload, Trash2, Image as ImageIcon, FileText, Mic, Video,
    Loader2, Sparkles, FolderOpen, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type AgentLibraryFile } from './ImageTransformModal';
import { Textarea } from '@/components/ui/textarea';

interface AgentMediaLibraryProps {
    nodeId: string;
    ruleId?: string;
    enabled: boolean;
    onToggle: (v: boolean) => void;
    /** Called only on user-driven mutations (upload/delete/desc edit), NOT on initial fetch.
     *  This prevents the parent re-render → new fn ref → re-fetch infinite loop. */
    onFilesChange?: (files: AgentLibraryFile[]) => void;
    simulationEnabled?: boolean;
    onSimulationToggle?: (v: boolean) => void;
    simulationPrompt?: string;
    onSimulationPromptChange?: (val: string) => void;
    simulationStrength?: number;
    onSimulationStrengthChange?: (val: number) => void;
    simulationModel?: string;
    onSimulationModelChange?: (val: string) => void;
}

// We removed the module-level cache because it conflicted with React state unmounting,
// causing the UI to show 0 files when reopening a node.
const FILE_ICONS: Record<string, React.ElementType> = {
    image: ImageIcon,
    document: FileText,
    audio: Mic,
    video: Video,
};

const FILE_COLORS: Record<string, string> = {
    image: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
    document: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20',
    audio: 'text-green-500 bg-green-50 dark:bg-green-900/20',
    video: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
};

function formatBytes(bytes?: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
}

export function AgentMediaLibrary({ nodeId, ruleId, enabled, onToggle, onFilesChange, simulationEnabled, onSimulationToggle, simulationPrompt, onSimulationPromptChange, simulationStrength, onSimulationStrengthChange, simulationModel, onSimulationModelChange }: AgentMediaLibraryProps) {
    const [files, setFiles] = useState<AgentLibraryFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingDesc, setEditingDesc] = useState<string | null>(null);
    const [descValue, setDescValue] = useState('');
    // ✅ Stable ref — avoids including onFilesChange in useEffect/useCallback deps
    const onFilesChangeRef = useRef(onFilesChange);
    onFilesChangeRef.current = onFilesChange; // update synchronously (no useEffect needed)

    // ✅ fetchFiles ONLY updates local state — does NOT call onFilesChange
    //    This breaks the: fetch → parent update → re-render → new fn ref → re-fetch loop
    const fetchFiles = useCallback(async (retryCount = 0) => {
        if (!nodeId) return;
        setLoading(true);
        setError(null);
        let retrying = false;
        try {
            const res = await fetch(`/api/v1/agent-library?nodeId=${encodeURIComponent(nodeId)}`);
            // Handle non-JSON responses (e.g. Turbopack still compiling)
            const text = await res.text();
            let data: any = {};
            try { data = JSON.parse(text); } catch {
                if (retryCount < 2) {
                    retrying = true;
                    setTimeout(() => fetchFiles(retryCount + 1), 1500);
                    return;
                }
                throw new Error('Servidor temporariamente indisponível. Tente novamente.');
            }
            if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
            setFiles(data.files || []);
        } catch (err: any) {
            // Auto-retry on transient network errors (Turbopack compiling, timeout)
            if ((err.message === 'Failed to fetch' || err.name === 'TypeError') && retryCount < 2) {
                retrying = true;
                setTimeout(() => fetchFiles(retryCount + 1), 1500);
                return;
            }
            console.error('[AgentMediaLibrary] fetch error', err);
            setError(err.message === 'Failed to fetch' ? 'Conexão com servidor falhou. Tente recarregar a página.' : err.message);
        } finally {
            if (!retrying) setLoading(false);
        }
    }, [nodeId]);

    // ✅ Fetch on mount or when nodeId changes.
    //    Removing the module-level Set fixes the bug where reopening a node shows 0 files.
    useEffect(() => {
        if (enabled && nodeId) {
            fetchFiles();
        }
    }, [enabled, nodeId, fetchFiles]);


    // Clear local state when toggled off
    const handleToggle = useCallback((v: boolean) => {
        if (!v) setFiles([]);
        onToggle(v);
    }, [onToggle]);

    // ✅ Notify parent only on explicit user actions
    const notifyParent = useCallback((updated: AgentLibraryFile[]) => {
        onFilesChangeRef.current?.(updated);
    }, []);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = Array.from(e.target.files || []);
        if (!fileList.length) return;
        setUploading(true);
        setError(null);
        try {
            for (const file of fileList) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('nodeId', nodeId);
                if (ruleId) formData.append('ruleId', ruleId);

                const res = await fetch('/api/v1/agent-library', { method: 'POST', body: formData });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `Erro HTTP ${res.status}`);
            }
            // Refresh list after upload
            await fetchFiles();
            // Notify parent ONCE after all uploads
            notifyParent(files);
        } catch (err: any) {
            console.error('[AgentMediaLibrary] upload error', err);
            setError(err.message);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Remover este arquivo da biblioteca?')) return;
        try {
            const res = await fetch(`/api/v1/agent-library?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                const updated = files.filter(f => f.id !== id);
                setFiles(updated);
                notifyParent(updated);
            } else {
                const data = await res.json();
                setError(`Erro ao excluir: ${data.error || res.status}`);
            }
        } catch (err: any) {
            setError(`Falha de conexão: ${err.message}`);
        }
    };

    const handleSaveDesc = useCallback(async (fileId: string) => {
        try {
            const res = await fetch(`/api/v1/agent-library`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: fileId, description: descValue })
            });
            if (!res.ok) throw new Error('Falha ao salvar a descrição');
            const updated = files.map(f => f.id === fileId ? { ...f, description: descValue } : f);
            setFiles(updated);
            notifyParent(updated);
            setEditingDesc(null);
        } catch (err: any) {
            console.error('[AgentMediaLibrary] error saving description', err);
            setError(err.message);
        }
    }, [files, descValue, notifyParent]);

    return (
        <div className="space-y-4">
            {/* Toggle switch */}
            <button
                type="button"
                onClick={() => handleToggle(!enabled)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 rounded-xl border border-border hover:bg-muted/80 transition-all cursor-pointer"
            >
                <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-semibold text-foreground">Ativar Biblioteca de Arquivos</span>
                </div>
                <div className={`w-10 h-6 rounded-full transition-all ${enabled ? 'bg-violet-600' : 'bg-zinc-300 dark:bg-zinc-600'} relative flex-shrink-0`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all ${enabled ? 'left-5' : 'left-1'}`} />
                </div>
            </button>

            {!enabled && (
                <div className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-500 bg-zinc-50 dark:bg-zinc-900">
                    Quando ativo, o agente pode consultar e enviar arquivos da biblioteca junto das respostas. O lead SEMPRE receberá o texto junto do arquivo.
                </div>
            )}

            {enabled && (
                <div className="space-y-3">
                    {/* Info banner */}
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl text-[11px] text-violet-700 dark:text-violet-300">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>A IA usa a <strong>descrição</strong> de cada arquivo para decidir quando enviá-lo. Adicione descrições claras. O arquivo é sempre enviado <strong>junto da resposta de texto</strong>, nunca sozinho.</span>
                    </div>

                    {/* Simulation Toggle */}
                    {onSimulationToggle !== undefined && (
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => onSimulationToggle(!simulationEnabled)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer mt-2"
                            >
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-500" />
                                    <div className="text-left">
                                        <span className="block text-sm font-semibold text-foreground">Permitir Simulação Realista (DALL-E)</span>
                                        <span className="block text-[10px] text-zinc-500">A IA poderá gerar montagens dos produtos em fotos enviadas pelos clientes.</span>
                                    </div>
                                </div>
                                <div className={`w-10 h-6 rounded-full transition-all ${simulationEnabled ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-600'} relative flex-shrink-0`}>
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all ${simulationEnabled ? 'left-5' : 'left-1'}`} />
                                </div>
                            </button>

                            {simulationEnabled && (
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                            Prompt de Simulação
                                            <span title="Diga à IA como aplicar o produto. Use a tag {{produto}} para o nome do material e {{alvo}} para o que será trocado."><Info className="w-3 h-3 cursor-help text-zinc-400" /></span>
                                        </label>
                                        <Textarea
                                            value={simulationPrompt || ''}
                                            onChange={(e) => onSimulationPromptChange?.(e.target.value)}
                                            placeholder={`Ex: "Substitua única e exclusivamente o/a {"{{alvo}}"} pelo material: {"{{produto}}"}. Mantenha a estrutura igual."`}
                                            className="h-20 text-xs rounded-xl resize-none font-medium"
                                        />
                                        <div className="text-[10px] text-zinc-500 font-medium leading-relaxed">
                                            Tags disponíveis:<br/>
                                            <span className="text-indigo-500 font-bold font-mono bg-indigo-50 dark:bg-indigo-900/30 px-1 rounded">{"{{produto}}"}</span> (nome do material)<br/>
                                            <span className="text-pink-500 font-bold font-mono bg-pink-50 dark:bg-pink-900/30 px-1 rounded">{"{{alvo}}"}</span> (o que o cliente quer trocar, ex: 'chão', 'bancada')
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                            Modelo da IA
                                            <span title="Escolha qual modelo da Fal.ai será usado para gerar a simulação."><Info className="w-3 h-3 cursor-help text-zinc-400" /></span>
                                        </label>
                                        <select
                                            value={simulationModel || 'fal-ai/flux-pro/kontext/max|1920|28'}
                                            onChange={(e) => onSimulationModelChange?.(e.target.value)}
                                            className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
                                        >
                                            <option value="fal-ai/flux/dev/image-to-image|1920|30">FLUX Dev Image-to-Image (Padrão - Rápido)</option>
                                            <option value="fal-ai/flux-pro/kontext/max|1920|28">FLUX Kontext Max (Avançado - Qualidade Total)</option>
                                            <option value="fal-ai/flux-pro/kontext/max|1024|28">FLUX Kontext Max (28 passos / 1024px)</option>
                                            <option value="fal-ai/flux-pro/kontext/max|1024|26">FLUX Kontext Max (26 passos / 1024px)</option>
                                            <option value="fal-ai/flux-pro/kontext|1024|28">FLUX Kontext Pro (Balanceado)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                                Força da Aplicação (Similaridade)
                                                <span title="Quanto mais alto, mais o material irá se parecer com o produto, mas a estrutura da cozinha pode mudar. Recomenda-se entre 70 e 90."><Info className="w-3 h-3 cursor-help text-zinc-400" /></span>
                                            </label>
                                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                {simulationStrength !== undefined ? simulationStrength : 80}%
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="10"
                                            max="100"
                                            step="1"
                                            value={simulationStrength !== undefined ? simulationStrength : 80}
                                            onChange={(e) => onSimulationStrengthChange?.(parseInt(e.target.value, 10))}
                                            className="w-full accent-indigo-500"
                                        />
                                        <div className="flex justify-between text-[10px] text-zinc-400 font-medium">
                                            <span>Mantém estrutura</span>
                                            <span>Muda textura (80% ideal)</span>
                                            <span>Ignora estrutura</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error message */}
                    {error && (
                        <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-[11px] text-red-600 dark:text-red-400">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Upload button */}
                    <label className={cn(
                        'flex items-center justify-center gap-2 w-full h-10 rounded-xl border-2 border-dashed cursor-pointer transition-all text-xs font-semibold',
                        uploading
                            ? 'border-zinc-300 dark:border-zinc-600 text-zinc-400 cursor-not-allowed'
                            : 'border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'
                    )}>
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? 'Enviando...' : 'Adicionar Arquivos'}
                        <input
                            type="file"
                            multiple
                            accept="image/*,application/pdf,audio/*,video/*,.doc,.docx"
                            className="hidden"
                            onChange={handleUpload}
                            disabled={uploading}
                        />
                    </label>

                    {/* File list */}
                    {loading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                        </div>
                    ) : files.length === 0 ? (
                        <div className="text-center py-5 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
                            Nenhum arquivo na biblioteca. Adicione fotos e documentos acima.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {files.map(file => {
                                const Icon = FILE_ICONS[file.file_type] || FileText;
                                const colorClass = FILE_COLORS[file.file_type] || 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800';
                                return (
                                    <div key={file.id} className="flex items-start gap-2.5 p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                                        {/* Icon / Thumbnail */}
                                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden', colorClass)}>
                                            {file.file_type === 'image' ? (
                                                <img src={file.file_url} alt={file.file_name} className="w-10 h-10 rounded-lg object-cover" />
                                            ) : (
                                                <Icon className="w-5 h-5" />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">{file.file_name}</p>
                                                {file.extractedText && (
                                                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" title="Este documento será lido pela IA (Base de Conhecimento)">
                                                        RAG ATIVO
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-zinc-400">{formatBytes(file.file_size)}</p>
                                            {editingDesc === file.id ? (
                                                <div className="flex gap-1 mt-1.5">
                                                    <Input
                                                        value={descValue}
                                                        onChange={e => setDescValue(e.target.value)}
                                                        placeholder="Quando a IA deve usar este arquivo..."
                                                        className="h-7 text-[11px] rounded-lg flex-1"
                                                        autoFocus
                                                        onKeyDown={e => e.key === 'Enter' && handleSaveDesc(file.id)}
                                                    />
                                                    <Button size="sm" className="h-7 text-[10px] px-2 rounded-lg" onClick={() => handleSaveDesc(file.id)}>OK</Button>
                                                    <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 rounded-lg" onClick={() => setEditingDesc(null)}>✕</Button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => { setEditingDesc(file.id); setDescValue(file.description || ''); }}
                                                    className="text-[10px] text-violet-500 hover:text-violet-700 mt-0.5 text-left truncate w-full"
                                                >
                                                    {file.description || '+ Adicionar descrição para a IA'}
                                                </button>
                                            )}
                                        </div>

                                        {/* Delete */}
                                        <button
                                            onClick={() => handleDelete(file.id)}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}
