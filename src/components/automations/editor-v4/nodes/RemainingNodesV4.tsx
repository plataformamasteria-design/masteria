'use client';

import React, { memo } from 'react';
import { Position } from '@xyflow/react';
import { MessageSquareHeart, Send, Columns3, Hash, Bot, UserPlus, UserSearch, StickyNote, Globe, Code2, PenLine } from 'lucide-react';
import { BaseNode, type NodeColorKey } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

// ─── Nó de Follow-Up IA ──────────────────────────────────────────────────────
export const FollowUpAiNodeV4 = memo(({ data, selected }: any) => {
    const footer = (
        // Container único position:relative — handles colIndex/colTotal corretos
        <div style={{ position: 'relative' }}>
            <div className="grid grid-cols-2 divide-x divide-orange-100/50">
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-green-500 uppercase">Respondeu</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-rose-500 uppercase">Não Resp.</span>
                </div>
            </div>
            {/* responded = left:25% | not_responded = left:75% — idêntico ao legado */}
            <NodeHandle type="source" position={Position.Bottom} id="responded"     color="#22c55e" colIndex={0} colTotal={2} />
            <NodeHandle type="source" position={Position.Bottom} id="not_responded" color="#f43f5e" colIndex={1} colTotal={2} />
        </div>
    );

    return (
        <BaseNode selected={selected} accentColor="orange" icon={MessageSquareHeart}
            category="IA" label={data.label || 'Follow-Up IA'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={footer}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="orange" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
                <p className="text-[11px] text-zinc-500">Reengajamento automático com IA</p>
            </div>
        </BaseNode>
    );
});
FollowUpAiNodeV4.displayName = 'FollowUpAiNodeV4';


// ─── Nó de Resposta IA ───────────────────────────────────────────────────────
export const SendAiResponseNodeV4 = memo(({ data, selected }: any) => (
    <BaseNode selected={selected} accentColor="violet" icon={Send}
        category="IA" label={data.label || 'Resposta IA'}
        onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
        footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="violet" /></div>}
    >
        <NodeHandle type="target" position={Position.Top} accentColor="violet" />
        <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
            <p className="text-[11px] text-zinc-500">Envia resposta gerada pela IA</p>
        </div>
    </BaseNode>
));
SendAiResponseNodeV4.displayName = 'SendAiResponseNodeV4';

// ─── Nó de Mover Kanban ──────────────────────────────────────────────────────
export const CrmMoveNodeV4 = memo(({ data, selected }: any) => (
    <BaseNode selected={selected} accentColor="orange" icon={Columns3}
        category="CRM" label={data.label || 'Mover Kanban'}
        onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
        footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="orange" /></div>}
    >
        <NodeHandle type="target" position={Position.Top} accentColor="orange" />
        <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5 space-y-1">
            {data.funnel_name && <p className="text-[11px] text-zinc-700 font-medium">📊 {data.funnel_name}</p>}
            {data.stage_name && <p className="text-[10px] text-zinc-500">→ {data.stage_name}</p>}
            {!data.funnel_name && <p className="text-[11px] text-zinc-400 italic">Selecionar funil e etapa...</p>}
        </div>
    </BaseNode>
));
CrmMoveNodeV4.displayName = 'CrmMoveNodeV4';

// ─── Nó de Adicionar Tag ─────────────────────────────────────────────────────
export const AddTagNodeV4 = memo(({ data, selected }: any) => (
    <BaseNode selected={selected} accentColor="rose" icon={Hash}
        category="CRM" label={data.label || 'Adicionar Tag'}
        onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
        footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="rose" /></div>}
    >
        <NodeHandle type="target" position={Position.Top} accentColor="rose" />
        <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
            {data.tagId || data.tag_name
                ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full"># {data.tag_name || data.tagId}</span>
                : <p className="text-[11px] text-zinc-400 italic">Selecionar tag...</p>}
        </div>
    </BaseNode>
));
AddTagNodeV4.displayName = 'AddTagNodeV4';

// ─── Nó de Parar Robô ────────────────────────────────────────────────────────
export const BotToggleNodeV4 = memo(({ data, selected }: any) => (
    <BaseNode selected={selected} accentColor="zinc" icon={Bot}
        category="Controle" label={data.label || 'Controlar Robô'}
        onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
        footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="zinc" /></div>}
    >
        <NodeHandle type="target" position={Position.Top} accentColor="zinc" />
        <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
            <span className={`text-[11px] font-semibold ${data.action === 'stop' ? 'text-rose-500' : 'text-green-500'}`}>
                {data.action === 'stop' ? '⏹ Pausar robô' : '▶ Retomar robô'}
            </span>
        </div>
    </BaseNode>
));
BotToggleNodeV4.displayName = 'BotToggleNodeV4';

