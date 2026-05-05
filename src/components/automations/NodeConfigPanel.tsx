'use client';

import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import type { Node } from '@xyflow/react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/session-context';
import { VariablePicker } from './VariablePicker';
import { NodeOutputPanel } from './NodeOutputPanel';
import { FileUploadField } from './FileUploadField';
import type { NodeTestOutput } from '@/hooks/useNodeTestOutputs';
import { getTeams, getCompanyUsers } from '@/app/actions/teams';
import {
    MessageSquare, Image as ImageIcon, Mic, FileText, Video,
    HelpCircle, UserPlus, MessageCircle, GitBranch, Filter,
    Signpost, Clock, ArrowRightLeft, Bot, ShieldOff, RefreshCw,
    Brain, Send, MessageSquareHeart, Globe, Code2, PenLine,
    Plus, Trash2, Zap, Settings2, Info, Loader2, CheckCircle2, AlertTriangle
} from 'lucide-react';

// ==============================
// Types
// ==============================

interface NodeConfigPanelProps {
    node: Node;
    onUpdateData: (nodeId: string, data: Record<string, any>) => void;
    testOutput?: NodeTestOutput;
    isTestingNode?: boolean;
    onTestNode?: () => void;
    allTestOutputs?: Record<string, NodeTestOutput>;
    isListening?: boolean;
    onListen?: () => void;
    onCancelListen?: () => void;
}

// ==============================
// Reusable config UI primitives
// ==============================

function ConfigSection({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                {label}
                {hint && (
                    <span title={hint}>
                        <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                    </span>
                )}
            </label>
            {children}
        </div>
    );
}

function TextFieldWithVars({ value, onChange, placeholder, multiline, monoFont }: {
    value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; monoFont?: boolean;
}) {
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    const handleVarInsert = useCallback((variable: string) => {
        onChange((value || '') + variable);
    }, [value, onChange]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const droppedText = e.dataTransfer.getData('text/plain');
        if (droppedText) {
            onChange((value || '') + droppedText);
        }
    }, [value, onChange]);

    const dropZoneClass = isDragOver
        ? 'ring-2 ring-indigo-400 ring-offset-1 border-indigo-300 bg-indigo-50/30'
        : '';

    return (
        <div
            className="space-y-1.5"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {multiline ? (
                <Textarea
                    ref={inputRef as any}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={isDragOver ? '⬇ Solte aqui para inserir a referência' : placeholder}
                    className={`min-h-[120px] rounded-xl bg-muted/50 border-border focus:ring-blue-500/20 transition-all text-sm text-foreground ${monoFont ? 'font-mono text-xs' : 'font-medium'} ${dropZoneClass}`}
                />
            ) : (
                <Input
                    ref={inputRef as any}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={isDragOver ? '⬇ Solte aqui' : placeholder}
                    className={`rounded-xl h-11 bg-muted/50 border-border text-sm ${monoFont ? 'font-mono text-xs' : ''} ${dropZoneClass}`}
                />
            )}
            <VariablePicker onSelect={handleVarInsert} />
        </div>
    );
}

