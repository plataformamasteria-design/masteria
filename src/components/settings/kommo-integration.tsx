'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Loader2, Unplug, Save, BarChart3, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface KommoPipelineStatus {
    id: number;
    name: string;
}

interface KommoStatusResponse {
    id: number;
    name: string;
    sort: number;
}

interface KommoPipeline {
    id: number;
    name: string;
    is_main: boolean;
    statuses: KommoStatusResponse[];
}

interface KommoCustomField {
    id: number;
    name: string;
    type: string;
}

interface FieldMappingRow {
    id: string; // unique react key
    masteriaField: string;
    kommoFieldId: string;
}

interface StageMappingRow {
    id: string; // unique react key
    kommoStatusId: string;
    masteriaStageId: string;
}

interface KommoConfig {
    defaultPipelineId?: string;
    defaultStatusId?: string;
    fieldMapping?: Record<string, string>;
    stageMapping?: Record<string, string>;
}

interface KanbanStage {
    id: string;
    title: string;
}

interface KanbanBoard {
    id: string;
    name: string;
    stages: KanbanStage[];
}

interface KommoStatus {
    connected: boolean;
    domain: string | null;
    config: KommoConfig | null;
    syncStats: { total: number; success: number; failed: number } | null;
}

export function KommoIntegration() {
    const [status, setStatus] = useState<KommoStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    // Connection form
    const [domain, setDomain] = useState('');
    const [accessToken, setAccessToken] = useState('');

    // Pipeline config
    const [pipelines, setPipelines] = useState<KommoPipeline[]>([]);
    const [loadingPipelines, setLoadingPipelines] = useState(false);
    const [selectedPipeline, setSelectedPipeline] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');

    // Custom Fields Mapping
    const [customFields, setCustomFields] = useState<KommoCustomField[]>([]);
    const [loadingFields, setLoadingFields] = useState(false);
    const [fieldMappings, setFieldMappings] = useState<FieldMappingRow[]>([]);

    // Bidirectional Stage Mappings
    const [kanbans, setKanbans] = useState<KanbanBoard[]>([]);
    const [loadingKanbans, setLoadingKanbans] = useState(false);
    const [stageMappings, setStageMappings] = useState<StageMappingRow[]>([]);
    const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

    const { toast } = useToast();

    const MASTERIA_FIELDS = [
        { value: 'metadata.faturamento', label: 'Faturamento Mensal (Metadata)' },
        { value: 'metadata.score', label: 'Score (Metadata)' },
        { value: 'metadata.interesse_edn', label: 'Interesse EDN (Metadata)' },
        { value: 'metadata.n_colaboradores', label: 'N° de Colaboradores (Metadata)' },
        { value: 'metadata.utm_source', label: 'UTM Source (Metadata)' },
        { value: 'metadata.utm_medium', label: 'UTM Medium (Metadata)' },
        { value: 'metadata.utm_campaign', label: 'UTM Campaign (Metadata)' },
        { value: 'metadata.utm_content', label: 'UTM Content (Metadata)' },
        { value: 'lead.value', label: 'Valor da Venda (Nativo)' },
    ];

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const response = await fetch('/api/v1/integrations/kommo/status');
            if (response.ok) {
                const data: KommoStatus = await response.json();
                setStatus(data);
                if (data.connected && data.config) {
                    setSelectedPipeline(data.config.defaultPipelineId || '');
                    setSelectedStatus(data.config.defaultStatusId || '');

                    if (data.config.fieldMapping) {
                        const loadedMappings = Object.entries(data.config.fieldMapping).map(([masteriaField, kommoFieldId]) => ({
                            id: Math.random().toString(36).substring(7),
                            masteriaField,
                            kommoFieldId: String(kommoFieldId),
                        }));
                        setFieldMappings(loadedMappings);
                    }
                    if (data.config.stageMapping) {
                        const loadedStageMappings = Object.entries(data.config.stageMapping).map(([kommoStatusId, masteriaStageId]) => ({
                            id: Math.random().toString(36).substring(7),
                            kommoStatusId,
                            masteriaStageId: String(masteriaStageId),
                        }));
                        setStageMappings(loadedStageMappings);
                    }
                }
                if (data.connected) {
                    loadPipelines();
                    loadCustomFields();
                    loadKanbans();
                }
            } else {
                setStatus({ connected: false, domain: null, config: null, syncStats: null });
            }
        } catch (error) {
            console.error('Error checking Kommo status:', error);
            setStatus({ connected: false, domain: null, config: null, syncStats: null });
        } finally {
            setLoading(false);
        }
    };

    const loadPipelines = async () => {
        setLoadingPipelines(true);
        try {
            const response = await fetch('/api/v1/integrations/kommo/pipelines');
            if (response.ok) {
                const data = await response.json();
                setPipelines(data.pipelines || []);
            }
        } catch (error) {
            console.error('Error loading pipelines:', error);
        } finally {
            setLoadingPipelines(false);
        }
    };

    const loadCustomFields = async () => {
        setLoadingFields(true);
        try {
            const response = await fetch('/api/v1/integrations/kommo/custom-fields');
            if (response.ok) {
                const data = await response.json();
                setCustomFields(data || []);
            }
        } catch (error) {
            console.error('Error loading custom fields:', error);
        } finally {
            setLoadingFields(false);
        }
    };

    const loadKanbans = async () => {
        setLoadingKanbans(true);
        try {
            const response = await fetch('/api/v1/kanbans');
            if (response.ok) {
                const data = await response.json();
                setKanbans(data || []);
            }
        } catch (error) {
            console.error('Error loading kanbans:', error);
        } finally {
            setLoadingKanbans(false);
        }
    };

    const addMappingRow = () => {
        setFieldMappings([...fieldMappings, { id: Math.random().toString(36).substring(7), masteriaField: '', kommoFieldId: '' }]);
    };
    const removeMappingRow = (id: string) => {
        setFieldMappings(fieldMappings.filter(m => m.id !== id));
    };
    const updateMappingRow = (id: string, field: 'masteriaField' | 'kommoFieldId', value: string) => {
        setFieldMappings(fieldMappings.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    // Helper functions for Stage Mappings
    const addStageRow = () => {
        setStageMappings([...stageMappings, { id: Math.random().toString(36).substring(7), kommoStatusId: '', masteriaStageId: '' }]);
    };
    const removeStageRow = (id: string) => {
        setStageMappings(stageMappings.filter(m => m.id !== id));
    };
    const updateStageRow = (id: string, field: 'kommoStatusId' | 'masteriaStageId', value: string) => {
        setStageMappings(stageMappings.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    const handleConnect = async () => {
        if (!domain || !accessToken) {
            toast({ title: 'Erro', description: 'Preencha o domínio e o access token.', variant: 'destructive' });
            return;
        }

        setConnecting(true);
        try {
            const response = await fetch('/api/v1/integrations/kommo/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain, accessToken, authType: 'token' }),
            });

            if (response.ok) {
                toast({ title: 'Sucesso', description: 'Kommo conectado com sucesso!' });
                setDomain('');
                setAccessToken('');
                await checkStatus();
            } else {
                const data = await response.json();
                toast({ title: 'Erro', description: data.error || 'Falha ao conectar.', variant: 'destructive' });
            }
        } catch (error) {
            console.error('Error connecting Kommo:', error);
            toast({ title: 'Erro', description: 'Erro de conexão.', variant: 'destructive' });
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        setIsDisconnectDialogOpen(false);
        setDisconnecting(true);
        try {
            const response = await fetch('/api/v1/integrations/kommo/disconnect', {
                method: 'POST',
            });

            if (response.ok) {
                toast({ title: 'Desconectado', description: 'Integração Kommo desconectada.' });
                setStatus({ connected: false, domain: null, config: null, syncStats: null });
                setPipelines([]);
                setCustomFields([]);
                setSelectedPipeline('');
                setSelectedStatus('');
                setFieldMappings([]);
                setStageMappings([]);
            } else {
                toast({ title: 'Erro', description: 'Falha ao desconectar.', variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: 'Erro', description: 'Erro ao desconectar.', variant: 'destructive' });
        } finally {
            setDisconnecting(false);
        }
    };

    const handleSaveConfig = async () => {
        if (!selectedPipeline || !selectedStatus) {
            toast({ title: 'Erro', description: 'Selecione um funil e uma etapa.', variant: 'destructive' });
            return;
        }

        // Transform array back to Record
        const fieldMappingObj: Record<string, string> = {};
        fieldMappings.forEach(m => {
            if (m.masteriaField && m.kommoFieldId) {
                fieldMappingObj[m.masteriaField] = m.kommoFieldId;
            }
        });

        const stageMappingObj: Record<string, string> = {};
        stageMappings.forEach(m => {
            if (m.kommoStatusId && m.masteriaStageId) {
                stageMappingObj[m.kommoStatusId] = m.masteriaStageId;
            }
        });

        setSaving(true);
        try {
            const response = await fetch('/api/v1/integrations/kommo/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    defaultPipelineId: selectedPipeline,
                    defaultStatusId: selectedStatus,
                    fieldMapping: fieldMappingObj,
                    stageMapping: stageMappingObj,
                }),
            });

            if (response.ok) {
                toast({ title: 'Sucesso', description: 'Funil e etapa salvos com sucesso!' });
                await checkStatus();
            } else {
                const data = await response.json();
                toast({ title: 'Erro', description: data.error || 'Falha ao salvar.', variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: 'Erro', description: 'Erro ao salvar configuração.', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const currentPipelineStages = pipelines.find(p => String(p.id) === selectedPipeline)?.statuses || [];

    // Get names for display
    const selectedPipelineName = pipelines.find(p => String(p.id) === selectedPipeline)?.name;
    const selectedStatusName = currentPipelineStages.find(s => String(s.id) === selectedStatus)?.name;

    if (loading) {
        return (
            <Card className="bg-white/[0.02] border-white/5 backdrop-blur-xl shadow-2xl">
                <CardContent className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-white/[0.02] border-white/5 backdrop-blur-xl shadow-2xl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <svg className="h-6 w-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5" />
                                <path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <div>
                            <CardTitle className="text-lg text-white">Kommo CRM</CardTitle>
                            <CardDescription className="text-zinc-400 mt-1">
                                Sincronize leads automaticamente com o Kommo CRM
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant={status?.connected ? 'default' : 'secondary'} className="gap-1">
                        {status?.connected ? (
                            <>
                                <CheckCircle2 className="h-3 w-3" />
                                Conectado
                            </>
                        ) : (
                            <>
                                <XCircle className="h-3 w-3" />
                                Desconectado
                            </>
                        )}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {!status?.connected ? (
                    /* ===== DISCONNECTED STATE ===== */
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Conecte sua conta Kommo para sincronizar leads automaticamente:
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                            <li>Leads criados no MasterIA são enviados ao Kommo</li>
                            <li>Escolha em qual funil e etapa os leads serão criados</li>
                            <li>Tags automáticas para identificação de origem</li>
                            <li>ID do MasterIA incluído nas notas do lead</li>
                        </ul>

                        <div className="space-y-3 border rounded-lg p-4">
                            <div className="space-y-2">
                                <Label htmlFor="kommo-domain">Domínio Kommo</Label>
                                <Input
                                    id="kommo-domain"
                                    placeholder="https://suaempresa.kommo.com"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    URL do seu Kommo (ex: https://suaempresa.kommo.com)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="kommo-token">Access Token</Label>
                                <Input
                                    id="kommo-token"
                                    type="password"
                                    placeholder="Cole seu access token aqui"
                                    value={accessToken}
                                    onChange={(e) => setAccessToken(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Gere o token em Kommo &gt; Configurações &gt; Integrações &gt; Sua integração &gt; Chaves e escopos
                                </p>
                            </div>
                        </div>

                        <Button onClick={handleConnect} disabled={connecting || !domain || !accessToken} className="w-full sm:w-auto">
                            {connecting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Conectando...
                                </>
                            ) : (
                                'Conectar Kommo'
                            )}
                        </Button>
                    </div>
                ) : (
                    /* ===== CONNECTED STATE ===== */
                    <div className="space-y-4">
                        {/* Sync Stats */}
                        {status.syncStats && (
                            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                                <div className="flex gap-4 text-sm">
                                    <span>Domínio: <strong>{status.domain}</strong></span>
                                    <span className="text-green-600">✓ {status.syncStats.success} sincronizados</span>
                                    {status.syncStats.failed > 0 && (
                                        <span className="text-red-500">✗ {status.syncStats.failed} falharam</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Pipeline & Stage Selection */}
                        <div className="space-y-3 border rounded-lg p-4">
                            <div className="space-y-1">
                                <Label className="text-sm font-medium">Funil e Etapa Padrão</Label>
                                <p className="text-xs text-muted-foreground">
                                    Selecione em qual funil e etapa os novos leads serão criados no Kommo.
                                </p>
                            </div>

                            {loadingPipelines ? (
                                <div className="flex items-center gap-2 py-4">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm text-muted-foreground">Carregando funis do Kommo...</span>
                                </div>
                            ) : pipelines.length === 0 ? (
                                <div className="py-4">
                                    <p className="text-sm text-muted-foreground">Nenhum funil encontrado.</p>
                                    <Button variant="outline" size="sm" onClick={loadPipelines} className="mt-2">
                                        Recarregar funis
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="kommo-pipeline">Funil</Label>
                                        <select
                                            id="kommo-pipeline"
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            value={selectedPipeline}
                                            onChange={(e) => {
                                                setSelectedPipeline(e.target.value);
                                                setSelectedStatus(''); // Reset stage when pipeline changes
                                            }}
                                        >
                                            <option value="">Selecione um funil...</option>
                                            {pipelines.map((p) => (
                                                <option key={p.id} value={String(p.id)}>
                                                    {p.name} {p.is_main ? '(Principal)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="kommo-status">Etapa</Label>
                                        <select
                                            id="kommo-status"
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            value={selectedStatus}
                                            disabled={!selectedPipeline}
                                            onChange={(e) => setSelectedStatus(e.target.value)}
                                        >
                                            <option value="">Selecione uma etapa...</option>
                                            {currentPipelineStages.map((s) => (
                                                <option key={s.id} value={String(s.id)}>
                                                    {s.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Current config indicator */}
                            {status.config?.defaultPipelineId && selectedPipelineName && (
                                <div className="text-xs text-muted-foreground mt-2 p-2 bg-green-50 dark:bg-green-950/30 rounded">
                                    Configuração atual: <strong>{selectedPipelineName}</strong> → <strong>{selectedStatusName || 'Etapa não encontrada'}</strong>
                                </div>
                            )}
                        </div>

                        {/* Custom Fields Mapping Section */}
                        <div className="space-y-3 border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label className="text-sm font-medium">Mapeamento Avançado de Campos (Opcional)</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Vincule os dados da MasterIA (como Score, UTMs, Faturamento) aos Campos Personalizados do Kommo.
                                    </p>
                                </div>
                                <Button size="sm" variant="outline" onClick={addMappingRow} className="h-8">
                                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                                </Button>
                            </div>

                            {loadingFields ? (
                                <div className="flex items-center gap-2 py-4">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm text-muted-foreground">Carregando campos do Kommo...</span>
                                </div>
                            ) : fieldMappings.length === 0 ? (
                                <div className="py-2">
                                    <p className="text-xs text-muted-foreground italic">Nenhum campo adicional mapeado. Apenas Nome, Telefone e Email serão sincronizados.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 mt-4">
                                    <div className="grid grid-cols-12 gap-2 mb-1 px-1">
                                        <div className="col-span-5 text-xs font-medium text-muted-foreground">Campo na MasterIA (Nativo ou Metadata)</div>
                                        <div className="col-span-1 flex justify-center text-xs text-muted-foreground">→</div>
                                        <div className="col-span-5 text-xs font-medium text-muted-foreground">Campo no Kommo CRM</div>
                                        <div className="col-span-1"></div>
                                    </div>
                                    {fieldMappings.map((mappingRow) => (
                                        <div key={mappingRow.id} className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-5">
                                                {/* Permite tanto usar pre-definidos quanto digitar um campo metadata.*/}
                                                <Input
                                                    list="masteria-fields"
                                                    value={mappingRow.masteriaField}
                                                    onChange={(e) => updateMappingRow(mappingRow.id, 'masteriaField', e.target.value)}
                                                    placeholder="ex: metadata.score"
                                                    className="h-8 text-sm"
                                                />
                                                <datalist id="masteria-fields">
                                                    {MASTERIA_FIELDS.map(mf => (
                                                        <option key={mf.value} value={mf.value}>{mf.label}</option>
                                                    ))}
                                                </datalist>
                                            </div>
                                            <div className="col-span-1 flex justify-center text-xs">→</div>
                                            <div className="col-span-5">
                                                <select
                                                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    value={mappingRow.kommoFieldId}
                                                    onChange={(e) => updateMappingRow(mappingRow.id, 'kommoFieldId', e.target.value)}
                                                >
                                                    <option value="">Selecione o campo...</option>
                                                    {customFields.map((cf) => (
                                                        <option key={cf.id} value={String(cf.id)}>
                                                            {cf.name} (Tipo: {cf.type})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-span-1 flex justify-end">
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeMappingRow(mappingRow.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Stage Mappings Section (Bidirectional Sync) */}
                        <div className="space-y-3 border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label className="text-sm font-medium">Sincronização Bidirecional (Fases do Funil)</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Vincule as etapas do Kommo aos quadros Kanban da MasterIA. Quando o vendedor mover no Kommo, a MasterIA atualiza automaticamente!
                                    </p>
                                </div>
                                <Button size="sm" variant="outline" onClick={addStageRow} className="h-8">
                                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                                </Button>
                            </div>

                            {loadingKanbans || loadingPipelines ? (
                                <div className="flex items-center gap-2 py-4">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm text-muted-foreground">Carregando painéis e funis...</span>
                                </div>
                            ) : stageMappings.length === 0 ? (
                                <div className="py-2">
                                    <p className="text-xs text-muted-foreground italic">Nenhuma fase mapeada. A sincronização bidirecional de status não ocorrerá.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 mt-4">
                                    <div className="grid grid-cols-12 gap-2 mb-1 px-1">
                                        <div className="col-span-5 text-xs font-medium text-muted-foreground">Etapa no Kommo CRM</div>
                                        <div className="col-span-1 flex justify-center text-xs text-muted-foreground">→</div>
                                        <div className="col-span-5 text-xs font-medium text-muted-foreground">Etapa Kanban (MasterIA)</div>
                                        <div className="col-span-1"></div>
                                    </div>
                                    {stageMappings.map((mappingRow) => (
                                        <div key={mappingRow.id} className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-5">
                                                <select
                                                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    value={mappingRow.kommoStatusId}
                                                    onChange={(e) => updateStageRow(mappingRow.id, 'kommoStatusId', e.target.value)}
                                                >
                                                    <option value="">Selecione a fase do Kommo...</option>
                                                    {pipelines.flatMap(p => p.statuses.map(s => (
                                                        <option key={`${p.id}-${s.id}`} value={String(s.id)}>
                                                            {p.name} - {s.name}
                                                        </option>
                                                    )))}
                                                </select>
                                            </div>
                                            <div className="col-span-1 flex justify-center text-xs">→</div>
                                            <div className="col-span-5">
                                                <select
                                                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    value={mappingRow.masteriaStageId}
                                                    onChange={(e) => updateStageRow(mappingRow.id, 'masteriaStageId', e.target.value)}
                                                >
                                                    <option value="">Selecione o Kanban...</option>
                                                    {kanbans.flatMap((k: KanbanBoard) => k.stages.map((s: KanbanStage) => (
                                                        <option key={`${k.id}-${s.id}`} value={String(s.id)}>
                                                            {k.name} - {s.title}
                                                        </option>
                                                    )))}
                                                </select>
                                            </div>
                                            <div className="col-span-1 flex justify-end">
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeStageRow(mappingRow.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Save button */}
                        <Button onClick={handleSaveConfig} disabled={saving || !selectedPipeline || !selectedStatus} className="w-full sm:w-auto">
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Salvar Configuração
                                </>
                            )}
                        </Button>

                        {/* Disconnect */}
                        <div className="pt-4 border-t">
                            <Button variant="outline" size="sm" onClick={() => setIsDisconnectDialogOpen(true)} disabled={disconnecting} className="text-red-600 hover:text-red-700">
                                {disconnecting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Unplug className="mr-2 h-4 w-4" />
                                )}
                                Desconectar Kommo
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>

            <AlertDialog open={isDisconnectDialogOpen} onOpenChange={setIsDisconnectDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Desconectar Kommo CRM?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja desconectar a integração Kommo? Os leads já sincronizados não serão removidos, mas novas sincronizações serão interrompidas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Sim, Desconectar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