// ─── Nó de Buscar Lead ───────────────────────────────────────────────────────
export const LookupLeadNodeV4 = memo(({ data, selected }: any) => {
    const footer = (
        <div style={{ position: 'relative' }}>
            <div className="grid grid-cols-2 divide-x divide-zinc-200/50">
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-blue-500 uppercase">Encontrado</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-3">
                    <span className="text-[9px] font-semibold tracking-widest text-violet-500 uppercase">Não Encontrado</span>
                </div>
            </div>
            <NodeHandle type="source" position={Position.Bottom} id="found"     semantic colIndex={0} colTotal={2} />
            <NodeHandle type="source" position={Position.Bottom} id="not_found" semantic colIndex={1} colTotal={2} />
        </div>
    );
    return (
        <BaseNode selected={selected} accentColor="cyan" icon={UserSearch}
            category="CRM" label={data.label || 'Buscar Lead'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={footer}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="cyan" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
                <p className="text-[11px] text-zinc-500">
                    {data.phone_variable ? `📱 {{${data.phone_variable}}}` : 'Busca por número de telefone'}
                </p>
            </div>
        </BaseNode>
    );
});
LookupLeadNodeV4.displayName = 'LookupLeadNodeV4';

// ─── Nó de Atribuir Usuário ──────────────────────────────────────────────────
export const AssignUserNodeV4 = memo(({ data, selected }: any) => {
    const labelMap: Record<string, string> = {
        user: 'Agente específico',
        team: 'Equipe específica',
        random_in_team: 'Aleatório na equipe',
    };
    return (
        <BaseNode selected={selected} accentColor="fuchsia" icon={UserPlus}
            category="CRM" label={data.label || 'Atribuir Lead'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="fuchsia" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="fuchsia" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5 space-y-1">
                <p className="text-[11px] text-zinc-600 font-medium">
                    {labelMap[data.assign_type] || 'Não configurado'}
                </p>
                {data.assign_type === 'user' && data.user_name && (
                    <p className="text-[10px] text-zinc-500 font-medium bg-zinc-200/50 px-2 py-0.5 rounded inline-block truncate max-w-full">
                        👤 {data.user_name}
                    </p>
                )}
                {(data.assign_type === 'team' || data.assign_type === 'random_in_team') && data.team_name && (
                    <p className="text-[10px] text-zinc-500 font-medium bg-zinc-200/50 px-2 py-0.5 rounded inline-block truncate max-w-full">
                        👥 {data.team_name}
                    </p>
                )}
            </div>
        </BaseNode>
    );
});
AssignUserNodeV4.displayName = 'AssignUserNodeV4';

// ─── Nó de Adicionar Nota ────────────────────────────────────────────────────
export const AddNoteNodeV4 = memo(({ data, selected }: any) => {
    const note = data.note_text || data.note || '';
    return (
        <BaseNode selected={selected} accentColor="amber" icon={StickyNote}
            category="CRM" label={data.label || 'Adicionar Nota'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="amber" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="amber" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
                {note
                    ? <p className="text-[11px] text-zinc-700 line-clamp-2">{note}</p>
                    : <p className="text-[11px] text-zinc-400 italic">Configurar nota interna...</p>}
            </div>
        </BaseNode>
    );
});
AddNoteNodeV4.displayName = 'AddNoteNodeV4';

// ─── Nó de HTTP Request ──────────────────────────────────────────────────────
export const HttpRequestNodeV4 = memo(({ data, selected }: any) => {
    const METHOD_COLORS: Record<string, string> = {
        GET: 'text-green-600 bg-green-50 border-green-100',
        POST: 'text-blue-600 bg-blue-50 border-blue-100',
        PUT: 'text-amber-600 bg-amber-50 border-amber-100',
        PATCH: 'text-orange-600 bg-orange-50 border-orange-100',
        DELETE: 'text-rose-600 bg-rose-50 border-rose-100',
    };
    const method = data.method || 'GET';
    return (
        <BaseNode selected={selected} accentColor="teal" icon={Globe}
            category="Avançado" label={data.label || 'HTTP Request'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="teal" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="teal" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5 flex items-center gap-2">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${METHOD_COLORS[method] || METHOD_COLORS.GET}`}>
                    {method}
                </span>
                <span className="text-[11px] text-zinc-500 font-mono truncate">{data.url || 'URL não configurada'}</span>
            </div>
        </BaseNode>
    );
});
HttpRequestNodeV4.displayName = 'HttpRequestNodeV4';

// ─── Nó de Código ────────────────────────────────────────────────────────────
export const CodeNodeV4 = memo(({ data, selected }: any) => {
    const lang = data.language || 'javascript';
    const hasCode = !!(data.code?.trim());
    return (
        <BaseNode selected={selected} accentColor="zinc" icon={Code2}
            category="Avançado" label={data.label || 'Executar Código'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="zinc" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="zinc" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5 flex items-center gap-2">
                <span className="text-[9px] font-bold text-zinc-400 bg-zinc-200 px-1.5 py-0.5 rounded">{lang}</span>
                <span className="text-[11px] text-zinc-500">{hasCode ? 'Código configurado' : 'Clique para escrever o código'}</span>
            </div>
        </BaseNode>
    );
});
CodeNodeV4.displayName = 'CodeNodeV4';

// ─── Nó de Edit Fields ───────────────────────────────────────────────────────
export const EditFieldsNodeV4 = memo(({ data, selected }: any) => {
    const fields: any[] = data.fields || [];
    return (
        <BaseNode selected={selected} accentColor="teal" icon={PenLine}
            category="Avançado" label={data.label || 'Editar Campos'}
            onDelete={data.onDelete} onDuplicate={data.onDuplicate} onLabelChange={data.onLabelChange}
            footer={<div className="relative flex justify-center py-3"><NodeHandle type="source" position={Position.Bottom} accentColor="teal" /></div>}
        >
            <NodeHandle type="target" position={Position.Top} accentColor="teal" />
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 px-3 py-2.5">
                <p className="text-[11px] text-zinc-500">
                    {fields.length > 0 ? `${fields.length} campo(s) configurado(s)` : 'Nenhum campo configurado'}
                </p>
            </div>
        </BaseNode>
    );
});
EditFieldsNodeV4.displayName = 'EditFieldsNodeV4';
