'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Zap, MessageSquare, Bot, Clock, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';

interface Connection {
    id: string;
    config_name: string;
    connectionType: string;
    status: string;
}

interface Persona {
    id: string;
    name: string;
}

interface TemplateItem {
    id: string;
    name: string;
    displayName: string;
    category: string;
    language: string;
    status: string;
}

interface AutoApproachConfigProps {
    webhookId: string;
    webhookName: string;
}

const TEMPLATE_VARIABLES = [
    { key: '{{nome}}', label: 'Nome', description: 'Nome do contato' },
    { key: '{{email}}', label: 'Email', description: 'Email do contato' },
    { key: '{{telefone}}', label: 'Telefone', description: 'Telefone do contato' },
    { key: '{{objetivo}}', label: 'Objetivo', description: 'Objetivo/assunto do formulário' },
    { key: '{{produto}}', label: 'Produto', description: 'Nome do produto' },
    { key: '{{origem}}', label: 'Origem', description: 'Nome do webhook' },
    { key: '{{data}}', label: 'Data', description: 'Data/hora atual' },
];

// Prefix used to identify template-based messages in the database
const TEMPLATE_PREFIX = 'template:';

export function AutoApproachConfig({ webhookId, webhookName }: AutoApproachConfigProps) {
    const { toast } = useToast();
    const notifier = createToastNotifier(toast);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [templates, setTemplates] = useState<TemplateItem[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Config state
    const [enabled, setEnabled] = useState(false);
    const [connectionId, setConnectionId] = useState<string>('none');
    const [message, setMessage] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');
    const [delaySeconds, setDelaySeconds] = useState(5);
    const [personaId, setPersonaId] = useState<string>('none');

    // Derive connection type from selected connection
    const selectedConnectionType = useMemo(() => {
        if (connectionId === 'none') return null;
        const conn = connections.find(c => c.id === connectionId);
        return conn?.connectionType || null;
    }, [connectionId, connections]);

    const isApiCloud = selectedConnectionType === 'cloud_api' || selectedConnectionType === 'apicloud' || selectedConnectionType === 'meta' || selectedConnectionType === 'meta_api';
    const isBaileys = selectedConnectionType === 'baileys';

    // Fetch templates when an APICLOUD connection is selected
    const loadTemplates = useCallback(async (connId: string) => {
        if (connId === 'none') {
            setTemplates([]);
            return;
        }
        try {
            setLoadingTemplates(true);
            const res = await fetch(`/api/v1/templates/by-connection?connectionId=${connId}`);
            if (res.ok) {
                const data = await res.json();
                const allTemplates: TemplateItem[] = data.templates || [];
                // Only show approved templates
                setTemplates(allTemplates.filter(t =>
                    t.status === 'APPROVED' || t.status === 'APROVADO'
                ));
            } else {
                setTemplates([]);
            }
        } catch (e) {
            console.warn('Failed to load templates:', e);
            setTemplates([]);
        } finally {
            setLoadingTemplates(false);
        }
    }, []);

    // When connection changes, load templates if apicloud
    const handleConnectionChange = useCallback((newConnId: string) => {
        setConnectionId(newConnId);
        const conn = connections.find(c => c.id === newConnId);
        const connType = conn?.connectionType;
        if (connType === 'cloud_api' || connType === 'apicloud' || connType === 'meta' || connType === 'meta_api') {
            loadTemplates(newConnId);
            // Clear free-text message when switching to apicloud
            // Keep template selection if already set
        } else {
            setTemplates([]);
            setSelectedTemplateId('none');
        }
    }, [connections, loadTemplates]);

    const loadConfig = useCallback(async () => {
        try {
            setLoading(true);

            // Fetch config
            const configRes = await fetch(`/api/v1/settings/webhooks/${webhookId}/auto-approach`);
            let savedMessage = '';
            let savedConnectionId = 'none';
            if (configRes.ok) {
                const configData = await configRes.json();
                if (configData.data) {
                    setEnabled(configData.data.auto_approach_enabled || false);
                    savedConnectionId = configData.data.auto_approach_connection_id || 'none';
                    setConnectionId(savedConnectionId);
                    savedMessage = configData.data.auto_approach_message || '';
                    setDelaySeconds(configData.data.auto_approach_delay_seconds || 5);
                    setPersonaId(configData.data.auto_approach_ai_persona_id || 'none');
                }
            }

            // Fetch connections
            let loadedConnections: Connection[] = [];
            try {
                const connectionsRes = await fetch('/api/v1/connections');
                if (connectionsRes.ok) {
                    const connectionsData = await connectionsRes.json();
                    const allConnections = connectionsData.data || connectionsData || [];
                    loadedConnections = Array.isArray(allConnections)
                        ? allConnections.filter((c: Connection) =>
                            ['baileys', 'apicloud', 'cloud_api', 'meta', 'meta_api'].includes(c.connectionType)
                        )
                        : [];
                    setConnections(loadedConnections);
                }
            } catch (e) {
                console.warn('Failed to load connections:', e);
            }

            // Parse saved message — check if it's a template reference
            if (savedMessage.startsWith(TEMPLATE_PREFIX)) {
                setSelectedTemplateId(savedMessage.slice(TEMPLATE_PREFIX.length));
                setMessage('');
            } else {
                setMessage(savedMessage);
                setSelectedTemplateId('none');
            }

            // If saved connection is apicloud, load its templates
            if (savedConnectionId !== 'none') {
                const savedConn = loadedConnections.find(c => c.id === savedConnectionId);
                if (savedConn && (savedConn.connectionType === 'cloud_api' || savedConn.connectionType === 'apicloud' || savedConn.connectionType === 'meta' || savedConn.connectionType === 'meta_api')) {
                    loadTemplates(savedConnectionId);
                }
            }

            // Fetch personas
            try {
                const personasRes = await fetch('/api/v1/ia/personas');
                if (personasRes.ok) {
                    const personasData = await personasRes.json();
                    setPersonas(Array.isArray(personasData) ? personasData : personasData.data || []);
                }
            } catch (e) {
                console.warn('Failed to load personas:', e);
            }

        } catch (error) {
            console.error('Error loading auto-approach config:', error);
        } finally {
            setLoading(false);
        }
    }, [webhookId, loadTemplates]);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    const handleSave = async () => {
        if (enabled && (!connectionId || connectionId === 'none')) {
            notifier.warning('Selecione uma conexão WhatsApp');
            return;
        }

        // For apicloud: require template selection
        if (enabled && isApiCloud && selectedTemplateId === 'none' && personaId === 'none') {
            notifier.warning('Selecione um template da APICLOUD ou um agente IA');
            return;
        }

        // For baileys: require message or AI persona
        if (enabled && isBaileys && !message && personaId === 'none') {
            notifier.warning('Defina uma mensagem ou selecione um agente IA');
            return;
        }

        // Build the message value to save
        let messageToSave = message;
        if (isApiCloud && selectedTemplateId !== 'none') {
            messageToSave = `${TEMPLATE_PREFIX}${selectedTemplateId}`;
        }

        try {
            setSaving(true);
            const response = await fetch(`/api/v1/settings/webhooks/${webhookId}/auto-approach`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auto_approach_enabled: enabled,
                    auto_approach_connection_id: connectionId === 'none' ? null : (connectionId || null),
                    auto_approach_message: messageToSave,
                    auto_approach_delay_seconds: delaySeconds,
                    auto_approach_ai_persona_id: personaId === 'none' ? null : personaId,
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Erro ao salvar');

            notifier.success('Configuração de abordagem automática salva!');
        } catch (error) {
            notifier.error(error instanceof Error ? error.message : 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    const insertVariable = (variable: string) => {
        setMessage(prev => prev + variable);
    };

    // Find selected template to show preview
    const selectedTemplate = useMemo(() => {
        if (selectedTemplateId === 'none') return null;
        return templates.find(t => t.id === selectedTemplateId) || null;
    }, [selectedTemplateId, templates]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Carregando...</span>
            </div>
        );
    }

    return (
        <Card className="border-dashed border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-500" />
                    Abordagem Automática
                    {enabled && (
                        <Badge variant="default" className="bg-green-500 text-white text-[10px] px-1.5">
                            ATIVA
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <Label className="text-sm font-medium">Ativar Abordagem Automática</Label>
                        <p className="text-xs text-muted-foreground">
                            Envia uma mensagem via WhatsApp quando um contato chegar via este webhook
                        </p>
                    </div>
                    <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>

                {enabled && (
                    <>
                        {/* Connection Selector */}
                        <div className="space-y-1.5">
                            <Label className="text-sm flex items-center gap-1.5">
                                <MessageSquare className="h-3.5 w-3.5" />
                                Conexão WhatsApp
                            </Label>
                            <Select value={connectionId} onValueChange={handleConnectionChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione uma conexão..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {connections.map(conn => (
                                        <SelectItem key={conn.id} value={conn.id}>
                                            {conn.config_name} ({conn.connectionType === 'baileys' ? 'Baileys' : 'API Cloud'})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedConnectionType && (
                                <p className="text-xs text-muted-foreground">
                                    Tipo: {isBaileys ? '📱 Baileys (mensagem livre)' : '☁️ API Cloud (template obrigatório)'}
                                </p>
                            )}
                        </div>

                        {/* === BAILEYS: Free-text Message === */}
                        {isBaileys && (
                            <div className="space-y-1.5">
                                <Label className="text-sm">Mensagem de Abordagem</Label>
                                <Textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Olá {{nome}}! 👋 Recebemos seus dados via {{origem}}. Como posso ajudá-lo hoje?"
                                    rows={4}
                                    className="resize-none text-sm"
                                />
                                <div className="flex flex-wrap gap-1">
                                    {TEMPLATE_VARIABLES.map(v => (
                                        <Badge
                                            key={v.key}
                                            variant="outline"
                                            className="cursor-pointer hover:bg-primary/10 text-[10px] px-1.5 py-0.5"
                                            onClick={() => insertVariable(v.key)}
                                            title={v.description}
                                        >
                                            {v.label}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* === APICLOUD: Template Selector === */}
                        {isApiCloud && (
                            <div className="space-y-1.5">
                                <Label className="text-sm flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5" />
                                    Template da APICLOUD
                                </Label>
                                {loadingTemplates ? (
                                    <div className="flex items-center gap-2 py-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-xs text-muted-foreground">Carregando templates...</span>
                                    </div>
                                ) : templates.length === 0 ? (
                                    <div className="p-3 border border-dashed rounded-md bg-muted/30">
                                        <p className="text-xs text-muted-foreground">
                                            Nenhum template aprovado encontrado para esta conexão.
                                            Crie e aprove templates em Configurações → Templates.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione um template aprovado..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {templates.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>
                                                        📄 {t.displayName || t.name}
                                                        {t.category && ` (${t.category})`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {selectedTemplate && (
                                            <div className="p-3 border rounded-md bg-muted/30 space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">Preview:</p>
                                                <p className="text-sm">
                                                    {selectedTemplate.displayName || selectedTemplate.name}
                                                </p>
                                                <div className="flex gap-1.5">
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {selectedTemplate.category}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {selectedTemplate.language}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">
                                                        {selectedTemplate.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Para conexões API Cloud, é obrigatório usar um template aprovado pela Meta
                                </p>
                            </div>
                        )}

                        {/* Delay */}
                        <div className="space-y-1.5">
                            <Label className="text-sm flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                Delay antes do envio (segundos)
                            </Label>
                            <Input
                                type="number"
                                min={3}
                                max={120}
                                value={delaySeconds}
                                onChange={e => setDelaySeconds(Math.max(3, parseInt(e.target.value) || 5))}
                                className="w-24"
                            />
                            <p className="text-xs text-muted-foreground">Mínimo 3s (proteção anti-spam)</p>
                        </div>

                        {/* AI Persona (Optional) */}
                        <div className="space-y-1.5">
                            <Label className="text-sm flex items-center gap-1.5">
                                <Bot className="h-3.5 w-3.5" />
                                Agente IA (opcional)
                            </Label>
                            <Select value={personaId} onValueChange={setPersonaId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Nenhum — usar mensagem fixa acima" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Nenhum (mensagem fixa)</SelectItem>
                                    {personas.map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                            🤖 {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {isBaileys
                                    ? 'Se selecionado, o agente IA gera uma mensagem contextual ao invés da mensagem fixa'
                                    : 'Se selecionado, o agente IA gera uma mensagem contextual (apenas para Baileys)'
                                }
                            </p>
                        </div>

                        {/* Save Button */}
                        <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Configuração
                        </Button>
                    </>
                )}

                {/* Save toggle even when disabled */}
                {!enabled && (
                    <Button onClick={handleSave} disabled={saving} variant="outline" size="sm">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Desativar e Salvar
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
