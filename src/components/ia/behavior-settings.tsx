'use client';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Save, Bot, Loader2, Share2, AlertTriangle, Clock, MessageSquare, Calendar, Play } from 'lucide-react';
import type { Persona as Agent } from '@/lib/types';
import { useState, useEffect, useMemo, useRef } from 'react';
import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { ResponseDelaySettings } from './response-delay-settings';
import { ELEVENLABS_VOICES_PT_BR, ELEVENLABS_VOICES_EN } from '@/lib/voice-options';

interface McpTool {
    name: string;
    description: string;
    input_schema?: {
        properties?: Record<string, any>;
        required?: string[];
    } | null;
}

export function BehaviorSettings({
    persona: agent,
    onSaveSuccess,
}: {
    persona: Agent | null;
    onSaveSuccess: (updatedAgent: Agent) => void;
}) {
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: agent?.name || '',
        systemPrompt: agent?.systemPrompt || '',
        provider: agent?.provider || 'GEMINI',
        model: agent?.model || 'gemini-2.0-flash-exp',
        credentialId: null,
        temperature: parseFloat(agent?.temperature || '0.7'),
        topP: parseFloat(agent?.topP || '0.9'),
        maxOutputTokens: agent?.maxOutputTokens || 2048,
        mcpServerUrl: agent?.mcpServerUrl || '',
        mcpServerHeaders: agent?.mcpServerHeaders ? JSON.stringify(agent.mcpServerHeaders, null, 2) : '',
        triggerKeywords: agent?.triggerKeywords?.join(', ') || '',
        isTriggerActive: agent?.isTriggerActive || false,
        useRag: agent?.useRag || false,
        firstResponseMinDelay: agent?.firstResponseMinDelay || 33,
        firstResponseMaxDelay: agent?.firstResponseMaxDelay || 68,
        followupResponseMinDelay: agent?.followupResponseMinDelay || 81,
        followupResponseMaxDelay: agent?.followupResponseMaxDelay || 210,
        // Follow-up Automático
        followupEnabled: agent?.followupEnabled || false,
        followupMode: (agent?.followupMode as 'minutes' | 'daily') || 'minutes',
        followupDelayMinutes: agent?.followupDelayMinutes || 30,
        followupDaysCount: agent?.followupDaysCount || 7,
        followupMaxAttempts: agent?.followupMaxAttempts || 3,
        followupMessages: agent?.followupMessages || [
            "Oi! Vi que você não respondeu... tudo bem por aí? 😊",
            "Ei, ainda está aí? Posso ajudar em algo mais?",
            "Última mensagem: se precisar, é só chamar! 🙌"
        ],
        // Voice Settings
        voiceProvider: agent?.voiceProvider || 'gemini',
        voiceId: agent?.voiceSettings?.voiceId || 'Aoede',
        voiceStability: agent?.voiceSettings?.stability || 0.5,
        voiceSimilarityBoost: agent?.voiceSettings?.similarityBoost || 0.75,
        voiceModel: agent?.voiceSettings?.modelId || 'eleven_multilingual_v2', // Default to V2
        // Agendamento
        enableScheduling: agent?.enableScheduling ?? true,
        schedulingPrompt: agent?.schedulingPrompt || '',
        meetingReminderEnabled: agent?.meetingReminderEnabled ?? false,
        meetingReminderMinutes: agent?.meetingReminderMinutes || 30,
    });

    const [availableTools, setAvailableTools] = useState<McpTool[]>([]);
    const [_isConnecting, _setIsConnecting] = useState(false);
    const [_connectionError, _setConnectionError] = useState<string | null>(null);

    // Audio Preview State
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);

    // Ref para rastrear o ID do agente e evitar resets desnecessários do formulário
    const prevAgentIdRef = useRef<string | undefined>(agent?.id);

    useEffect(() => {
        if (agent?.id !== prevAgentIdRef.current || (agent?.id && !prevAgentIdRef.current)) {
            setFormData({
                name: agent?.name || '',
                systemPrompt: agent?.systemPrompt || '',
                provider: agent?.provider || 'GEMINI',
                model: agent?.model || 'gemini-2.0-flash-exp',
                credentialId: null,
                temperature: parseFloat(agent?.temperature || '0.7'),
                topP: parseFloat(agent?.topP || '0.9'),
                maxOutputTokens: agent?.maxOutputTokens || 2048,
                mcpServerUrl: agent?.mcpServerUrl || '',
                mcpServerHeaders: agent?.mcpServerHeaders ? JSON.stringify(agent.mcpServerHeaders, null, 2) : '',
                triggerKeywords: agent?.triggerKeywords?.join(', ') || '',
                isTriggerActive: agent?.isTriggerActive || false,
                useRag: agent?.useRag || false,
                firstResponseMinDelay: agent?.firstResponseMinDelay || 33,
                firstResponseMaxDelay: agent?.firstResponseMaxDelay || 68,
                followupResponseMinDelay: agent?.followupResponseMinDelay || 81,
                followupResponseMaxDelay: agent?.followupResponseMaxDelay || 210,
                // Follow-up Automático
                followupEnabled: agent?.followupEnabled || false,
                followupMode: (agent?.followupMode as 'minutes' | 'daily') || 'minutes',
                followupDelayMinutes: agent?.followupDelayMinutes || 30,
                followupDaysCount: agent?.followupDaysCount || 7,
                followupMaxAttempts: agent?.followupMaxAttempts || 3,
                followupMessages: agent?.followupMessages || [
                    "Oi! Vi que você não respondeu... tudo bem por aí? 😊",
                    "Ei, ainda está aí? Posso ajudar em algo mais?",
                    "Última mensagem: se precisar, é só chamar! 🙌"
                ],
                // Agendamento
                enableScheduling: agent?.enableScheduling ?? true,
                schedulingPrompt: agent?.schedulingPrompt || '',
                meetingReminderEnabled: agent?.meetingReminderEnabled ?? false,
                meetingReminderMinutes: agent?.meetingReminderMinutes || 30,
                // Voice Settings
                voiceProvider: agent?.voiceProvider || 'gemini',
                voiceId: agent?.voiceSettings?.voiceId || 'Aoede',
                voiceStability: agent?.voiceSettings?.stability || 0.5,
                voiceSimilarityBoost: agent?.voiceSettings?.similarityBoost || 0.75,
                voiceModel: agent?.voiceSettings?.modelId || 'eleven_multilingual_v2',
            });
            prevAgentIdRef.current = agent?.id;
        }
    }, [agent]);

    const placeholderPrompt =
        "Você é o 'Zapito', o assistente virtual da Loja Master IA. Seu tom é amigável, prestativo e um pouco informal. NUNCA prometa descontos que não existam.";

    const modelsByProvider = {
        GEMINI: [
            { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
        ]
    };

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string | null) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSliderChange = (name: string, value: number[]) => {
        setFormData((prev) => ({ ...prev, [name]: value[0] }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        const url = agent?.id ? `/api/v1/ia/personas/${agent.id}` : '/api/v1/ia/personas';
        const method = agent?.id ? 'PUT' : 'POST';

        let parsedHeaders = {};
        try {
            if (formData.mcpServerHeaders.trim()) {
                parsedHeaders = JSON.parse(formData.mcpServerHeaders);
            }
        } catch (error) {
            notify.error('Erro no JSON de Headers', 'O formato dos cabeçalhos é inválido.');
            setIsSaving(false);
            return;
        }

        const { credentialId, ...payload } = formData;
        const triggerKeywordsArray = payload.triggerKeywords
            ? payload.triggerKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
            : [];

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...payload,
                    agentType: agent?.agentType || 'GENERAL',
                    temperature: payload.temperature.toString(),
                    topP: payload.topP.toString(),
                    mcpServerUrl: payload.mcpServerUrl || null,
                    mcpServerHeaders: parsedHeaders,
                    triggerKeywords: triggerKeywordsArray,
                    useRag: payload.useRag,
                    // Follow-up Automático
                    followupEnabled: payload.followupEnabled,
                    followupMode: payload.followupMode,
                    followupDelayMinutes: payload.followupDelayMinutes,
                    followupDaysCount: payload.followupDaysCount,
                    followupMaxAttempts: payload.followupMaxAttempts,
                    followupMessages: payload.followupMessages,
                    // Agendamento
                    enableScheduling: payload.enableScheduling,
                    schedulingPrompt: payload.schedulingPrompt || null,
                    meetingReminderEnabled: payload.meetingReminderEnabled,
                    meetingReminderMinutes: payload.meetingReminderMinutes,
                    // Voice
                    voiceProvider: payload.voiceProvider,
                    voiceSettings: {
                        voiceId: payload.voiceId,
                        stability: payload.voiceStability,
                        similarityBoost: payload.voiceSimilarityBoost,
                        speed: 1.0, // Default
                        modelId: payload.voiceModel || 'eleven_multilingual_v2',
                    }
                }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Falha ao salvar o agente.');

            notify.success('Agente Salvo!', `O agente "${result.name}" foi salvo com sucesso.`);
            onSaveSuccess(result);
        } catch (error) {
            notify.error('Erro ao Salvar', (error as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePlayPreview = async () => {
        if (isPlayingPreview) return;

        try {
            setIsPlayingPreview(true);
            const response = await fetch('/api/v1/ia/tts/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: "Olá, tudo bem?",
                    provider: formData.voiceProvider,
                    voiceId: formData.voiceId,
                    settings: {
                        stability: formData.voiceStability,
                        similarity_boost: formData.voiceSimilarityBoost, // ElevenLabs param name mismatch fix? check logic
                        // In automation-engine we passed 'voiceSimilarityBoost' to factory, 
                        // but ElevenLabs service expects 'similarity_boost' in settings object? 
                        // NO, ElevenLabs service sanitizes it: similarity_boost: settings?.similarity_boost
                        // In behavior-settings state we use 'voiceSimilarityBoost'.
                        // So let's pass it correctly mapped.
                        similarity_boost: formData.voiceSimilarityBoost,
                        style: 0,
                        use_speaker_boost: true,
                        model_id: formData.voiceModel
                    }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                // Detectar erro de quota do ElevenLabs
                if (err.errorType === 'quota_exceeded' || err.error?.includes('quota_exceeded')) {
                    const creditsMatch = err.error?.match(/(\d+) credits remaining/);
                    const remaining = creditsMatch ? creditsMatch[1] : '?';
                    throw new Error(`Quota ElevenLabs esgotada! Restam ${remaining} créditos. Recarregue sua conta em elevenlabs.io para continuar usando vozes premium.`);
                }
                throw new Error(err.error || 'Falha ao gerar preview');
            }

            const blob = await response.blob();
            const audio = new Audio(URL.createObjectURL(blob));
            audio.onended = () => setIsPlayingPreview(false);
            audio.onerror = () => {
                notify.error('Erro', 'Não foi possível reproduzir o áudio.');
                setIsPlayingPreview(false);
            };
            audio.play();

        } catch (error) {
            notify.error('Erro no Preview', (error as Error).message);
            setIsPlayingPreview(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <Bot className="h-6 w-6" />
                        Configurações Gerais do Agente
                    </CardTitle>
                    <CardDescription>
                        Defina a personalidade, instruções e o modelo de IA.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4 rounded-lg border p-4">
                        <Label htmlFor="persona-name">Nome do Agente</Label>
                        <Input id="persona-name" name="name" placeholder="Ex: Agente de Vendas" value={formData.name} onChange={handleInputChange} required />
                    </div>

                    <div className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="use-rag" className="text-base font-semibold">Sistema RAG</Label>
                                <p className="text-sm text-muted-foreground">Ative para usar prompts modulares.</p>
                            </div>
                            <Switch
                                id="use-rag"
                                checked={formData.useRag}
                                onCheckedChange={(checked) => setFormData({ ...formData, useRag: checked })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="system-prompt" className="text-base font-semibold">Instruções {formData.useRag && '(Inativo - Usando RAG)'}</Label>
                        <Textarea
                            id="system-prompt"
                            name="systemPrompt"
                            placeholder={placeholderPrompt}
                            className="min-h-[200px]"
                            value={formData.systemPrompt || ''}
                            onChange={handleInputChange}
                            disabled={formData.useRag}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                        <div className="space-y-2">
                            <Label>Provedor</Label>
                            <Select name="provider" value={formData.provider} onValueChange={(val) => handleSelectChange('provider', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="GEMINI">Google Gemini</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Modelo</Label>
                            <Select name="model" value={formData.model} onValueChange={(val) => handleSelectChange('model', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {modelsByProvider[formData.provider as keyof typeof modelsByProvider]?.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Configuração de Voz */}
                    <div className="space-y-4 rounded-lg border p-4">
                        <Label className="text-base font-semibold">Configuração de Voz (TTS)</Label>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Provedor de Voz</Label>
                                <Select
                                    value={formData.voiceProvider}
                                    onValueChange={(val) => setFormData(prev => ({
                                        ...prev,
                                        voiceProvider: val,
                                        voiceId: val === 'elevenlabs' ? '21m00Tcm4TlvDq8ikWAM' : 'Aoede'
                                    }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gemini">Google Gemini (Gratuito)</SelectItem>
                                        <SelectItem value="elevenlabs">ElevenLabs (Premium)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Voz</Label>
                                {formData.voiceProvider === 'gemini' ? (
                                    <Select
                                        value={formData.voiceId}
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, voiceId: val }))}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Aoede">Aoede (Feminina)</SelectItem>
                                            <SelectItem value="Puck">Puck (Masculina)</SelectItem>
                                            <SelectItem value="Charon">Charon (Masculina Profunda)</SelectItem>
                                            <SelectItem value="Kore">Kore (Feminina Suave)</SelectItem>
                                            <SelectItem value="Fenrir">Fenrir (Masculina Intensa)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Select
                                        value={formData.voiceId}
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, voiceId: val }))}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">🇧🇷 Português Brasil</div>
                                            {ELEVENLABS_VOICES_PT_BR.map(voice => (
                                                <SelectItem key={voice.id} value={voice.id}>
                                                    {voice.name} ({voice.description})
                                                </SelectItem>
                                            ))}
                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">🇺🇸 English</div>
                                            {ELEVENLABS_VOICES_EN.map(voice => (
                                                <SelectItem key={voice.id} value={voice.id}>
                                                    {voice.name} ({voice.description})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handlePlayPreview}
                                disabled={isPlayingPreview}
                                className="w-full sm:w-auto"
                            >
                                {isPlayingPreview ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Play className="mr-2 h-3 w-3" />}
                                {isPlayingPreview ? 'Reproduzindo...' : 'Testar Voz (Preview)'}
                            </Button>
                        </div>

                        {formData.voiceProvider === 'elevenlabs' && (
                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label>Modelo TTS (Latência vs Qualidade)</Label>
                                    <Select
                                        value={formData.voiceModel}
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, voiceModel: val }))}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="eleven_multilingual_v2">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">Eleven Multilingual v2 (Estável)</span>
                                                    <span className="text-xs text-muted-foreground">Entonação emocional consistente</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="eleven_turbo_v2_5">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">Eleven Turbo v2.5</span>
                                                    <span className="text-xs text-muted-foreground">Baixa latência, alta qualidade (Inglês/Português)</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="eleven_flash_v2_5">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">Eleven Flash v2.5</span>
                                                    <span className="text-xs text-muted-foreground">Ultra-rápido (75ms), ideal para respostas curtas</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="eleven_v3">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-amber-600">Eleven v3 (Alpha)</span>
                                                    <span className="text-xs text-muted-foreground">Máxima expressividade, mas ⚠️ alta latência</span>
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {formData.voiceModel === 'eleven_v3' && (
                                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 mt-2">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                                                <div className="text-sm text-amber-800">
                                                    <p className="font-semibold">Atenção: Modelo de Alta Latência</p>
                                                    <p className="text-xs mt-1">
                                                        O modelo <strong>v3 Alpha</strong> prioriza qualidade extrema e entendimento de contexto, mas pode demorar vários segundos para gerar áudio.
                                                        Recomendado apenas se a resposta imediata não for crítica.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label>Estabilidade ({formData.voiceStability})</Label>
                                        </div>
                                        <Slider
                                            min={0} max={1} step={0.01}
                                            value={[formData.voiceStability]}
                                            onValueChange={(vals) => setFormData(prev => ({ ...prev, voiceStability: vals[0] }))}
                                        />
                                        <p className="text-xs text-muted-foreground">Menor = Mais expressivo/variável, Maior = Mais consistente/robótico</p>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label>Similarity Boost ({formData.voiceSimilarityBoost})</Label>
                                        </div>
                                        <Slider
                                            min={0} max={1} step={0.01}
                                            value={[formData.voiceSimilarityBoost]}
                                            onValueChange={(vals) => setFormData(prev => ({ ...prev, voiceSimilarityBoost: vals[0] }))}
                                        />
                                        <p className="text-xs text-muted-foreground">Aumenta fidelidade à voz original (pode gerar artefatos se muito alto)</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <ResponseDelaySettings
                        firstResponseMinDelay={formData.firstResponseMinDelay}
                        firstResponseMaxDelay={formData.firstResponseMaxDelay}
                        followupResponseMinDelay={formData.followupResponseMinDelay}
                        followupResponseMaxDelay={formData.followupResponseMaxDelay}
                        onChange={(field, value) => setFormData((prev) => ({ ...prev, [field]: value }))}
                    />

                    <div className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">Gatilhos de Resposta</Label>
                            <Switch checked={formData.isTriggerActive} onCheckedChange={(val) => setFormData({ ...formData, isTriggerActive: val })} />
                        </div>
                        <Textarea
                            name="triggerKeywords"
                            placeholder="Ex: precinho, desconto, comprar"
                            value={formData.triggerKeywords}
                            onChange={handleInputChange}
                            disabled={!formData.isTriggerActive}
                        />
                    </div>



                    {/* Follow-up Automático */}
                    <div className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base font-semibold flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    Follow-up Automático
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Enviar mensagem automática quando o contato parar de responder.
                                </p>
                            </div>
                            <Switch
                                checked={formData.followupEnabled}
                                onCheckedChange={(val) => setFormData({ ...formData, followupEnabled: val })}
                            />
                        </div>

                        {formData.followupEnabled && (
                            <div className="space-y-4 pt-3 border-t">
                                {/* Seletor de Modo de Cadência */}
                                <div className="space-y-2">
                                    <Label>Modo de Cadência</Label>
                                    <Select
                                        value={formData.followupMode}
                                        onValueChange={(val: 'minutes' | 'daily') => setFormData({ ...formData, followupMode: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o modo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="minutes">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4" />
                                                    <span>Rápido (intervalo em minutos)</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="daily">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4" />
                                                    <span>Diário (uma mensagem por dia)</span>
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {formData.followupMode === 'minutes'
                                            ? 'Envia follow-up após X minutos de inatividade.'
                                            : 'Aguarda o tempo de espera e então envia uma mensagem por dia.'}
                                    </p>
                                </div>

                                {/* Tempo de espera - sempre visível */}
                                <div className="space-y-2">
                                    <Label>
                                        {formData.followupMode === 'minutes'
                                            ? 'Tempo de espera entre tentativas (minutos)'
                                            : 'Tempo de espera para iniciar (minutos)'}
                                    </Label>
                                    <Input
                                        type="number"
                                        min={5}
                                        max={1440}
                                        value={formData.followupDelayMinutes}
                                        onChange={(e) => setFormData({ ...formData, followupDelayMinutes: parseInt(e.target.value) || 30 })}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {formData.followupMode === 'minutes'
                                            ? 'Intervalo entre cada tentativa de follow-up.'
                                            : 'Tempo sem resposta antes de iniciar a cadência diária.'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Duração em dias - apenas no modo diário */}
                                    {formData.followupMode === 'daily' && (
                                        <div className="space-y-2">
                                            <Label>Duração (dias consecutivos)</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={30}
                                                value={formData.followupDaysCount}
                                                onChange={(e) => setFormData({ ...formData, followupDaysCount: parseInt(e.target.value) || 7 })}
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label>Máximo de mensagens</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={30}
                                            value={formData.followupMaxAttempts}
                                            onChange={(e) => setFormData({ ...formData, followupMaxAttempts: parseInt(e.target.value) || 3 })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Mensagens de follow-up (uma por linha)</Label>
                                    <Textarea
                                        placeholder="Oi! Vi que você não respondeu...\nEi, ainda está aí?"
                                        value={formData.followupMessages.join('\n')}
                                        onChange={(e) => setFormData({ ...formData, followupMessages: e.target.value.split('\n').filter(m => m.trim()) })}
                                        rows={4}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {formData.followupMode === 'minutes'
                                            ? 'As mensagens serão enviadas em sequência (1ª, 2ª, 3ª tentativa).'
                                            : `Cada mensagem será enviada em um dia. Se houver mais dias que mensagens, as mensagens serão repetidas.`}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Agendamento via Google Calendar */}
                    <div className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base font-semibold flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Agendamento via Calendar
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Permite que este agente agende reuniões no Google Calendar.
                                </p>
                            </div>
                            <Switch
                                checked={formData.enableScheduling}
                                onCheckedChange={(val) => setFormData({ ...formData, enableScheduling: val })}
                            />
                        </div>
                        {formData.enableScheduling && (
                            <div className="space-y-2 pt-2">
                                <Label htmlFor="schedulingPrompt" className="text-sm">Instruções de agendamento (opcional)</Label>
                                <Textarea
                                    id="schedulingPrompt"
                                    placeholder="Ex: Sempre sugira horários das 9h às 18h. Reuniões de 30 minutos. Pergunte o email antes de agendar."
                                    value={formData.schedulingPrompt}
                                    onChange={(e) => setFormData({ ...formData, schedulingPrompt: e.target.value })}
                                    rows={3}
                                    className="text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Instruções adicionais para o agente sobre como agendar reuniões.
                                </p>
                            </div>
                        )}
                        {formData.enableScheduling && (
                            <div className="space-y-3 pt-2 border-t border-border/50">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium flex items-center gap-2">
                                            🔔 Lembrete de Reunião
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Enviar lembrete via WhatsApp antes da reunião.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formData.meetingReminderEnabled}
                                        onCheckedChange={(val) => setFormData({ ...formData, meetingReminderEnabled: val })}
                                    />
                                </div>
                                {formData.meetingReminderEnabled && (
                                    <div className="space-y-1.5">
                                        <Label className="text-sm">Enviar lembrete</Label>
                                        <select
                                            className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                                            value={formData.meetingReminderMinutes}
                                            onChange={(e) => setFormData({ ...formData, meetingReminderMinutes: parseInt(e.target.value) })}
                                        >
                                            <option value={5}>5 minutos antes</option>
                                            <option value={30}>30 minutos antes</option>
                                            <option value={60}>1 hora antes</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <Card className="bg-muted/30">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Share2 className="h-4 w-4" /> Ferramentas Externas (MCP)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 py-3 px-4">
                            <Input name="mcpServerUrl" placeholder="URL do Servidor MCP" value={formData.mcpServerUrl} onChange={handleInputChange} />
                            <Textarea name="mcpServerHeaders" placeholder='Headers JSON Ex: { "Auth": "Bearer..." }' value={formData.mcpServerHeaders} onChange={handleInputChange} rows={2} />
                        </CardContent>
                    </Card>
                </CardContent>
                <CardFooter className="border-t pt-4">
                    <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar Comportamento
                    </Button>
                </CardFooter>
            </Card >
        </form >
    );
}
