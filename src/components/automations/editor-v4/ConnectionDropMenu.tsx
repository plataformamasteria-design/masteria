'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    MessageSquare, Image as ImageIcon, Mic, FileText, Video, MessageSquareShare,
    GitBranch, Clock, MessageCircle, Signpost, Filter,
    Brain, Target, MessageSquareHeart, Send,
    Columns3, Hash, Bot, UserPlus, UserSearch, StickyNote, Database,
    Globe, Code2, PenLine, Search, X,
} from 'lucide-react';

// ─── Catálogo flat (igual ao NodeLibraryPanel mas organizado para busca) ──────
interface NodeEntry {
    type: string;
    label: string;
    icon: React.ElementType;
    color: string;
    category: string;
    defaultData: Record<string, any>;
}

const ALL_NODES: NodeEntry[] = [
    // Mensagens
    { type: 'send_message',  label: 'WhatsApp',        icon: MessageSquare,      color: 'text-green-600',   category: 'Mensagens',          defaultData: { message: '' } },
    { type: 'send_template', label: 'Template',         icon: MessageSquareShare, color: 'text-green-700',   category: 'Mensagens',          defaultData: { template_name: '' } },
    { type: 'send_image',    label: 'Imagem',           icon: ImageIcon,          color: 'text-blue-600',    category: 'Mensagens',          defaultData: { file_url: '' } },
    { type: 'send_audio',    label: 'Áudio',            icon: Mic,                color: 'text-rose-600',    category: 'Mensagens',          defaultData: { file_url: '' } },
    { type: 'send_document', label: 'Documento',        icon: FileText,           color: 'text-orange-600',  category: 'Mensagens',          defaultData: { file_url: '' } },
    { type: 'send_video',    label: 'Vídeo',            icon: Video,              color: 'text-violet-600',  category: 'Mensagens',          defaultData: { file_url: '' } },
    // Lógica
    { type: 'condition',     label: 'Condição (Se)',    icon: GitBranch,          color: 'text-amber-600',   category: 'Lógica',             defaultData: { conditions: [] } },
    { type: 'delay',         label: 'Atraso',           icon: Clock,              color: 'text-amber-500',   category: 'Lógica',             defaultData: { amount: 1, unit: 'minutes' } },
    { type: 'wait_response', label: 'Aguardar Resp.',   icon: MessageCircle,      color: 'text-teal-600',    category: 'Lógica',             defaultData: { maxWaitTime: 10 } },
    { type: 'router',        label: 'Roteador',         icon: Signpost,           color: 'text-indigo-600',  category: 'Lógica',             defaultData: { routes: [] } },
    { type: 'filter',        label: 'Filtro',           icon: Filter,             color: 'text-violet-600',  category: 'Lógica',             defaultData: { conditions: [] } },
    // CRM
    { type: 'lookup_lead',   label: 'Buscar Lead',      icon: UserSearch,         color: 'text-cyan-600',    category: 'CRM & Ações',        defaultData: { identifier_type: 'phone' } },
    { type: 'assign_user',   label: 'Atribuir Lead',    icon: UserPlus,           color: 'text-fuchsia-600', category: 'CRM & Ações',        defaultData: { assign_type: 'user' } },
    { type: 'add_note',      label: 'Adicionar Nota',   icon: StickyNote,         color: 'text-amber-600',   category: 'CRM & Ações',        defaultData: { note: '' } },
    { type: 'add_tag',       label: 'Adicionar Tag',    icon: Hash,               color: 'text-rose-600',    category: 'CRM & Ações',        defaultData: { tagId: '' } },
    { type: 'crm_move',      label: 'Mover Kanban',     icon: Columns3,           color: 'text-orange-600',  category: 'CRM & Ações',        defaultData: { boardId: '' } },
    { type: 'bot_toggle',    label: 'Controlar Robô',   icon: Bot,                color: 'text-zinc-600',    category: 'CRM & Ações',        defaultData: { action: 'stop' } },
    { type: 'capture_info',  label: 'Capturar Dado',    icon: Database,           color: 'text-blue-500',    category: 'CRM & Ações',        defaultData: { fieldInfo: '' } },
    // IA
    { type: 'ai_agent',       label: 'Agente IA',       icon: Brain,              color: 'text-violet-600',  category: 'Inteligência IA',    defaultData: { provider: 'gemini', model: 'gemini-2.0-flash' } },
    { type: 'intent_router',  label: 'Classificador',   icon: Target,             color: 'text-purple-600',  category: 'Inteligência IA',    defaultData: { intents: [] } },
    { type: 'follow_up_ai',   label: 'Follow-Up IA',    icon: MessageSquareHeart, color: 'text-orange-500',  category: 'Inteligência IA',    defaultData: {} },
    { type: 'send_ai_response',label: 'Resposta IA',    icon: Send,               color: 'text-emerald-600', category: 'Inteligência IA',    defaultData: {} },
    // Avançado
    { type: 'http_request',  label: 'HTTP Request',     icon: Globe,              color: 'text-teal-600',    category: 'Avançado',           defaultData: { method: 'GET', url: '' } },
    { type: 'code',          label: 'Código',           icon: Code2,              color: 'text-zinc-600',    category: 'Avançado',           defaultData: { language: 'javascript', code: '' } },
    { type: 'edit_fields',   label: 'Edit Fields',      icon: PenLine,            color: 'text-teal-500',    category: 'Avançado',           defaultData: { fields: [], mode: 'pairs' } },
];