function SelectField({ value, onChange, options, placeholder }: {
    value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string;
}) {
    return (
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-xl h-11 bg-muted/50 border border-border px-3 text-sm font-medium text-foreground focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer"
        >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}

function ToggleSwitch({ label, checked, onChange, color = 'blue' }: {
    label: string; checked: boolean; onChange: (v: boolean) => void; color?: string;
}) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-600', green: 'bg-green-600', violet: 'bg-violet-600', red: 'bg-red-500',
    };
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 rounded-xl border border-border hover:bg-muted/80 transition-all group cursor-pointer"
        >
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <div className={`w-10 h-6 rounded-full transition-all ${checked ? colors[color] || colors.blue : 'bg-gray-300'} relative`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all ${checked ? 'left-5' : 'left-1'}`} />
            </div>
        </button>
    );
}

function NumberField({ value, onChange, min, max, placeholder }: {
    value: number | string; onChange: (v: string) => void; min?: number; max?: number; placeholder?: string;
}) {
    return (
        <Input
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            min={min}
            max={max}
            placeholder={placeholder}
            className="rounded-xl h-11 bg-muted/50 border-border text-sm w-full"
        />
    );
}

function InfoBanner({ text, color = 'blue' }: { text: string; color?: string }) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-50 border-blue-200 text-blue-700',
        amber: 'bg-amber-50 border-amber-200 text-amber-700',
        red: 'bg-red-50 border-red-200 text-red-600',
        green: 'bg-green-500/10 border-green-500/20 text-green-800',
    };
    return (
        <div className={`px-4 py-2.5 rounded-xl border text-[11px] font-medium ${colors[color] || colors.blue}`}>
            {text}
        </div>
    );
}

// Dynamic list row builder
function DynamicListBuilder<T extends Record<string, any>>({
    items,
    onAdd,
    onRemove,
    onUpdate,
    renderRow,
    addLabel = 'Adicionar',
}: {
    items: T[];
    onAdd: () => void;
    onRemove: (index: number) => void;
    onUpdate: (index: number, field: string, value: string) => void;
    renderRow: (item: T, index: number, onUpdate: (field: string, value: string) => void) => React.ReactNode;
    addLabel?: string;
}) {
    return (
        <div className="space-y-2">
            {items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                    <div className="flex-1">{renderRow(item, i, (field, val) => onUpdate(i, field, val))}</div>
                    <button
                        type="button"
                        onClick={() => onRemove(i)}
                        className="mt-2.5 p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAdd}
                className="w-full rounded-xl border-dashed border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-400 h-9 text-xs"
            >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> {addLabel}
            </Button>
        </div>
    );
}

// ==============================
// OPERATOR_OPTIONS (shared)
// ==============================

const OPERATOR_OPTIONS = [
    { value: 'equals', label: 'Igual a (=)' },
    { value: 'not_equals', label: 'Diferente de (≠)' },
    { value: 'contains', label: 'Contém' },
    { value: 'not_contains', label: 'Não contém' },
    { value: 'starts_with', label: 'Começa com' },
    { value: 'ends_with', label: 'Termina com' },
    { value: 'is_empty', label: 'Está vazio' },
    { value: 'is_not_empty', label: 'Não está vazio' },
    { value: 'greater_than', label: 'Maior que (>)' },
    { value: 'less_than', label: 'Menor que (<)' },
];

const TIME_UNIT_OPTIONS = [
    { value: 'seconds', label: 'Segundos' },
    { value: 'minutes', label: 'Minutos' },
    { value: 'hours', label: 'Horas' },
    { value: 'days', label: 'Dias' },
];

const CONDITION_TYPE_OPTIONS = [
    { value: 'has_tag', label: 'Tem a tag' },
    { value: 'response_equals', label: 'Resposta igual a' },
    { value: 'response_contains', label: 'Resposta contém' },
    { value: 'response_in', label: 'Resposta está em' },
    { value: 'is_assigned', label: 'Está atribuído' },
];

const HTTP_METHOD_OPTIONS = [
    { value: 'GET', label: 'GET' },
    { value: 'POST', label: 'POST' },
    { value: 'PUT', label: 'PUT' },
    { value: 'PATCH', label: 'PATCH' },
    { value: 'DELETE', label: 'DELETE' },
];

const AUTH_OPTIONS = [
    { value: 'none', label: 'Sem autenticação' },
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'api_key', label: 'API Key (Header)' },
    { value: 'basic', label: 'Basic Auth' },
];

const AI_PROVIDER_OPTIONS = [
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'openai', label: 'OpenAI (GPT)' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
];

const AI_MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
    gemini: [
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
        { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ],
    openai: [
        { value: 'o1', label: 'O1' },
        { value: 'o1-mini', label: 'O1 Mini' },
        { value: 'o3-mini', label: 'O3 Mini' },
        { value: 'gpt-4.5-preview', label: 'GPT-4.5 Preview' },
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { value: 'gpt-4', label: 'GPT-4' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
    anthropic: [
        { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
        { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
    ],
};

// ==============================
// Main Component
// ==============================

export const NodeConfigPanel = memo(({ node, onUpdateData, testOutput, isTestingNode, onTestNode, allTestOutputs, isListening, onListen, onCancelListen }: NodeConfigPanelProps) => {
    const d = node.data;
    const update = useCallback((field: string, value: any) => {
        onUpdateData(node.id, { [field]: value });
    }, [node.id, onUpdateData]);

    const updateMulti = useCallback((fields: Record<string, any>) => {
        onUpdateData(node.id, fields);
    }, [node.id, onUpdateData]);

    // Template fetching for send_template node
    const { session } = useSession();
    const [approvedTemplates, setApprovedTemplates] = useState<any[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [metaConnections, setMetaConnections] = useState<any[]>([]);
    const [googleCalendarStatus, setGoogleCalendarStatus] = useState<{ connected: boolean; calendarName: string | null } | null>(null);

    // Dynamic data for node config selects
    const [companyTags, setCompanyTags] = useState<{ value: string; label: string }[]>([]);
    const [kanbanBoards, setKanbanBoards] = useState<any[]>([]);
    const [allConnections, setAllConnections] = useState<any[]>([]);
    const [companyUsers, setCompanyUsers] = useState<any[]>([]);
    const [companyTeams, setCompanyTeams] = useState<any[]>([]);

    // Derived: stages from the currently selected board in crm_move
    const selectedBoardStages = React.useMemo(() => {
        if (node.type !== 'crm_move') return [];
        const boardName = (d as any).funnel_name || '';
        const board = kanbanBoards.find((b: any) => b.id === boardName || b.name === boardName);
        if (!board?.stages) return [];
        return (board.stages as any[]).map((s: any) => ({
            value: s.id,
            label: s.title || s.name || s.id,
        }));
    }, [node.type, (d as any).funnel_name, kanbanBoards]);

    useEffect(() => {
        const needsTemplates = node.type === 'send_template';
        const needsConnections = node.type === 'send_template' || node.type === 'ai_agent' || node.type === 'ai';
        // Nodes that need tags data
        const needsTags = ['trigger', 'condition', 'action', 'crm_move', 'filter', 'router'].includes(node.type || '');
        // Nodes that need kanban boards
        const needsKanbans = ['crm_move', 'trigger'].includes(node.type || '');
        // Nodes that need all connections
        const needsAllConns = ['message', 'marketing', 'send_template', 'ai_agent', 'ai', 'trigger'].includes(node.type || '');
        // Nodes that need users and teams
        const needsUsersTeams = ['assign_user', 'trigger'].includes(node.type || '');

        if (!session?.empresaId) return;

        if (needsUsersTeams) {
            getCompanyUsers().then(setCompanyUsers).catch(console.error);
            getTeams().then(setCompanyTeams).catch(console.error);
        }

        if (needsTemplates) {
            setLoadingTemplates(true);
            fetch('/api/v1/message-templates?status=APPROVED')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setApprovedTemplates(data);
                })
                .catch(() => { })
                .finally(() => setLoadingTemplates(false));
        }
        if (needsConnections) {
            fetch('/api/v1/connections')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setMetaConnections(data.filter((c: any) => c.connectionType === 'meta_api'));
                    }
                })
                .catch(() => { });
        }
        // Load company tags
        if (needsTags) {
            fetch('/api/v1/tags')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setCompanyTags(data.map((t: any) => ({
                            value: t.name || t.id,
                            label: t.name || t.id,
                        })));
                    }
                })
                .catch(() => { });
        }
        // Load kanban boards with stages
        if (needsKanbans) {
            fetch('/api/v1/kanbans')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setKanbanBoards(data);
                    }
                })
                .catch(() => { });
        }
        // Load all connections for message/marketing nodes
        if (needsAllConns) {
            fetch('/api/v1/connections')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setAllConnections(data);
                    }
                })
                .catch(() => { });
        }
        
        // Fetch Google Calendar connection status for the Agenda tab
        if (node.type === 'ai_agent' || node.type === 'ai') {
            fetch('/api/v1/integrations/google/status')
              .then(res => res.json())
              .then((data: { connected: boolean; calendarName: string | null }) => setGoogleCalendarStatus(data))
              .catch(() => setGoogleCalendarStatus({ connected: false, calendarName: null }));
        }
    }, [session?.empresaId, node.type]);

    // Output panel is now rendered separately in the right panel of the 3-column layout

    const renderConfig = () => {
        switch (node.type) {
            // ==============================
            // TRIGGER
            // ==============================
            case 'trigger': {
                const triggerType = d.triggerType || '';
                const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
                const webhookUrl = `${appUrl}/api/v1/automation-flows/webhook-trigger/${d.webhook_slug || node.id}`;

                const TRIGGER_TYPE_OPTIONS = [
                    { value: '', label: 'Selecione um gatilho...' },
                    { value: 'message_received', label: '📩 Qualquer Mensagem Recebida' },
                    { value: 'keyword', label: '🔑 Palavra-chave Específica' },
                    { value: 'webhook', label: '🌐 Webhook Externo (HTTP)' },
                    { value: 'webhook_pix', label: '💰 PIX Recebido' },
                    { value: 'webhook_sale', label: '🛒 Venda Realizada (Hotmart/Kiwify)' },
                    { value: 'contact_created', label: '👤 Novo Contato Criado' },
                    { value: 'contact_tag_added', label: '🏷️ Tag Adicionada ao Contato' },
                    { value: 'manual', label: '⚡ Ativação Manual (API)' },
                    { value: 'schedule', label: '⏰ Agendamento (Schedule)' },
                ];

                const MATCH_MODE_OPTIONS = [
                    { value: 'contains', label: 'Contém' },
                    { value: 'exact', label: 'Exatamente igual' },
                    { value: 'starts_with', label: 'Começa com' },
                    { value: 'regex', label: 'Regex (avançado)' },
                ];

                const SCHEDULE_FREQ_OPTIONS = [
                    { value: 'every_hour', label: 'A cada hora' },
                    { value: 'every_day', label: 'Todo dia' },
                    { value: 'every_week', label: 'Toda semana' },
                    { value: 'every_month', label: 'Todo mês' },
                    { value: 'custom_cron', label: 'Cron personalizado' },
                ];

                return (
                    <div className="space-y-5">
                        <ConfigSection label="Tipo de Gatilho" hint="Escolha o evento que ativará esta automação">
                            <SelectField
                                value={triggerType}
                                onChange={(v) => {
                                    update('triggerType', v);
                                    const opt = TRIGGER_TYPE_OPTIONS.find(o => o.value === v);
                                    if (opt && opt.value) update('label', opt.label.replace(/^[^\s]+\s/, ''));
                                }}
                                options={TRIGGER_TYPE_OPTIONS}
                                placeholder="Selecione um gatilho"
                            />
                        </ConfigSection>

                        {triggerType === 'message_received' && (
                            <>
                                <ConfigSection label="Categoria de Mensagem" hint="Filtrar por qual critério a mensagem ativa a automação">
                                    <SelectField
                                        value={d.message_category || 'general'}
                                        onChange={(v) => update('message_category', v)}
                                        options={[
                                            { value: 'general', label: 'Geral (Qualquer mensagem)' },
                                            { value: 'connection', label: 'Desta Conexão Específica' },
                                            { value: 'funnel_stage', label: 'De uma Etapa do Funil' },
                                            { value: 'tag', label: 'De Leads com uma Etiqueta' },
                                            { value: 'assigned', label: 'Atribuído a um Agente/Grupo' }
                                        ]}
                                    />
                                </ConfigSection>

                                {(!d.message_category || d.message_category === 'general') && (
                                    <InfoBanner text="Dispara quando qualquer mensagem nova é recebida na organização." color="blue" />
                                )}

                                {d.message_category === 'connection' && (
                                    <ConfigSection label="Conexão Específica">
                                        <SelectField
                                            value={d.filter_connection || ''}
                                            onChange={(v) => update('filter_connection', v)}
                                            placeholder="Selecione uma conexão..."
                                            options={allConnections.map(c => ({ value: c.id, label: c.name }))}
                                        />
                                    </ConfigSection>
                                )}

                                {d.message_category === 'funnel_stage' && (
                                    <>
                                        <ConfigSection label="Funil / Kanban">
                                            <SelectField
                                                value={d.filter_funnel || ''}
                                                onChange={(v) => update('filter_funnel', v)}
                                                placeholder="Selecione um funil..."
                                                options={kanbanBoards.map(b => ({ value: b.id, label: b.name }))}
                                            />
                                        </ConfigSection>
                                        {d.filter_funnel && (
                                            <ConfigSection label="Etapa do Funil">
                                                <SelectField
                                                    value={d.filter_stage || ''}
                                                    onChange={(v) => update('filter_stage', v)}
                                                    placeholder="Qualquer etapa..."
                                                    options={kanbanBoards.find(b => b.id === d.filter_funnel)?.stages?.map((s: any) => ({ value: s.id, label: s.title || s.name })) || []}
                                                />
                                            </ConfigSection>
                                        )}
                                    </>
                                )}

                                {d.message_category === 'tag' && (
                                    <ConfigSection label="Etiqueta (Tag)">
                                        <SelectField
                                            value={d.filter_tag || ''}
                                            onChange={(v) => update('filter_tag', v)}
                                            placeholder="Selecione uma etiqueta..."
                                            options={companyTags}
                                        />
                                    </ConfigSection>
                                )}

                                {d.message_category === 'assigned' && (
                                    <>
                                        <ConfigSection label="Tipo de Atribuição">
                                            <SelectField
                                                value={d.filter_assignee_type || 'user'}
                                                onChange={(v) => update('filter_assignee_type', v)}
                                                options={[
                                                    { value: 'user', label: 'Usuário Específico' },
                                                    { value: 'team', label: 'Grupo/Equipe' }
                                                ]}
                                            />
                                        </ConfigSection>
                                        <ConfigSection label={d.filter_assignee_type === 'team' ? 'Equipe' : 'Usuário'}>
                                            <SelectField
                                                value={d.filter_assignee_id || ''}
                                                onChange={(v) => update('filter_assignee_id', v)}
                                                placeholder={`Selecione um ${d.filter_assignee_type === 'team' ? 'grupo' : 'usuário'}...`}
                                                options={d.filter_assignee_type === 'team' 
                                                    ? companyTeams.map(t => ({ value: t.id, label: t.name }))
                                                    : companyUsers.map(u => ({ value: u.id, label: u.name }))
                                                }
                                            />
                                        </ConfigSection>
                                    </>
                                )}

                                <ConfigSection label="Filtro de Palavra-chave" hint="Opcional — exige também esta palavra na mensagem">
                                    <TextFieldWithVars
                                        value={d.keyword || ''}
                                        onChange={(v) => update('keyword', v)}
                                        placeholder="Ex: oi, ajuda, preço..."
                                    />
                                </ConfigSection>
                            </>
                        )}

                        {triggerType === 'keyword' && (
                            <>
                                <ConfigSection label="Palavra-chave" hint="Texto que deve estar presente na mensagem">
                                    <TextFieldWithVars
                                        value={d.keyword || ''}
                                        onChange={(v) => update('keyword', v)}
                                        placeholder="Ex: comprar, preço, ajuda"
                                    />
                                </ConfigSection>
                                <ConfigSection label="Modo de Correspondência">
                                    <SelectField
                                        value={d.match_mode || 'contains'}
                                        onChange={(v) => update('match_mode', v)}
                                        options={MATCH_MODE_OPTIONS}
                                    />
                                </ConfigSection>
                                {d.match_mode === 'regex' && (
                                    <InfoBanner text="Use expressão regular JavaScript. Ex: ^(oi|olá)\b para início de frase." color="amber" />
                                )}
                            </>
                        )}

                        {triggerType === 'webhook' && (
                            <>
                                <ConfigSection label="Nome do Webhook (Slug)" hint="Nome único para identificar o webhook na URL">
                                    <TextFieldWithVars
                                        value={d.webhook_slug || ''}
                                        onChange={(v) => update('webhook_slug', v.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase())}
                                        placeholder={`Ex: meu-formulario, pagamento-pix`}
                                        monoFont
                                    />
                                    {!d.webhook_slug && (
                                        <p className="text-[10px] text-amber-500 mt-1">⚠️ Defina um nome para gerar a URL.</p>
                                    )}
                                </ConfigSection>

                                <ConfigSection label="URL do Webhook" hint="Envie dados para esta URL para disparar o fluxo">
                                    <div className="flex gap-2">
                                        <input
                                            readOnly
                                            value={webhookUrl}
                                            className="flex-1 text-xs font-mono bg-muted/50 border border-border rounded-lg px-3 py-2 text-muted-foreground cursor-text select-all focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                        />
                                        <button
                                            onClick={() => navigator.clipboard.writeText(webhookUrl)}
                                            className="px-3 py-2 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors shrink-0"
                                        >
                                            Copiar
                                        </button>
                                    </div>
                                </ConfigSection>

                                <ConfigSection label="Secret (opcional)" hint="Header X-Webhook-Secret para validação">
                                    <TextFieldWithVars
                                        value={d.webhook_secret || ''}
                                        onChange={(v) => update('webhook_secret', v)}
                                        placeholder="meu-secret-seguro-123"
                                        monoFont
                                    />
                                </ConfigSection>

                                <ConfigSection label="Variável de Resposta" hint="Nome da variável para armazenar o body recebido">
                                    <TextFieldWithVars
                                        value={d.response_var || 'webhook_body'}
                                        onChange={(v) => update('response_var', v)}
                                        placeholder="webhook_body"
                                        monoFont
                                    />
                                </ConfigSection>

                                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                                    <p className="text-xs font-semibold text-muted-foreground">📋 Exemplo de chamada:</p>
                                    <pre className="text-[10px] font-mono text-gray-500 bg-white p-3 rounded-lg border border-gray-100 overflow-x-auto whitespace-pre">{`curl -X POST \\
  '${webhookUrl}' \\${d.webhook_secret ? `\n  -H 'X-Webhook-Secret: ${d.webhook_secret}' \\` : ''}
  -H 'Content-Type: application/json' \\
  -d '{
    "customer_name": "João",
    "customer_phone": "+5511999999999",
    "amount": 99.90,
    "status": "approved"
  }'`}</pre>
                                </div>

                                <InfoBanner text="Todos os campos do JSON body ficam disponíveis como variáveis: {{customer_name}}, {{amount}}, etc." color="teal" />
                            </>
                        )}

                        {triggerType === 'webhook_pix' && (
                            <>
                                <ConfigSection label="Evento PIX">
                                    <SelectField
                                        value={d.pix_event || 'pix_created'}
                                        onChange={(v) => update('pix_event', v)}
                                        options={[
                                            { value: 'pix_created', label: 'PIX Criado' },
                                            { value: 'pix_approved', label: 'PIX Aprovado' },
                                            { value: 'pix_refunded', label: 'PIX Estornado' },
                                        ]}
                                    />
                                </ConfigSection>
                                <InfoBanner text="Configure o webhook da sua plataforma de pagamento para enviar para a URL." color="green" />
                                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                                    <p className="text-[10px] font-mono text-muted-foreground break-all">{webhookUrl}</p>
                                </div>
                            </>
                        )}

                        {triggerType === 'webhook_sale' && (
                            <>
                                <ConfigSection label="Plataforma">
                                    <SelectField
                                        value={d.sale_platform || 'hotmart'}
                                        onChange={(v) => update('sale_platform', v)}
                                        options={[
                                            { value: 'hotmart', label: 'Hotmart' },
                                            { value: 'kiwify', label: 'Kiwify' },
                                            { value: 'eduzz', label: 'Eduzz' },
                                            { value: 'monetizze', label: 'Monetizze' },
                                            { value: 'stripe', label: 'Stripe' },
                                            { value: 'other', label: 'Outra' },
                                        ]}
                                    />
                                </ConfigSection>
                                <ConfigSection label="Evento">
                                    <SelectField
                                        value={d.sale_event || 'purchase_approved'}
                                        onChange={(v) => update('sale_event', v)}
                                        options={[
                                            { value: 'purchase_approved', label: 'Compra Aprovada' },
                                            { value: 'purchase_refused', label: 'Compra Recusada' },
                                            { value: 'purchase_refunded', label: 'Reembolso' },
                                            { value: 'subscription_cancellation', label: 'Cancelamento de Assinatura' },
                                        ]}
                                    />
                                </ConfigSection>
                                <InfoBanner text="Configure o postback/webhook na plataforma apontando para a URL gerada." color="purple" />
                                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                                    <p className="text-[10px] font-mono text-muted-foreground break-all">{webhookUrl}</p>
                                </div>
                            </>
                        )}

                        {triggerType === 'contact_created' && (
                            <>
                                <ConfigSection label="Filtro por Tag (opcional)" hint="Trigger apenas se o contato tiver esta tag">
                                    <SelectField
                                        value={(d as any).filter_tag || ''}
                                        onChange={(v) => update('filter_tag', v)}
                                        placeholder="Sem filtro (qualquer contato)"
                                        options={companyTags}
                                    />
                                </ConfigSection>
                                <InfoBanner text="Dispara quando um novo contato é criado no CRM." color="sky" />
                            </>
                        )}

                        {triggerType === 'contact_tag_added' && (
                            <>
                                <ConfigSection label="Tag Específica" hint="Qual tag deve ser adicionada para disparar">
                                    <SelectField
                                        value={(d as any).tag_name || ''}
                                        onChange={(v) => update('tag_name', v)}
                                        placeholder="Selecionar tag..."
                                        options={companyTags}
                                    />
                                </ConfigSection>
                                <InfoBanner text="Dispara quando a tag especificada é adicionada a um contato." color="amber" />
                            </>
                        )}

                        {triggerType === 'manual' && (
                            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                                <p className="text-xs font-semibold text-muted-foreground">🔗 Endpoint da API:</p>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={webhookUrl}
                                        className="flex-1 text-xs font-mono bg-white border border-gray-200 rounded-lg px-3 py-2 text-muted-foreground select-all focus:outline-none"
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                    />
                                    <button
                                        onClick={() => navigator.clipboard.writeText(webhookUrl)}
                                        className="px-3 py-2 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors shrink-0"
                                    >
                                        Copiar
                                    </button>
                                </div>
                                <p className="text-[10px] text-muted-foreground">Chame este endpoint via POST para disparar.</p>
                            </div>
                        )}

                        {triggerType === 'schedule' && (
                            <>
                                <ConfigSection label="Frequência">
                                    <SelectField
                                        value={d.schedule_freq || 'every_day'}
                                        onChange={(v) => update('schedule_freq', v)}
                                        options={SCHEDULE_FREQ_OPTIONS}
                                    />
                                </ConfigSection>
                                {d.schedule_freq === 'custom_cron' ? (
                                    <ConfigSection label="Expressão Cron" hint="Formato: minuto hora dia mês dia-da-semana">
                                        <TextFieldWithVars
                                            value={d.cron_expression || ''}
                                            onChange={(v) => update('cron_expression', v)}
                                            placeholder="0 9 * * 1-5"
                                            monoFont
                                        />
                                    </ConfigSection>
                                ) : (
                                    <ConfigSection label="Horário">
                                        <TextFieldWithVars
                                            value={d.schedule_time || '09:00'}
                                            onChange={(v) => update('schedule_time', v)}
                                            placeholder="09:00"
                                        />
                                    </ConfigSection>
                                )}
                                <InfoBanner text="O agendamento será executado no horário configurado." color="rose" />
                            </>
                        )}
                    </div>
                );
            }

            // ==============================
            // MESSAGES
            // ==============================

            case 'send_message':
            case 'message':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Conteúdo da Mensagem" hint="Use {{contact.name}} para inserir variáveis dinâmicas">
                            <TextFieldWithVars
                                value={d.message || d.content || ''}
                                onChange={(v) => update(node.type === 'message' ? 'content' : 'message', v)}
                                placeholder="Olá {{contact.name}}! Como posso ajudar?"
                                multiline
                            />
                        </ConfigSection>
                        {(d.message || d.content) && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                                <span className="text-[10px] font-bold text-green-500 uppercase mb-1 block">Preview</span>
                                <p className="text-sm text-green-800 whitespace-pre-wrap">{d.message || d.content}</p>
                            </div>
                        )}
                    </div>
                );

            case 'send_image':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Imagem" hint="Faça upload de uma imagem (PNG, JPG, WebP)">
                            <FileUploadField
                                value={d.file_url || ''}
                                onChange={(v) => update('file_url', v)}
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                mediaType="image"
                            />
                        </ConfigSection>
                        <ConfigSection label="Legenda (Opcional)">
                            <TextFieldWithVars value={d.caption || ''} onChange={(v) => update('caption', v)} placeholder="Confira nossa oferta especial!" multiline />
                        </ConfigSection>
                    </div>
                );

            case 'send_audio':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Áudio" hint="Faça upload de um arquivo de áudio (MP3, OGG, WAV)">
                            <FileUploadField
                                value={d.file_url || ''}
                                onChange={(v) => update('file_url', v)}
                                accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/aac"
                                mediaType="audio"
                            />
                        </ConfigSection>
                        <ConfigSection label="Legenda (Opcional)">
                            <TextFieldWithVars value={d.caption || ''} onChange={(v) => update('caption', v)} placeholder="Ouça nosso áudio explicativo" />
                        </ConfigSection>
                    </div>
                );

            case 'send_document':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Documento" hint="Faça upload de um documento (PDF, DOCX, XLSX)">
                            <FileUploadField
                                value={d.file_url || ''}
                                onChange={(v) => update('file_url', v)}
                                accept="application/pdf,application/msword,.docx,.xlsx,.xls,.pptx"
                                mediaType="document"
                            />
                        </ConfigSection>
                        <ConfigSection label="Nome do Arquivo">
                            <Input value={d.file_name || ''} onChange={(e) => update('file_name', e.target.value)} placeholder="proposta-comercial.pdf" className="rounded-xl h-11 bg-muted/50 border-border text-sm" />
                        </ConfigSection>
                        <ConfigSection label="Legenda (Opcional)">
                            <TextFieldWithVars value={d.caption || ''} onChange={(v) => update('caption', v)} placeholder="Segue a proposta anexa" />
                        </ConfigSection>
                    </div>
                );

            case 'send_video':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Vídeo" hint="Faça upload de um vídeo (MP4, MOV)">
                            <FileUploadField
                                value={d.file_url || ''}
                                onChange={(v) => update('file_url', v)}
                                accept="video/mp4,video/quicktime,video/webm"
                                mediaType="video"
                            />
                        </ConfigSection>
                        <ConfigSection label="Legenda (Opcional)">
                            <TextFieldWithVars value={d.caption || ''} onChange={(v) => update('caption', v)} placeholder="Assista nosso vídeo de demonstração" multiline />
                        </ConfigSection>
                    </div>
                );

            // ==============================
            // MARKETING & CAMPAIGNS
            // ==============================

            case 'marketing':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="ID da Campanha" hint="Informe o ID da campanha existente a disparar">
                            <Input
                                value={d.campaign_id || ''}
                                onChange={(e) => update('campaign_id', e.target.value)}
                                placeholder="ID da campanha"
                                className="rounded-xl h-11 bg-muted/50 border-border text-sm"
                            />
                        </ConfigSection>
                        <ConfigSection label="Nome da Campanha (Referência)">
                            <Input
                                value={d.campaign_name || ''}
                                onChange={(e) => update('campaign_name', e.target.value)}
                                placeholder="Ex: Black Friday 2026"
                                className="rounded-xl h-11 bg-muted/50 border-border text-sm"
                            />
                        </ConfigSection>
                        <ConfigSection label="Mensagem da Campanha" hint="Texto da mensagem a enviar. Use {{contact.name}} para variáveis">
                            <TextFieldWithVars
                                value={d.message || ''}
                                onChange={(v) => update('message', v)}
                                placeholder="Olá {{contact.name}}, confira nossa promoção!"
                                multiline
                            />
                        </ConfigSection>
                        <ConfigSection label="Mídia da Campanha (Opcional)" hint="Envie uma imagem, vídeo ou documento junto com a mensagem">
                            <FileUploadField
                                value={d.media_url || ''}
                                onChange={(v) => update('media_url', v)}
                                accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
                                mediaType="image"
                            />
                        </ConfigSection>
                        <ConfigSection label="Descrição (Opcional)">
                            <Textarea
                                value={d.description || ''}
                                onChange={(e) => update('description', e.target.value)}
                                placeholder="Descrição interna da campanha"
                                className="rounded-xl bg-muted/50 border-border text-sm min-h-[60px]"
                            />
                        </ConfigSection>
                    </div>
                );

            // ==============================
            // INTERACTION
            // ==============================

            case 'ask_question':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Pergunta" hint="A mensagem enviada ao contato">
                            <TextFieldWithVars value={d.question || ''} onChange={(v) => update('question', v)} placeholder="Qual serviço você procura?" multiline />
                        </ConfigSection>
                        <ConfigSection label="Opções de Resposta" hint="Botões de resposta rápida que o contato pode clicar">
                            <DynamicListBuilder
                                items={d.options || []}
                                onAdd={() => update('options', [...(d.options || []), ''])}
                                onRemove={(i) => update('options', (d.options || []).filter((_: any, idx: number) => idx !== i))}
                                onUpdate={(i, _, val) => {
                                    const opts = [...(d.options || [])];
                                    opts[i] = val;
                                    update('options', opts);
                                }}
                                addLabel="Adicionar Opção"
                                renderRow={(item, i, onUpdate) => (
                                    <Input
                                        value={item}
                                        onChange={(e) => onUpdate('value', e.target.value)}
                                        placeholder={`Opção ${i + 1}`}
                                        className="rounded-xl h-10 bg-muted/50 border-border text-sm"
                                    />
                                )}
                            />
                        </ConfigSection>
                        <ConfigSection label="Salvar Resposta Em" hint="Nome da variável para armazenar a resposta">
                            <Input value={d.save_to_var || ''} onChange={(e) => update('save_to_var', e.target.value)} placeholder="resposta_servico" className="rounded-xl h-11 bg-muted/50 border-border text-sm font-mono" />
                        </ConfigSection>
                    </div>
                );

            case 'capture_info':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Mensagem para o Contato" hint="O que será enviado pedindo a informação">
                            <TextFieldWithVars value={d.prompt_message || ''} onChange={(v) => update('prompt_message', v)} placeholder="Por favor, informe seu e-mail:" multiline />
                        </ConfigSection>
                        <ConfigSection label="Campo de Destino" hint="Onde a informação será armazenada">
                            <SelectField
                                value={d.field_key || ''}
                                onChange={(v) => update('field_key', v)}
                                placeholder="Selecionar campo..."
                                options={[
                                    { value: 'name', label: 'Nome' },
                                    { value: 'email', label: 'E-mail' },
                                    { value: 'phone', label: 'Telefone' },
                                    { value: 'cpf', label: 'CPF' },
                                    { value: 'company', label: 'Empresa' },
                                    { value: 'custom', label: 'Campo Personalizado' },
                                ]}
                            />
                        </ConfigSection>
                        {d.field_key === 'custom' && (
                            <ConfigSection label="Nome do Campo Personalizado">
                                <Input value={d.custom_field_name || ''} onChange={(e) => update('custom_field_name', e.target.value)} placeholder="meu_campo" className="rounded-xl h-11 bg-muted/50 border-border text-sm font-mono" />
                            </ConfigSection>
                        )}
                        <ConfigSection label="Validação">
                            <SelectField
                                value={d.validation || ''}
                                onChange={(v) => update('validation', v)}
                                placeholder="Sem validação"
                                options={[
                                    { value: 'email', label: 'E-mail válido' },
                                    { value: 'phone', label: 'Telefone válido' },
                                    { value: 'cpf', label: 'CPF válido' },
                                    { value: 'number', label: 'Somente números' },
                                ]}
                            />
                        </ConfigSection>
                    </div>
                );

            case 'wait_response':
                return (
                    <div className="space-y-5">
                        <InfoBanner text="O fluxo será pausado até que o contato responda ou o timeout seja atingido." color="amber" />
                        <ConfigSection label="Timeout" hint="Tempo máximo de espera. 0 = sem timeout.">
                            <div className="flex gap-2">
                                <NumberField value={d.timeout_minutes || 0} onChange={(v) => update('timeout_minutes', parseInt(v) || 0)} min={0} placeholder="0" />
                                <div className="flex items-center px-3 bg-gray-100 rounded-xl text-xs text-gray-500 font-medium border border-gray-200 shrink-0">minutos</div>
                            </div>
                        </ConfigSection>
                        <ConfigSection label="Mensagem de Timeout (Opcional)" hint="Enviada se o timeout for atingido">
                            <TextFieldWithVars value={d.timeout_message || ''} onChange={(v) => update('timeout_message', v)} placeholder="Desculpe, não recebi sua resposta a tempo." multiline />
                        </ConfigSection>
                    </div>
                );

            // ==============================
            // LOGIC
            // ==============================

            case 'condition':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Tipo de Condição">
                            <SelectField value={d.condition_type || ''} onChange={(v) => update('condition_type', v)} placeholder="Selecionar condição..." options={CONDITION_TYPE_OPTIONS} />
                        </ConfigSection>
                        {(d as any).condition_type && (d as any).condition_type !== 'is_assigned' && (
                            <ConfigSection label="Valor" hint="O valor a ser comparado">
                                {(d as any).condition_type === 'has_tag' ? (
                                    <SelectField
                                        value={(d as any).condition_value || ''}
                                        onChange={(v) => update('condition_value', v)}
                                        placeholder="Selecionar tag..."
                                        options={companyTags}
                                    />
                                ) : (
                                    <TextFieldWithVars value={(d as any).condition_value || ''} onChange={(v) => update('condition_value', v)} placeholder="Ex: lead_qualificado" />
                                )}
                            </ConfigSection>
                        )}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                                <span className="text-[10px] font-black text-emerald-600 tracking-wider">✓ SIM</span>
                                <p className="text-[10px] text-emerald-600 mt-0.5">Condição verdadeira</p>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                                <span className="text-[10px] font-black text-red-500 tracking-wider">✕ NÃO</span>
                                <p className="text-[10px] text-red-500 mt-0.5">Condição falsa</p>
                            </div>
                        </div>
                    </div>
                );

            case 'filter':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Modo de Correspondência">
                            <SelectField
                                value={d.match_mode || 'all'}
                                onChange={(v) => update('match_mode', v)}
                                options={[
                                    { value: 'all', label: 'TODAS as condições (AND)' },
                                    { value: 'any', label: 'QUALQUER condição (OR)' },
                                ]}
                            />
                        </ConfigSection>
                        <ConfigSection label="Condições" hint="Defina as regras de filtragem">
                            <DynamicListBuilder
                                items={d.conditions || []}
                                onAdd={() => update('conditions', [...(d.conditions || []), { field: '', operator: 'equals', value: '' }])}
                                onRemove={(i) => update('conditions', (d.conditions || []).filter((_: any, idx: number) => idx !== i))}
                                onUpdate={(i, field, val) => {
                                    const conds = [...(d.conditions || [])];
                                    conds[i] = { ...conds[i], [field]: val };
                                    update('conditions', conds);
                                }}
                                addLabel="Adicionar Condição"
                                renderRow={(item, i, onUpdate) => (
                                    <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                                        <Input value={item.field || ''} onChange={(e) => onUpdate('field', e.target.value)} placeholder="Campo (ex: last_response)" className="rounded-lg h-9 bg-muted/50 border-border text-xs font-mono" />
                                        <SelectField value={item.operator || 'equals'} onChange={(v) => onUpdate('operator', v)} options={OPERATOR_OPTIONS} />
                                        {!['is_empty', 'is_not_empty'].includes(item.operator) && (
                                            <Input value={item.value || ''} onChange={(e) => onUpdate('value', e.target.value)} placeholder="Valor" className="rounded-lg h-9 bg-muted/50 border-border text-xs" />
                                        )}
                                    </div>
                                )}
                            />
                        </ConfigSection>
                    </div>
                );

            case 'router':
                return (
                    <div className="space-y-5">
                        <InfoBanner text="Cada rota gera uma saída separada. O contato segue pela primeira rota que corresponder. Se nenhuma corresponder, vai para 'Padrão'." />
                        <ConfigSection label="Rotas" hint="Defina as regras de roteamento">
                            <DynamicListBuilder
                                items={d.rules || []}
                                onAdd={() => update('rules', [...(d.rules || []), { field: '', operator: 'equals', value: '', outputName: '' }])}
                                onRemove={(i) => update('rules', (d.rules || []).filter((_: any, idx: number) => idx !== i))}
                                onUpdate={(i, field, val) => {
                                    const rules = [...(d.rules || [])];
                                    rules[i] = { ...rules[i], [field]: val };
                                    update('rules', rules);
                                }}
                                addLabel="Adicionar Rota"
                                renderRow={(item, i, onUpdate) => (
                                    <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                                        <Input value={item.outputName || ''} onChange={(e) => onUpdate('outputName', e.target.value)} placeholder={`Nome da Rota ${i + 1}`} className="rounded-lg h-9 bg-muted/50 border-border text-xs font-bold" />
                                        <Input value={item.field || ''} onChange={(e) => onUpdate('field', e.target.value)} placeholder="Campo" className="rounded-lg h-9 bg-muted/50 border-border text-xs font-mono" />
                                        <SelectField value={item.operator || 'equals'} onChange={(v) => onUpdate('operator', v)} options={OPERATOR_OPTIONS} />
                                        <Input value={item.value || ''} onChange={(e) => onUpdate('value', e.target.value)} placeholder="Valor" className="rounded-lg h-9 bg-muted/50 border-border text-xs" />
                                    </div>
                                )}
                            />
                        </ConfigSection>
                    </div>
                );

            case 'delay':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Tempo de Espera">
                            <div className="flex gap-2">
                                <NumberField value={d.amount || '5'} onChange={(v) => update('amount', v)} min={1} />
                                <SelectField value={d.unit || 'minutes'} onChange={(v) => update('unit', v)} options={TIME_UNIT_OPTIONS} />
                            </div>
                        </ConfigSection>
                        <InfoBanner text="O fluxo será pausado pelo tempo especificado e depois continuará automaticamente." color="blue" />
                    </div>
                );

            // ==============================
            // CRM & ACTIONS
            // ==============================

            case 'crm_move':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Funil de Destino">
                            <SelectField
                                value={(d as any).funnel_name || ''}
                                onChange={(v) => {
                                    const board = kanbanBoards.find((b: any) => b.id === v || b.name === v);
                                    updateMulti({ funnel_name: v, funnel_id: board?.id || v, stage_name: '', stage_id: '' });
                                }}
                                placeholder="Selecionar funil..."
                                options={kanbanBoards.map((b: any) => ({ value: b.name || b.id, label: b.name || b.id }))}
                            />
                        </ConfigSection>
                        <ConfigSection label="Etapa de Destino">
                            {selectedBoardStages.length > 0 ? (
                                <SelectField
                                    value={(d as any).stage_name || ''}
                                    onChange={(v) => updateMulti({ stage_name: v, stage_id: v })}
                                    placeholder="Selecionar etapa..."
                                    options={selectedBoardStages}
                                />
                            ) : (
                                <Input value={(d as any).stage_name || ''} onChange={(e) => updateMulti({ stage_name: e.target.value, stage_id: e.target.value })} placeholder={kanbanBoards.length > 0 ? 'Selecione um funil primeiro' : 'Carregando funis...'} className="rounded-xl h-11 bg-muted/50 border-border text-sm" />
                            )}
                        </ConfigSection>
                    </div>
                );

            case 'assign_user':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Tipo de Atribuição">
                            <SelectField
                                value={d.assign_type || 'user'}
                                onChange={(v) => update('assign_type', v)}
                                options={[
                                    { value: 'user', label: '👤 Agente Específico' },
                                    { value: 'team', label: '👥 Equipe Inteira' },
                                    { value: 'random_in_team', label: '🎲 Aleatório na Equipe (Roleta)' },
                                ]}
                            />
                        </ConfigSection>

                        {(!d.assign_type || d.assign_type === 'user') && (
                            <ConfigSection label="Selecionar Agente">
                                <SelectField
                                    value={d.user_id || ''}
                                    onChange={(v) => update('user_id', v)}
                                    placeholder="Escolha um agente..."
                                    options={companyUsers.map((u: any) => ({ value: u.id, label: u.name || u.email }))}
                                />
                            </ConfigSection>
                        )}

                        {(d.assign_type === 'team' || d.assign_type === 'random_in_team') && (
                            <ConfigSection label="Selecionar Equipe">
                                <SelectField
                                    value={d.team_id || ''}
                                    onChange={(v) => updateMulti({ team_id: v, agent_weights: d.assign_type === 'random_in_team' ? [] : undefined })}
                                    placeholder="Escolha uma equipe..."
                                    options={companyTeams.map((t: any) => ({ value: t.id, label: t.name }))}
                                />
                            </ConfigSection>
                        )}

                        {d.assign_type === 'random_in_team' && d.team_id && (
                            <ConfigSection label="Distribuição de Leads (%)" hint="Defina a porcentagem para cada atendente (a soma deve dar 100%)">
                                <div className="space-y-3 bg-fuchsia-50/50 p-4 rounded-xl border border-fuchsia-100">
                                    <InfoBanner text="Lembre-se de ajustar para que a soma chegue a 100%." color="blue" />
                                    {/* Componente simples de lista de pesos */}
                                    <DynamicListBuilder
                                        items={Array.isArray(d.agent_weights) ? d.agent_weights : []}
                                        onAdd={() => update('agent_weights', [...(Array.isArray(d.agent_weights) ? d.agent_weights : []), { user_id: '', weight: 0 }])}
                                        onRemove={(i) => update('agent_weights', (Array.isArray(d.agent_weights) ? d.agent_weights : []).filter((_: any, idx: number) => idx !== i))}
                                        onUpdate={(i, field, val) => {
                                            const w = [...(Array.isArray(d.agent_weights) ? d.agent_weights : [])];
                                            w[i] = { ...w[i], [field]: field === 'weight' ? Number(val) : val };
                                            update('agent_weights', w);
                                        }}
                                        addLabel="Adicionar Agente na Roleta"
                                        renderRow={(item, i, onUpdate) => (
                                            <div className="flex gap-2 w-full">
                                                <div className="flex-1">
                                                    <SelectField
                                                        value={item.user_id || ''}
                                                        onChange={(v) => onUpdate('user_id', v)}
                                                        placeholder="Selecionar agente..."
                                                        options={companyUsers.map((u: any) => ({ value: u.id, label: u.name || u.email }))}
                                                    />
                                                </div>
                                                <div className="w-24 relative flex items-center">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={item.weight || ''}
                                                        onChange={(e) => onUpdate('weight', e.target.value)}
                                                        placeholder="0"
                                                        className="rounded-xl h-11 bg-white border-border text-sm pr-6"
                                                    />
                                                    <span className="absolute right-3 text-xs text-gray-400 font-bold">%</span>
                                                </div>
                                            </div>
                                        )}
                                    />
                                    <div className="flex justify-between items-center px-2 pt-2 border-t border-fuchsia-100">
                                        <span className="text-xs font-semibold text-gray-500">Soma Total:</span>
                                        <span className={`text-sm font-black ${(Array.isArray(d.agent_weights) ? d.agent_weights : []).reduce((acc: number, item: any) => acc + (Number(item.weight) || 0), 0) === 100 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {(Array.isArray(d.agent_weights) ? d.agent_weights : []).reduce((acc: number, item: any) => acc + (Number(item.weight) || 0), 0)}%
                                        </span>
                                    </div>
                                </div>
                            </ConfigSection>
                        )}
                    </div>
                );

            case 'bot_toggle':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Ação do Bot">
                            <ToggleSwitch
                                label={d.action === 'enable' ? '🤖 Bot ATIVADO' : '🔴 Bot DESATIVADO'}
                                checked={d.action === 'enable'}
                                onChange={(v) => update('action', v ? 'enable' : 'disable')}
                                color={d.action === 'enable' ? 'green' : 'red'}
                            />
                        </ConfigSection>
                        <InfoBanner text={d.action === 'enable' ? 'O bot de IA voltará a responder automaticamente nesta conversa.' : 'O bot será desativado. O atendimento passará para um humano.'} color={d.action === 'enable' ? 'green' : 'amber'} />
                    </div>
                );

            case 'stop_bot':
                return (
                    <div className="space-y-5">
                        <InfoBanner text="Este nó encerra permanentemente a automação para este contato. Nenhuma ação posterior será executada." color="red" />
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                            <ShieldOff className="h-8 w-8 text-red-500 mx-auto mb-2" />
                            <p className="text-sm font-bold text-red-500">Automação Encerrada</p>
                            <p className="text-[10px] text-red-500 mt-1">Nó terminal — sem saídas</p>
                        </div>
                    </div>
                );

            case 'loop_restart':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Delay Antes de Reiniciar" hint="Tempo de espera antes de voltar ao início do fluxo">
                            <div className="flex gap-2">
                                <NumberField value={d.delay_amount || 1} onChange={(v) => update('delay_amount', parseInt(v) || 1)} min={1} />
                                <SelectField value={d.delay_unit || 'hours'} onChange={(v) => update('delay_unit', v)} options={TIME_UNIT_OPTIONS.filter(o => o.value !== 'seconds')} />
                            </div>
                        </ConfigSection>
                        <InfoBanner text="Após o delay, o fluxo reiniciará do gatilho. Útil para follow-ups periódicos." color="amber" />
                    </div>
                );

            // ==============================
            // LOOKUP LEAD
            // ==============================

            case 'lookup_lead':
                return (
                    <div className="space-y-5">
                        <InfoBanner text="Busca o lead na base pelo número de telefone. Normaliza automaticamente com/sem +55 e com/sem o 9." color="cyan" />
                        <ConfigSection label="Variável do Telefone" hint="Campo do webhook ou variável com o número (ex: customer_phone)">
                            <TextFieldWithVars
                                value={d.phone_variable || ''}
                                onChange={(v) => update('phone_variable', v)}
                                placeholder="customer_phone"
                                monoFont
                            />
                        </ConfigSection>
                        <ToggleSwitch
                            label="Criar lead automaticamente se não existir"
                            checked={d.auto_create !== false}
                            onChange={(v) => update('auto_create', v)}
                            color="cyan"
                        />
                        {d.auto_create !== false && (
                            <ConfigSection label="Nome padrão do lead" hint="Usado quando o lead é criado automaticamente">
                                <TextFieldWithVars
                                    value={d.default_name || ''}
                                    onChange={(v) => update('default_name', v)}
                                    placeholder="{{customer_name}} ou Lead Webhook"
                                />
                            </ConfigSection>
                        )}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                                <span className="text-[10px] font-black text-emerald-600 tracking-wider">✓ ENCONTRADO</span>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                                <span className="text-[10px] font-black text-amber-600 tracking-wider">+ NOVO / NÃO ENCONTRADO</span>
                            </div>
                        </div>
                    </div>
                );

            // ==============================
            // SEND TEMPLATE
            // ==============================

            case 'send_template': {
                const selectedTemplate = approvedTemplates.find(t => t.name === d.template_name);

                return (
                    <div className="space-y-5">
                        <InfoBanner text="Envia um template aprovado da API Oficial WhatsApp para abrir a janela de 24 horas." color="green" />
                        <ConfigSection label="Template Aprovado" hint="Selecione um template aprovado na Meta Business">
                            <select
                                value={d.template_name || ''}
                                onChange={(e) => {
                                    const tpl = approvedTemplates.find(t => t.name === e.target.value);
                                    update('template_name', e.target.value);
                                    if (tpl) {
                                        update('template_language', tpl.language || 'pt_BR');
                                        update('template_id', tpl.id);
                                        update('template_connection_id', tpl.connectionId);
                                        // Extrair número de variáveis dos components
                                        const components = tpl.components || [];
                                        const bodyComp = components.find((c: any) => c.type === 'BODY');
                                        if (bodyComp?.text) {
                                            const matches = bodyComp.text.match(/\{\{\d+\}\}/g);
                                            const varCount = matches ? matches.length : 0;
                                            const currentVars = d.template_variables || [];
                                            if (currentVars.length !== varCount) {
                                                const newVars = Array.from({ length: varCount }, (_, i) => ({
                                                    key: `{{${i + 1}}}`,
                                                    value: currentVars[i]?.value || '',
                                                }));
                                                update('template_variables', newVars);
                                            }
                                        }
                                    }
                                }}
                                className="w-full h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                            >
                                <option value="">{loadingTemplates ? 'Carregando...' : 'Selecione um template'}</option>
                                {approvedTemplates.map(tpl => (
                                    <option key={tpl.id} value={tpl.name}>
                                        {tpl.displayName || tpl.name} — {tpl.language} ({tpl.connection?.name || tpl.connectionId?.slice(0, 8)})
                                    </option>
                                ))}
                            </select>
                        </ConfigSection>
                        {selectedTemplate && (
                            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3">
                                <div className="text-[10px] font-black uppercase text-emerald-600 tracking-wider mb-1">Preview do Template</div>
                                <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                                    {(() => {
                                        const bodyComp = (selectedTemplate.components || []).find((c: any) => c.type === 'BODY');
                                        return bodyComp?.text || '(sem corpo)';
                                    })()}
                                </div>
                                <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                                    <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">{selectedTemplate.status}</span>
                                    <span>{selectedTemplate.category}</span>
                                    <span>{selectedTemplate.language}</span>
                                </div>
                            </div>
                        )}
                        <ConfigSection label="Idioma do Template">
                            <SelectField
                                value={d.template_language || 'pt_BR'}
                                onChange={(v) => update('template_language', v)}
                                options={[
                                    { value: 'pt_BR', label: 'Português (BR)' },
                                    { value: 'en_US', label: 'English (US)' },
                                    { value: 'es', label: 'Español' },
                                ]}
                            />
                        </ConfigSection>
                        <ConfigSection label="Conexão WhatsApp API" hint="Selecione qual conexão da API Oficial será usada para enviar">
                            <select
                                value={d.template_connection_id || ''}
                                onChange={(e) => update('template_connection_id', e.target.value)}
                                className="w-full h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                            >
                                <option value="">Usar conexão padrão do template</option>
                                {metaConnections.map((conn: any) => (
                                    <option key={conn.id} value={conn.id}>
                                        {conn.configName || conn.config_name || conn.id.slice(0, 8)} — {conn.phoneNumberId || conn.phone_number_id || 'sem número'}
                                    </option>
                                ))}
                            </select>
                        </ConfigSection>
                        <ConfigSection label="Variáveis do Template" hint="Valores para {{1}}, {{2}}, etc no template">
                            <DynamicListBuilder
                                items={d.template_variables || []}
                                onAdd={() => update('template_variables', [...(d.template_variables || []), { key: '', value: '' }])}
                                onRemove={(i) => update('template_variables', (d.template_variables || []).filter((_: any, idx: number) => idx !== i))}
                                onUpdate={(i, field, val) => {
                                    const vars = [...(d.template_variables || [])];
                                    vars[i] = { ...vars[i], [field]: val };
                                    update('template_variables', vars);
                                }}
                                addLabel="Adicionar Variável"
                                renderRow={(item, i, onUpdate) => (
                                    <div className="flex gap-1.5">
                                        <span className="flex items-center text-muted-foreground text-xs font-mono px-1 min-w-[32px]">{`{{${i + 1}}}`}</span>
                                        <Input
                                            value={item.value || ''}
                                            onChange={(e) => onUpdate('value', e.target.value)}
                                            placeholder={`Valor para {{${i + 1}}}`}
                                            className="rounded-lg h-9 bg-muted/50 border-border text-xs flex-1"
                                        />
                                    </div>
                                )}
                            />
                        </ConfigSection>
                    </div>
                );
            }

            // ==============================
            // AI AGENT V2
            // ==============================

            case 'ai_agent':
            case 'ai': {
                const aiTab = d._config_tab || 'params';
                const googleCalendarEnabled = d.google_calendar_enabled || false;
                const googleMeetEnabled = d.google_meet_enabled || false;
                const appointmentDuration = d.appointment_duration || 30;
                const workingHoursStart = d.working_hours_start || 9;
                const workingHoursEnd = d.working_hours_end || 18;
                const calendarInstruction = d.calendar_instruction || '';
                
                return (
                    <div className="space-y-5">
                        {/* Tab Selector */}
                        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                            {[
                                { id: 'params', label: 'Parâmetros' },
                                { id: 'input', label: 'Input' },
                                { id: 'config', label: 'Configurações' },
                                { id: 'agenda', label: 'Agenda' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => update('_config_tab', tab.id)}
                                    className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${aiTab === tab.id
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-gray-500 hover:text-foreground'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab: Parâmetros */}
                        {aiTab === 'params' && (
                            <div className="space-y-5">
                                <ConfigSection label="Provedor de IA">
                                    <SelectField value={d.provider || 'gemini'} onChange={(v) => updateMulti({ provider: v, model: (AI_MODEL_OPTIONS[v] || [])[0]?.value || '' })} options={AI_PROVIDER_OPTIONS} />
                                </ConfigSection>
                                <ConfigSection label="Modelo">
                                    <SelectField value={d.model || ''} onChange={(v) => update('model', v)} options={AI_MODEL_OPTIONS[d.provider || 'gemini'] || AI_MODEL_OPTIONS.gemini} />
                                </ConfigSection>
                                <ConfigSection label="System Prompt" hint="Personalidade, instruções e objetivo do agente IA">
                                    <TextFieldWithVars
                                        value={d.system_message || d.description || d.systemPrompt || ''}
                                        onChange={(v) => update(node.type === 'ai' ? 'description' : 'system_message', v)}
                                        placeholder="Você é um assistente de vendas especializado em..."
                                        multiline
                                    />
                                </ConfigSection>
                                <ConfigSection label="Temperatura (Criatividade)">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={0}
                                            max={1}
                                            step={0.1}
                                            value={d.temperature ?? 0.7}
                                            onChange={(e) => update('temperature', parseFloat(e.target.value))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                                        />
                                        <span className="text-sm font-mono font-bold text-violet-600 min-w-[36px] text-center">{(d.temperature ?? 0.7).toFixed(1)}</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">0.0 = Focado e preciso · 1.0 = Criativo e variado</p>
                                </ConfigSection>
                            </div>
                        )}

                        {/* Tab: Input */}
                        {aiTab === 'input' && (
                            <div className="space-y-5">
                                <InfoBanner text="Configure como o input do agente será composto. O input final será: mensagem do lead + dados do webhook + histórico." color="indigo" />
                                <ToggleSwitch
                                    label="📩 Incluir mensagem do lead"
                                    checked={d.include_lead_message !== false}
                                    onChange={(v) => update('include_lead_message', v)}
                                    color="blue"
                                />
                                <ToggleSwitch
                                    label="🔗 Incluir variáveis do webhook"
                                    checked={!!d.include_webhook_vars}
                                    onChange={(v) => update('include_webhook_vars', v)}
                                    color="teal"
                                />
                                {d.include_webhook_vars && (
                                    <ConfigSection label="Campos do Webhook" hint="Lista de chaves do payload webhook para incluir no input da IA">
                                        <DynamicListBuilder
                                            items={(d.webhook_var_keys || []).map((k: string) => ({ value: k }))}
                                            onAdd={() => update('webhook_var_keys', [...(d.webhook_var_keys || []), ''])}
                                            onRemove={(i) => update('webhook_var_keys', (d.webhook_var_keys || []).filter((_: any, idx: number) => idx !== i))}
                                            onUpdate={(i, _, val) => {
                                                const keys = [...(d.webhook_var_keys || [])];
                                                keys[i] = val;
                                                update('webhook_var_keys', keys);
                                            }}
                                            addLabel="Adicionar Campo"
                                            renderRow={(item, i, onUpdate) => (
                                                <Input
                                                    value={item.value || ''}
                                                    onChange={(e) => onUpdate('value', e.target.value)}
                                                    placeholder={`Campo ${i + 1} (ex: customer_name, amount)`}
                                                    className="rounded-xl h-10 bg-muted/50 border-border text-sm font-mono"
                                                />
                                            )}
                                        />
                                    </ConfigSection>
                                )}
                                <ToggleSwitch
                                    label="📜 Incluir histórico de chat"
                                    checked={d.include_history !== false}
                                    onChange={(v) => update('include_history', v)}
                                    color="violet"
                                />
                                {d.include_history !== false && (
                                    <ConfigSection label="Quantidade de mensagens de contexto" hint="Últimas N mensagens da conversa com o lead">
                                        <NumberField
                                            value={d.history_count || 10}
                                            onChange={(v) => update('history_count', parseInt(v) || 10)}
                                            min={1}
                                            max={50}
                                        />
                                    </ConfigSection>
                                )}
                            </div>
                        )}

                        {/* Tab: Configurações */}
                        {aiTab === 'config' && (
                            <div className="space-y-5">
                                <ConfigSection label="Conexão WhatsApp API" hint="Selecione qual conexão da API Oficial será usada para enviar as mensagens do agente">
                                    <select
                                        value={d.connection_id || ''}
                                        onChange={(e) => update('connection_id', e.target.value)}
                                        className="w-full h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                    >
                                        <option value="">Usar conexão ativa padrão</option>
                                        {metaConnections.map((conn: any) => (
                                            <option key={conn.id} value={conn.id}>
                                                {conn.config_name || conn.id.slice(0, 8)} — {conn.phoneNumberId || conn.phone_number_id || 'sem número'}
                                            </option>
                                        ))}
                                    </select>
                                </ConfigSection>
                                <ToggleSwitch label="🔁 Modo Diálogo (multi-turn)" checked={!!d.dialogue_mode} onChange={(v) => update('dialogue_mode', v)} color="violet" />
                                {d.dialogue_mode && (
                                    <>
                                        <ConfigSection label="Condição de Conclusão" hint="Descreva quando o objetivo do agente foi atingido. A IA avaliará a cada turno.">
                                            <TextFieldWithVars
                                                value={d.completion_condition || ''}
                                                onChange={(v) => update('completion_condition', v)}
                                                placeholder="O lead confirmou o agendamento da reunião"
                                                multiline
                                            />
                                        </ConfigSection>
                                        <ConfigSection label="Máximo de Turnos" hint="Limite de mensagens antes de forçar a saída do diálogo">
                                            <NumberField
                                                value={d.max_turns || 10}
                                                onChange={(v) => update('max_turns', parseInt(v) || 10)}
                                                min={1}
                                                max={100}
                                            />
                                        </ConfigSection>
                                        <InfoBanner text="O fluxo ficará travado neste nó até o objetivo ser cumprido ou o limite de turnos ser atingido. Cada mensagem do lead conta como 1 turno." color="violet" />
                                        <div className="grid grid-cols-2 gap-3 pt-2">
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                                                <span className="text-[10px] font-black text-emerald-600 tracking-wider">✓ CONCLUÍDO</span>
                                            </div>
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                                                <span className="text-[10px] font-black text-amber-600 tracking-wider">⚠ MAX TURNOS</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                                <ToggleSwitch label="⏱ Timeout de Resposta" checked={!!d.response_timeout_enabled} onChange={(v) => update('response_timeout_enabled', v)} />
                                {d.response_timeout_enabled && (
                                    <ConfigSection label="Timeout (minutos)">
                                        <NumberField value={d.response_timeout_minutes || 5} onChange={(v) => update('response_timeout_minutes', parseInt(v) || 5)} min={1} />
                                    </ConfigSection>
                                )}
                            </div>
                        )}
                        
                        {/* AGENDA TAB */}
                        {aiTab === 'agenda' && (
                            <div className="space-y-4">
                                <InfoBanner text="Permita que o agente consulte, crie, edite e cancele eventos no Google Calendar de forma autônoma durante a conversa." color="blue" />
                                
                                {/* Connection Status */}
                                {googleCalendarStatus === null ? (
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground p-2">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando conexão...
                                    </div>
                                ) : googleCalendarStatus.connected ? (
                                    <div className="flex items-center gap-3 rounded-xl bg-emerald-50/50 px-3 py-2.5 border border-emerald-100">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                        <div>
                                            <p className="text-xs font-semibold text-emerald-900">Google Agenda conectada</p>
                                            <p className="text-[10px] text-emerald-600/80">{googleCalendarStatus.calendarName || 'Agenda principal'}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 rounded-xl bg-amber-50/50 px-3 py-2.5 border border-amber-100">
                                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                        <div>
                                            <p className="text-xs font-semibold text-amber-900">Google Agenda não conectada</p>
                                            <p className="text-[10px] text-amber-600/80">Conecte em Configurações &rarr; Integrações para usar.</p>
                                        </div>
                                    </div>
                                )}
                                
                                <ToggleSwitch 
                                    label="🗓️ Ativar Agenda no Agente" 
                                    checked={googleCalendarEnabled} 
                                    onChange={(v) => update('google_calendar_enabled', v)} 
                                    color="blue"
                                    disabled={!googleCalendarStatus?.connected}
                                />
                                
                                {googleCalendarEnabled && googleCalendarStatus?.connected && (
                                    <div className="space-y-5 pl-3 border-l-2 border-blue-100 ml-1.5 pt-2">
                                        <ToggleSwitch 
                                            label="🎥 Gerar link do Google Meet ao agendar" 
                                            checked={googleMeetEnabled} 
                                            onChange={(v) => update('google_meet_enabled', v)} 
                                            color="emerald" 
                                        />
                                        
                                        <ConfigSection label="Duração padrão (minutos)" hint="Duração dos eventos criados pelo agente">
                                            <NumberField 
                                                value={appointmentDuration} 
                                                onChange={(v) => update('appointment_duration', parseInt(v) || 30)} 
                                                min={15} max={480} step={15} 
                                            />
                                        </ConfigSection>
                                        
                                        <ConfigSection label="Horário de Atendimento" hint="Período em que o agente pode agendar">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1">
                                                    <NumberField 
                                                        value={workingHoursStart} 
                                                        onChange={(v) => update('working_hours_start', parseInt(v) || 9)} 
                                                        min={0} max={23} 
                                                    />
                                                </div>
                                                <span className="text-sm text-muted-foreground font-medium">às</span>
                                                <div className="flex-1">
                                                    <NumberField 
                                                        value={workingHoursEnd} 
                                                        onChange={(v) => update('working_hours_end', parseInt(v) || 18)} 
                                                        min={1} max={24} 
                                                    />
                                                </div>
                                            </div>
                                        </ConfigSection>
                                        
                                        <ConfigSection label="Instrução para o Agente (Opcional)" hint="Regras adicionais. Ex: 'Agende apenas à tarde.'">
                                            <Textarea
                                                value={calendarInstruction}
                                                onChange={(e) => update('calendar_instruction', e.target.value)}
                                                className="text-xs min-h-[80px] rounded-xl bg-muted/30 border-border nodrag nowheel"
                                                placeholder="Ex: Confirme sempre o nome do paciente antes de agendar."
                                            />
                                        </ConfigSection>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            }

            case 'intent_router':
                return (
                    <div className="space-y-5">
                        <InfoBanner text="A IA classificará a mensagem do contato em uma das intenções definidas. Cada intenção gera uma saída separada." color="blue" />
                        <ConfigSection label="Intenções" hint="Adicione as categorias de intenção que a IA deve classificar">
                            <DynamicListBuilder
                                items={(d.intents || []).map((intent: string) => ({ value: intent }))}
                                onAdd={() => update('intents', [...(d.intents || []), ''])}
                                onRemove={(i) => update('intents', (d.intents || []).filter((_: any, idx: number) => idx !== i))}
                                onUpdate={(i, _, val) => {
                                    const intents = [...(d.intents || [])];
                                    intents[i] = val;
                                    update('intents', intents);
                                }}
                                addLabel="Adicionar Intenção"
                                renderRow={(item, i, onUpdate) => (
                                    <Input
                                        value={item.value || ''}
                                        onChange={(e) => onUpdate('value', e.target.value)}
                                        placeholder={`Intenção ${i + 1} (ex: comprar, suporte, info)`}
                                        className="rounded-xl h-10 bg-muted/50 border-border text-sm"
                                    />
                                )}
                            />
                        </ConfigSection>
                    </div>
                );

            case 'follow_up_ai':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Prompt de Follow-Up" hint="Mensagem gerada por IA para reengajar o contato">
                            <TextFieldWithVars value={d.followup_prompt || ''} onChange={(v) => update('followup_prompt', v)} placeholder="Gere uma mensagem amigável perguntando se o contato ainda precisa de ajuda..." multiline />
                        </ConfigSection>
                        <ConfigSection label="Delay de Resposta (minutos)" hint="Tempo de espera antes de considerar 'não respondeu'">
                            <NumberField value={d.response_timeout_minutes || 60} onChange={(v) => update('response_timeout_minutes', parseInt(v) || 60)} min={1} />
                        </ConfigSection>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                                <span className="text-[10px] font-black text-emerald-600 tracking-wider">✓ RESPONDEU</span>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                                <span className="text-[10px] font-black text-red-500 tracking-wider">✕ NÃO RESP.</span>
                            </div>
                        </div>
                    </div>
                );

            case 'send_ai_response':
                return (
                    <div className="space-y-5">
                        <InfoBanner text="Envia a resposta gerada pelo último nó de IA para o contato via WhatsApp." color="green" />
                        <ToggleSwitch label="Dividir mensagem em partes" checked={d.split_enabled !== false} onChange={(v) => update('split_enabled', v)} color="green" />
                        {d.split_enabled !== false && (
                            <ConfigSection label="Delay entre partes (segundos)" hint="Simula digitação humana">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min={1}
                                        max={10}
                                        step={1}
                                        value={d.delay_seconds || 2}
                                        onChange={(e) => update('delay_seconds', parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                                    />
                                    <span className="text-sm font-mono font-bold text-green-600 min-w-[30px] text-center">{d.delay_seconds || 2}s</span>
                                </div>
                            </ConfigSection>
                        )}
                    </div>
                );

            // ==============================
            // ADVANCED
            // ==============================

            case 'http_request':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Método HTTP">
                            <SelectField value={d.method || 'GET'} onChange={(v) => update('method', v)} options={HTTP_METHOD_OPTIONS} />
                        </ConfigSection>
                        <ConfigSection label="URL" hint="Endpoint da API. Use {{variavel}} para valores dinâmicos">
                            <TextFieldWithVars value={d.url || ''} onChange={(v) => update('url', v)} placeholder="https://api.exemplo.com/dados/{{contact.phone}}" monoFont />
                        </ConfigSection>

                        {/* Headers */}
                        <ConfigSection label="Headers" hint="Headers HTTP customizados enviados com a requisição">
                            <DynamicListBuilder
                                items={d.headers || []}
                                onAdd={() => update('headers', [...(d.headers || []), { key: '', value: '' }])}
                                onRemove={(i) => update('headers', (d.headers || []).filter((_: any, idx: number) => idx !== i))}
                                onUpdate={(i, field, val) => {
                                    const hdrs = [...(d.headers || [])];
                                    hdrs[i] = { ...hdrs[i], [field]: val };
                                    update('headers', hdrs);
                                }}
                                addLabel="Adicionar Header"
                                renderRow={(item, _i, onUpdate) => (
                                    <div className="flex gap-1.5">
                                        <Input value={item.key || ''} onChange={(e) => onUpdate('key', e.target.value)} placeholder="Content-Type" className="rounded-lg h-9 bg-muted/50 border-border text-xs font-mono flex-1" />
                                        <span className="flex items-center text-muted-foreground text-xs px-0.5">:</span>
                                        <Input value={item.value || ''} onChange={(e) => onUpdate('value', e.target.value)} placeholder="application/json" className="rounded-lg h-9 bg-muted/50 border-border text-xs font-mono flex-1" />
                                    </div>
                                )}
                            />
                        </ConfigSection>

                        {/* Auth */}
                        <ConfigSection label="Autenticação">
                            <SelectField value={d.auth_type || 'none'} onChange={(v) => update('auth_type', v)} options={AUTH_OPTIONS} />
                        </ConfigSection>
                        {d.auth_type === 'bearer' && (
                            <ConfigSection label="Bearer Token">
                                <Input value={d.auth_token || ''} onChange={(e) => update('auth_token', e.target.value)} placeholder="sk-..." type="password" className="rounded-xl h-11 bg-muted/50 border-border text-sm font-mono" />
                            </ConfigSection>
                        )}
                        {d.auth_type === 'api_key' && (
                            <>
                                <ConfigSection label="Nome do Header">
                                    <Input value={d.auth_header_name || ''} onChange={(e) => update('auth_header_name', e.target.value)} placeholder="X-API-Key" className="rounded-xl h-11 bg-muted/50 border-border text-sm font-mono" />
                                </ConfigSection>
                                <ConfigSection label="Valor do Header">
                                    <Input value={d.auth_token || ''} onChange={(e) => update('auth_token', e.target.value)} placeholder="abc123..." type="password" className="rounded-xl h-11 bg-muted/50 border-border text-sm font-mono" />
                                </ConfigSection>
                            </>
                        )}
                        {d.auth_type === 'basic' && (
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <ConfigSection label="Usuário">
                                        <Input value={d.auth_user || ''} onChange={(e) => update('auth_user', e.target.value)} placeholder="user" className="rounded-xl h-11 bg-muted/50 border-border text-sm font-mono" />
                                    </ConfigSection>
                                </div>
                                <div className="flex-1">
                                    <ConfigSection label="Senha">
                                        <Input value={d.auth_pass || ''} onChange={(e) => update('auth_pass', e.target.value)} placeholder="••••" type="password" className="rounded-xl h-11 bg-muted/50 border-border text-sm font-mono" />
                                    </ConfigSection>
                                </div>
                            </div>
                        )}

                        {/* Query Params */}
                        <ConfigSection label="Query Parameters (Opcional)" hint="Parâmetros adicionados na URL como ?key=value">
                            <DynamicListBuilder
                                items={d.query_params || []}
                                onAdd={() => update('query_params', [...(d.query_params || []), { key: '', value: '' }])}
                                onRemove={(i) => update('query_params', (d.query_params || []).filter((_: any, idx: number) => idx !== i))}
                                onUpdate={(i, field, val) => {
                                    const params = [...(d.query_params || [])];
                                    params[i] = { ...params[i], [field]: val };
                                    update('query_params', params);
                                }}
                                addLabel="Adicionar Parâmetro"
                                renderRow={(item, _i, onUpdate) => (
                                    <div className="flex gap-1.5">
                                        <Input value={item.key || ''} onChange={(e) => onUpdate('key', e.target.value)} placeholder="chave" className="rounded-lg h-9 bg-muted/50 border-border text-xs font-mono flex-1" />
                                        <span className="flex items-center text-muted-foreground text-xs px-0.5">=</span>
                                        <Input value={item.value || ''} onChange={(e) => onUpdate('value', e.target.value)} placeholder="valor" className="rounded-lg h-9 bg-muted/50 border-border text-xs font-mono flex-1" />
                                    </div>
                                )}
                            />
                        </ConfigSection>

                        {/* Body */}
                        {['POST', 'PUT', 'PATCH'].includes(d.method || '') && (
                            <>
                                <ConfigSection label="Formato do Body">
                                    <SelectField value={d.body_type || 'json'} onChange={(v) => update('body_type', v)} options={[
                                        { value: 'json', label: 'JSON' },
                                        { value: 'text', label: 'Texto / String' },
                                        { value: 'form', label: 'Form (key-value)' },
                                        { value: 'none', label: 'Sem body' },
                                    ]} />
                                </ConfigSection>

                                {d.body_type === 'form' ? (
                                    <ConfigSection label="Form Fields" hint="Pares chave-valor enviados como form-data">
                                        <DynamicListBuilder
                                            items={d.body_form || []}
                                            onAdd={() => update('body_form', [...(d.body_form || []), { key: '', value: '' }])}
                                            onRemove={(i) => update('body_form', (d.body_form || []).filter((_: any, idx: number) => idx !== i))}
                                            onUpdate={(i, field, val) => {
                                                const fields = [...(d.body_form || [])];
                                                fields[i] = { ...fields[i], [field]: val };
                                                update('body_form', fields);
                                            }}
                                            addLabel="Adicionar Campo"
                                            renderRow={(item, _i, onUpdate) => (
                                                <div className="flex gap-1.5">
                                                    <Input value={item.key || ''} onChange={(e) => onUpdate('key', e.target.value)} placeholder="campo" className="rounded-lg h-9 bg-muted/50 border-border text-xs font-mono flex-1" />
                                                    <span className="flex items-center text-muted-foreground text-xs px-0.5">=</span>
                                                    <Input value={item.value || ''} onChange={(e) => onUpdate('value', e.target.value)} placeholder="{{contact.name}}" className="rounded-lg h-9 bg-muted/50 border-border text-xs font-mono flex-1" />
                                                </div>
                                            )}
                                        />
                                    </ConfigSection>
                                ) : d.body_type === 'text' ? (
                                    <ConfigSection label="Body (Texto)" hint="Texto livre. Use {{variavel}} para valores dinâmicos">
                                        <TextFieldWithVars value={d.body_text || ''} onChange={(v) => update('body_text', v)} placeholder="Nome: {{contact.name}}\nTelefone: {{contact.phone}}\nMensagem: {{last_response}}" multiline />
                                    </ConfigSection>
                                ) : d.body_type !== 'none' ? (
                                    <ConfigSection label="Body (JSON)" hint="Objeto JSON. Use {{variavel}} para interpolação">
                                        <TextFieldWithVars value={d.body_json || ''} onChange={(v) => update('body_json', v)} placeholder={'{\n  "nome": "{{contact.name}}",\n  "telefone": "{{contact.phone}}",\n  "mensagem": "{{last_response}}"\n}'} multiline monoFont />
                                    </ConfigSection>
                                ) : null}
                            </>
                        )}

                        {/* Output */}
                        <ConfigSection label="Salvar resposta em" hint="Nome da variável para armazenar o resultado">
                            <Input value={d.response_var || 'http_response'} onChange={(e) => update('response_var', e.target.value)} placeholder="http_response" className="rounded-xl h-11 bg-muted/50 border-border text-sm font-mono" />
                        </ConfigSection>

                        <ToggleSwitch label="Continuar mesmo se der erro" checked={!!d.continue_on_error} onChange={(v) => update('continue_on_error', v)} />
                    </div>
                );

            case 'code':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Linguagem">
                            <SelectField value={d.language || 'javascript'} onChange={(v) => update('language', v)} options={[
                                { value: 'javascript', label: 'JavaScript' },
                            ]} />
                        </ConfigSection>

                        {/* Variable reference */}
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Variáveis Disponíveis</span>
                            <div className="grid grid-cols-2 gap-1">
                                {[
                                    { var: 'vars.last_response', desc: 'Última resposta' },
                                    { var: 'vars.last_ai_response', desc: 'Resposta IA' },
                                    { var: 'vars.http_response', desc: 'Resp. HTTP' },
                                    { var: 'contact.name', desc: 'Nome' },
                                    { var: 'contact.phone', desc: 'Telefone' },
                                    { var: 'contact.email', desc: 'E-mail' },
                                ].map(v => (
                                    <div key={v.var} className="flex items-center gap-1.5 text-[10px]">
                                        <code className="text-green-400 font-mono">{v.var}</code>
                                        <span className="text-gray-500">— {v.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <ConfigSection label="Código" hint="Deve retornar um objeto cujas propriedades se tornam variáveis do fluxo">
                            <Textarea
                                value={d.code || ''}
                                onChange={(e) => update('code', e.target.value)}
                                placeholder={d.language === 'python'
                                    ? '# Acesse variáveis com vars["chave"]\n# Acesse dados do contato com contact["name"]\n\nresultado = vars.get("last_response", "")\nreturn {"processado": True, "texto": resultado}'
                                    : '// Acesse variáveis com vars.chave\n// Acesse dados do contato com contact.name\n\nconst resultado = vars.last_response || "";\nreturn { processado: true, texto: resultado };'
                                }
                                className="min-h-[180px] rounded-xl bg-slate-900 border-slate-700 text-green-400 font-mono text-xs focus:ring-green-500/20"
                            />
                        </ConfigSection>

                        <ConfigSection label="Salvar resultado em" hint="Prefixo para as variáveis de saída">
                            <Input value={d.output_prefix || ''} onChange={(e) => update('output_prefix', e.target.value)} placeholder="resultado" className="rounded-xl h-11 bg-muted/50 border-border text-sm font-mono" />
                        </ConfigSection>

                        <ToggleSwitch label="Continuar mesmo se der erro" checked={!!d.continue_on_error} onChange={(v) => update('continue_on_error', v)} />
                        <InfoBanner text="O código deve retornar um objeto. Cada propriedade vira uma variável acessível nos próximos nós." />
                    </div>
                );

            case 'edit_fields':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Modo">
                            <SelectField value={d.mode || 'pairs'} onChange={(v) => update('mode', v)} options={[
                                { value: 'pairs', label: 'Pares Chave-Valor' },
                                { value: 'json', label: 'JSON Livre' },
                            ]} />
                        </ConfigSection>
                        {d.mode === 'json' ? (
                            <ConfigSection label="JSON" hint="Objeto JSON cuja chaves se tornarão variáveis">
                                <TextFieldWithVars value={d.json_value || ''} onChange={(v) => update('json_value', v)} placeholder='{"campo": "valor"}' multiline monoFont />
                            </ConfigSection>
                        ) : (
                            <ConfigSection label="Campos" hint="Cada par será adicionado como variável do fluxo">
                                <DynamicListBuilder
                                    items={d.fields || []}
                                    onAdd={() => update('fields', [...(d.fields || []), { name: '', value: '' }])}
                                    onRemove={(i) => update('fields', (d.fields || []).filter((_: any, idx: number) => idx !== i))}
                                    onUpdate={(i, field, val) => {
                                        const fields = [...(d.fields || [])];
                                        fields[i] = { ...fields[i], [field]: val };
                                        update('fields', fields);
                                    }}
                                    addLabel="Adicionar Campo"
                                    renderRow={(item, i, onUpdate) => (
                                        <div className="flex gap-1.5">
                                            <Input value={item.name || ''} onChange={(e) => onUpdate('name', e.target.value)} placeholder="chave" className="rounded-lg h-9 bg-muted/50 border-border text-xs font-mono flex-1" />
                                            <span className="flex items-center text-muted-foreground text-xs px-1">=</span>
                                            <Input value={item.value || ''} onChange={(e) => onUpdate('value', e.target.value)} placeholder="valor" className="rounded-lg h-9 bg-muted/50 border-border text-xs flex-1" />
                                        </div>
                                    )}
                                />
                            </ConfigSection>
                        )}
                    </div>
                );

            // ==============================
            // LEGACY NODES
            // ==============================

            case 'media':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="URL do Arquivo / Mídia">
                            <TextFieldWithVars value={d.url || ''} onChange={(v) => update('url', v)} placeholder="https://exemplo.com/imagem.png" />
                        </ConfigSection>
                        <ConfigSection label="Legenda">
                            <TextFieldWithVars value={d.content || ''} onChange={(v) => update('content', v)} placeholder="Legenda da mídia" multiline />
                        </ConfigSection>
                    </div>
                );

            case 'logic':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Tempo de Espera (Delay)">
                            <div className="flex gap-2">
                                <NumberField value={d.delayValue || '1'} onChange={(v) => update('delayValue', v)} min={1} />
                                <SelectField value={d.delayUnit || 'minutos'} onChange={(v) => update('delayUnit', v)} options={[
                                    { value: 'segundos', label: 'Segundos' },
                                    { value: 'minutos', label: 'Minutos' },
                                    { value: 'horas', label: 'Horas' },
                                    { value: 'dias', label: 'Dias' },
                                ]} />
                            </div>
                        </ConfigSection>
                    </div>
                );

            case 'crm':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Etapa do Funil">
                            <Input value={d.description || ''} onChange={(e) => update('description', e.target.value)} placeholder="Ex: Lead Qualificado" className="rounded-xl h-11 bg-muted/50 border-border text-sm" />
                        </ConfigSection>
                    </div>
                );

            case 'system':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="URL do Webhook (POST)">
                            <TextFieldWithVars value={d.webhookUrl || ''} onChange={(v) => update('webhookUrl', v)} placeholder="https://api.seusistema.com/webhook" monoFont />
                        </ConfigSection>
                        <ConfigSection label="Script Customizado (JavaScript)">
                            <TextFieldWithVars value={d.code || ''} onChange={(v) => update('code', v)} placeholder="// Seu código aqui..." multiline monoFont />
                        </ConfigSection>
                    </div>
                );

            case 'action':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Tag / Ação">
                            {companyTags.length > 0 ? (
                                <SelectField
                                    value={(d as any).tag || (d as any).description || ''}
                                    onChange={(v) => update('tag', v)}
                                    placeholder="Selecionar tag..."
                                    options={companyTags}
                                />
                            ) : (
                                <Input value={(d as any).tag || (d as any).description || ''} onChange={(e) => update('tag', e.target.value)} placeholder="Ex: vip_customer" className="rounded-xl h-11 bg-muted/50 border-border text-sm" />
                            )}
                        </ConfigSection>
                    </div>
                );

            case 'utility':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Máscara / Formato">
                            <Input value={d.format || ''} onChange={(e) => update('format', e.target.value)} placeholder="Ex: R$ #.##0,00" className="rounded-xl h-11 bg-muted/50 border-border text-sm" />
                        </ConfigSection>
                    </div>
                );

            case 'trigger':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Tipo de Gatilho">
                            <SelectField
                                value={d.triggerType || 'message_received'}
                                onChange={(v) => update('triggerType', v)}
                                options={[
                                    { value: 'message_received', label: 'Mensagem Recebida' },
                                    { value: 'keyword', label: 'Palavra-chave' },
                                    { value: 'lead_created', label: 'Lead Criado' },
                                    { value: 'tag_added', label: 'Tag Adicionada' },
                                    { value: 'stage_changed', label: 'Etapa Alterada' },
                                    { value: 'webhook', label: 'Webhook Externo' },
                                ]}
                            />
                        </ConfigSection>
                        {(d.triggerType === 'keyword' || d.triggerType === 'message_received') && (
                            <ConfigSection label="Palavra-chave (Opcional)" hint="Filtrar apenas mensagens que contenham esta palavra">
                                <Input value={d.keyword || ''} onChange={(e) => update('keyword', e.target.value)} placeholder="Ex: quero comprar" className="rounded-xl h-11 bg-muted/50 border-border text-sm" />
                            </ConfigSection>
                        )}
                    </div>
                );
            // ---- Assign User ----
            case 'assign_user': {
                const assignType = d.assign_type || 'user';
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Atribuir para">
                            <SelectField
                                value={assignType}
                                onChange={(v) => updateMulti({ assign_type: v, user_id: '', team_id: '', user_name: '', team_name: '' })}
                                options={[
                                    { value: 'user', label: '👤 Agente específico' },
                                    { value: 'team', label: '👥 Equipe específica' },
                                    { value: 'random_in_team', label: '🎲 Aleatório na equipe' },
                                ]}
                            />
                        </ConfigSection>
                        {assignType === 'user' && (
                            <ConfigSection label="Agente">
                                <SelectField
                                    value={d.user_id || ''}
                                    onChange={(v) => {
                                        const user = companyUsers.find((u: any) => u.id === v);
                                        updateMulti({ user_id: v, user_name: user?.name || '' });
                                    }}
                                    placeholder="Selecionar agente..."
                                    options={companyUsers.map((u: any) => ({ value: u.id, label: u.name }))}
                                />
                            </ConfigSection>
                        )}
                        {(assignType === 'team' || assignType === 'random_in_team') && (
                            <ConfigSection label="Equipe">
                                <SelectField
                                    value={d.team_id || ''}
                                    onChange={(v) => {
                                        const team = companyTeams.find((t: any) => t.id === v);
                                        updateMulti({ team_id: v, team_name: team?.name || '' });
                                    }}
                                    placeholder="Selecionar equipe..."
                                    options={companyTeams.map((t: any) => ({ value: t.id, label: t.name }))}
                                />
                            </ConfigSection>
                        )}
                    </div>
                );
            }

            // ---- Add Tag ----
            case 'add_tag':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Selecionar Tag" hint="Tag que será adicionada ao contato">
                            <SelectField
                                value={d.tagId || d.tag_name || ''}
                                onChange={(v) => {
                                    updateMulti({ tagId: v, tag_name: v });
                                }}
                                placeholder="Selecionar tag..."
                                options={companyTags}
                            />
                        </ConfigSection>
                    </div>
                );

            // ---- CRM Move (Mover Kanban) ----
            case 'crm_move':
                return (
                    <div className="space-y-5">
                        <ConfigSection label="Funil de Destino">
                            <SelectField
                                value={d.funnel_id || d.funnel_name || ''}
                                onChange={(v) => {
                                    const board = kanbanBoards.find((b: any) => b.id === v || b.name === v);
                                    updateMulti({ funnel_name: board?.name || v, funnel_id: board?.id || v, stage_name: '', stage_id: '' });
                                }}
                                placeholder="Selecionar funil..."
                                options={kanbanBoards.map((b: any) => ({ value: b.id || b.name, label: b.name }))}
                            />
                        </ConfigSection>
                        <ConfigSection label="Etapa de Destino">
                            <SelectField
                                value={d.stage_id || d.stage_name || ''}
                                onChange={(v) => {
                                    const stage = selectedBoardStages.find((s: any) => s.value === v);
                                    updateMulti({ stage_name: stage?.label || v, stage_id: v });
                                }}
                                placeholder={d.funnel_name || d.funnel_id ? "Selecionar etapa..." : "Selecione um funil primeiro"}
                                options={selectedBoardStages}
                            />
                        </ConfigSection>
                    </div>
                );

            // ---- Lookup Lead ----
            case 'lookup_lead':
                return (
                    <div className="space-y-5">
                        <InfoBanner text="Procura na base de contatos pelo número de telefone fornecido. Se encontrado, os dados do lead serão carregados para o fluxo." />
                        <ConfigSection label="Variável de Telefone" hint="Variável que contém o telefone para a busca">
                            <TextFieldWithVars
                                value={d.phone_variable || ''}
                                onChange={(v) => update('phone_variable', v)}
                                placeholder="Ex: vars.telefone"
                                monoFont
                            />
                        </ConfigSection>
                    </div>
                );


            // ---- Add Note ----
            case 'add_note':
                return (
                    <div className="space-y-4">
                        <InfoBanner text="Salva uma nota interna no perfil do contato/lead. Use variáveis como {{nome}}, {{telefone}}, {{email}} para personalizar." color="amber" />
                        <ConfigSection label="Texto da Nota" hint="Conteúdo da nota interna. Suporta variáveis {{variavel}}">
                            <TextFieldWithVars
                                value={d.note_text || ''}
                                onChange={(v) => update('note_text', v)}
                                placeholder="Ex: Lead interessado em {{objetivo}}. Investimento: {{investimento}}"
                                multiline
                            />
                        </ConfigSection>
                        <ConfigSection label="Modo de Inserção" hint="Como a nota será adicionada às notas existentes">
                            <SelectField
                                value={d.append_mode || 'prepend'}
                                onChange={(v) => update('append_mode', v)}
                                options={[
                                    { value: 'prepend', label: '📌 Adicionar no início' },
                                    { value: 'append', label: '📝 Adicionar no final' },
                                    { value: 'replace', label: '🔄 Substituir tudo' },
                                ]}
                            />
                        </ConfigSection>
                    </div>
                );

            default:
                return (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="p-4 bg-gray-100 rounded-full mb-4 opacity-40">
                            <Settings2 className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Este node não requer configuração adicional</p>
                    </div>
                );
        }
    }; // end renderConfig

    return renderConfig();
});

NodeConfigPanel.displayName = 'NodeConfigPanel';
