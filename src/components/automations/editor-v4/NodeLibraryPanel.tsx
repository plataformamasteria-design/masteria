'use client';

import React, { useState } from 'react';
import {
    MessageSquare, Image as ImageIcon, Mic, FileText, Video, MessageSquareShare, MessageSquareDashed,
    GitBranch, Clock, MessageCircle, Signpost, Filter,
    Brain, Target, MessageSquareHeart, Send,
    Columns3, Hash, Bot, UserPlus, UserSearch, StickyNote, Database,
    Globe, Code2, PenLine, ChevronLeft, ChevronRight, Zap, CalendarCheck, MessageSquareWarning
} from 'lucide-react';

// ─── Definição do catálogo de nodes ─────────────────────────────────────────
interface NodeDef {
    type: string;
    label: string;
    icon: React.ElementType;
    color: string;
    defaultData: Record<string, any>;
}

interface NodeCategory {
    key: string;
    label: string;
    nodes: NodeDef[];
}

const NODE_CATALOG: NodeCategory[] = [
    {
        key: 'messages',
        label: 'Mensagens',
        nodes: [
            { type: 'send_message',  label: 'WhatsApp',        icon: MessageSquare,      color: 'text-green-600',   defaultData: { message: '' } },
            { type: 'interactive_message', label: 'Mensagem Interativa', icon: MessageSquareDashed, color: 'text-blue-600', defaultData: { message: '', buttons: [], attachments: [] } },
            { type: 'send_template', label: 'Template',         icon: MessageSquareShare, color: 'text-green-700',   defaultData: { template_name: '' } },
            { type: 'send_image',    label: 'Imagem',           icon: ImageIcon,          color: 'text-blue-600',    defaultData: { file_url: '' } },
            { type: 'send_audio',    label: 'Áudio',            icon: Mic,                color: 'text-rose-600',    defaultData: { file_url: '' } },
            { type: 'send_document', label: 'Documento',        icon: FileText,           color: 'text-orange-600',  defaultData: { file_url: '' } },
            { type: 'send_video',    label: 'Vídeo',            icon: Video,              color: 'text-violet-600',  defaultData: { file_url: '' } },
        ],
    },
    {
        key: 'logic',
        label: 'Lógica e Controle',
        nodes: [
            { type: 'trigger',       label: 'Gatilho Inicial',  icon: Zap,                color: 'text-yellow-500',  defaultData: { trigger_type: 'stage_entry' } },
            { type: 'condition',     label: 'Condição',         icon: GitBranch,          color: 'text-amber-600',   defaultData: { conditions: [] } },
            { type: 'delay',         label: 'Atraso',           icon: Clock,              color: 'text-amber-500',   defaultData: { amount: 1, unit: 'minutes' } },
            { type: 'wait_response', label: 'Aguardar Resp.',   icon: MessageCircle,      color: 'text-teal-600',    defaultData: { maxWaitTime: 10 } },
            { type: 'router',        label: 'Roteador',         icon: Signpost,           color: 'text-indigo-600',  defaultData: { routes: [] } },
            { type: 'filter',        label: 'Filtro',           icon: Filter,             color: 'text-violet-600',  defaultData: { conditions: [] } },
        ],
    },
    {
        key: 'crm',
        label: 'CRM & Ações',
        nodes: [
            { type: 'lookup_lead',   label: 'Buscar Lead',      icon: UserSearch,         color: 'text-cyan-600',    defaultData: { identifier_type: 'phone' } },
            { type: 'assign_user',   label: 'Atribuir',         icon: UserPlus,           color: 'text-fuchsia-600', defaultData: { assign_type: 'user' } },
            { type: 'add_note',      label: 'Adicionar Nota',   icon: StickyNote,         color: 'text-amber-600',   defaultData: { note: '' } },
            { type: 'add_tag',       label: 'Adicionar Tag',    icon: Hash,               color: 'text-rose-600',    defaultData: { tagId: '' } },
            { type: 'crm_move',      label: 'Mover Kanban',     icon: Columns3,           color: 'text-orange-600',  defaultData: { boardId: '', pipelineId: '' } },
            { type: 'bot_toggle',    label: 'Controlar Robô',   icon: Bot,                color: 'text-zinc-600',    defaultData: { action: 'stop' } },
            { type: 'capture_info',  label: 'Capturar Dado',    icon: Database,           color: 'text-blue-500',    defaultData: { fieldInfo: '' } },
            { type: 'internal_message', label: 'Mensagem Interna', icon: MessageSquareWarning, color: 'text-amber-500', defaultData: { message: '' } },
        ],
    },
    {
        key: 'scheduling',
        label: 'Agendamentos',
        nodes: [
            { type: 'add_task',      label: 'Adicionar Tarefa', icon: CalendarCheck,      color: 'text-rose-600',    defaultData: { task_text: '' } },
        ],
    },
    {
        key: 'ai',
        label: 'Inteligência IA',
        nodes: [
            { type: 'ai_agent',       label: 'Agente IA',       icon: Brain,              color: 'text-violet-600',  defaultData: { provider: 'gemini', model: 'gemini-2.0-flash' } },
            { type: 'intent_router',  label: 'Classificador',   icon: Target,             color: 'text-purple-600',  defaultData: { intents: [] } },
            { type: 'follow_up_ai',   label: 'Follow-Up IA',    icon: MessageSquareHeart, color: 'text-orange-500',  defaultData: {} },
            { type: 'send_ai_response',label: 'Resposta IA',    icon: Send,               color: 'text-emerald-600', defaultData: {} },
        ],
    },
    {
        key: 'advanced',
        label: 'Avançado',
        nodes: [
            { type: 'http_request',  label: 'HTTP Request',     icon: Globe,              color: 'text-teal-600',    defaultData: { method: 'GET', url: '' } },
            { type: 'code',          label: 'Código',           icon: Code2,              color: 'text-zinc-600',    defaultData: { language: 'javascript', code: '' } },
            { type: 'edit_fields',   label: 'Edit Fields',      icon: PenLine,            color: 'text-teal-500',    defaultData: { fields: [], mode: 'pairs' } },
        ],
    },
];