// ─── Props ────────────────────────────────────────────────────────────────────
export interface ConnectionDropMenuProps {
    /** Posição em coordenadas de tela (px) onde o popup deve aparecer */
    screenX: number;
    screenY: number;
    onSelect: (type: string, defaultData: Record<string, any>) => void;
    onClose: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function ConnectionDropMenu({ screenX, screenY, onSelect, onClose }: ConnectionDropMenuProps) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Focar input ao abrir
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 50);
    }, []);

    // Fechar ao clicar fora
    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [onClose]);

    // Fechar com ESC
    useEffect(() => {
        const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handle);
        return () => document.removeEventListener('keydown', handle);
    }, [onClose]);

    // Calcular posição ajustada para não sair da tela
    const menuWidth = 240;
    const menuMaxHeight = 340;
    const adjustedX = Math.min(screenX, window.innerWidth - menuWidth - 16);
    const adjustedY = screenY + menuMaxHeight > window.innerHeight
        ? screenY - menuMaxHeight
        : screenY;

    // Filtrar nodes
    const filtered = query.trim()
        ? ALL_NODES.filter(n =>
            n.label.toLowerCase().includes(query.toLowerCase()) ||
            n.category.toLowerCase().includes(query.toLowerCase())
        )
        : ALL_NODES;

    // Agrupar por categoria (apenas quando não há busca)
    const categories = query.trim()
        ? null
        : [...new Set(ALL_NODES.map(n => n.category))];

    return (
        <div
            ref={menuRef}
            className="fixed z-[9999] flex flex-col bg-white rounded-2xl border border-zinc-200 shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden"
            style={{
                left: adjustedX,
                top: adjustedY,
                width: menuWidth,
                maxHeight: menuMaxHeight,
            }}
            onClick={e => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-100">
                <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Buscar bloco..."
                    className="flex-1 text-[12px] text-zinc-800 outline-none placeholder:text-zinc-400 bg-transparent"
                />
                <button
                    onClick={onClose}
                    className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-400 transition-colors"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-zinc-400">
                        <p className="text-[12px]">Nenhum bloco encontrado</p>
                    </div>
                ) : query.trim() ? (
                    // Resultado de busca — sem agrupamento
                    <div className="py-1">
                        {filtered.map(node => {
                            const NodeIcon = node.icon;
                            return (
                                <button
                                    key={node.type}
                                    onMouseDown={e => {
                                        e.preventDefault();
                                        onSelect(node.type, node.defaultData);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                                >
                                    <NodeIcon className={`w-3.5 h-3.5 shrink-0 ${node.color}`} />
                                    <div className="flex-1 min-w-0">
                                        <span className="block text-[12px] text-zinc-700 font-medium">{node.label}</span>
                                        <span className="block text-[10px] text-zinc-400">{node.category}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    // Agrupado por categoria
                    categories!.map(cat => {
                        const catNodes = ALL_NODES.filter(n => n.category === cat);
                        return (
                            <div key={cat}>
                                <div className="px-3 py-1.5 bg-zinc-50 border-b border-zinc-100">
                                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{cat}</span>
                                </div>
                                {catNodes.map(node => {
                                    const NodeIcon = node.icon;
                                    return (
                                        <button
                                            key={node.type}
                                            onMouseDown={e => {
                                                e.preventDefault();
                                                onSelect(node.type, node.defaultData);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                                        >
                                            <NodeIcon className={`w-3.5 h-3.5 shrink-0 ${node.color}`} />
                                            <span className="text-[12px] text-zinc-700 font-medium">{node.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