// ─── Props ───────────────────────────────────────────────────────────────────
interface NodeLibraryPanelProps {
    onAddNode: (type: string, defaultData: Record<string, any>) => void;
}

// ─── Componente ──────────────────────────────────────────────────────────────
export function NodeLibraryPanel({ onAddNode }: NodeLibraryPanelProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [openCategory, setOpenCategory] = useState<string | null>('messages');

    if (collapsed) {
        return (
            <div className="flex flex-col items-center w-10 bg-white border-r border-zinc-200 shadow-sm py-3 gap-2 z-20">
                <button
                    onClick={() => setCollapsed(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors"
                    title="Expandir painel"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-zinc-200 mx-auto" />
                {NODE_CATALOG.map(cat => {
                    const firstNode = cat.nodes[0];
                    if (!firstNode) return null;
                    const CatIcon = firstNode.icon;

                    return (
                        <button
                            key={cat.key}
                            onClick={() => { setCollapsed(false); setOpenCategory(cat.key); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors"
                            title={cat.label}
                        >
                            <CatIcon className="w-3.5 h-3.5" />
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="flex flex-col w-[220px] bg-white border-r border-zinc-200 shadow-sm overflow-hidden z-20 shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-100">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Blocos</span>
                <button
                    onClick={() => setCollapsed(true)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors"
                    title="Recolher"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Categorias */}
            <div className="flex-1 overflow-y-auto py-1">
                {NODE_CATALOG.map(cat => (
                    <div key={cat.key}>
                        {/* Toggle de categoria */}
                        <button
                            onClick={() => setOpenCategory(openCategory === cat.key ? null : cat.key)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50 transition-colors group"
                        >
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-zinc-600 transition-colors">
                                {cat.label}
                            </span>
                            <ChevronRight className={`w-3 h-3 text-zinc-300 transition-transform ${openCategory === cat.key ? 'rotate-90' : ''}`} />
                        </button>

                        {/* Nodes da categoria */}
                        {openCategory === cat.key && (
                            <div className="pb-1">
                                {cat.nodes.map(node => {
                                    const NodeIcon = node.icon;
                                    return (
                                        <button
                                            key={node.type}
                                            onClick={() => onAddNode(node.type, node.defaultData)}
                                            className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-50 transition-colors group/node-btn"
                                            title={`Adicionar ${node.label}`}
                                        >
                                            <NodeIcon className={`w-3.5 h-3.5 shrink-0 ${node.color} opacity-80 group-hover/node-btn:opacity-100`} />
                                            <span className="text-[12px] text-zinc-600 font-medium group-hover/node-btn:text-zinc-900 transition-colors">
                                                {node.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
