'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Save, Info, ShoppingCart, Zap, Link as LinkIcon, QrCode, FileText, Plus, Trash2, Pencil, Loader2, ExternalLink, Mic, Volume2 } from 'lucide-react';
import type { Persona as Agent, AgentResource } from '@/lib/types';
import { createToastNotifier } from '@/lib/toast-helper';
import { useToast } from '@/hooks/use-toast';
import { ResourceForm } from './resource-form';
import { ELEVENLABS_VOICES_PT_BR, ELEVENLABS_VOICES_EN } from '@/lib/voice-options';

export function SalesSettings({
    persona: agent,
    onSaveSuccess,
}: {
    persona: Agent | null;
    onSaveSuccess: (updatedAgent: Agent) => void;
}) {
    const { toast } = useToast();
    const notify = React.useMemo(() => createToastNotifier(toast), [toast]);
    const [isSaving, setIsSaving] = useState(false);
    const [editingResource, setEditingResource] = useState<AgentResource | null>(null);
    const [isAddResourceDialogOpen, setIsAddResourceDialogOpen] = useState(false);
    const [editingResourceDialogOpen, setEditingResourceDialogOpen] = useState<string | null>(null);


    // Estado principal unificado para comportamentos de venda
    const [variables, setVariables] = useState<Record<string, string>>(agent?.variables || {
        PRODUTO: '',
        PRECO_CHEIO: '',
        PRECO_PIX: '',
        LINK_CHECKOUT: '',
        CHAVE_PIX: ''
    });

    const [presets, setPresets] = useState(agent?.behaviorPresets || {
        useAbbreviations: true,
        maxEmojisPerMessage: 2,
        boldSingleCTA: true,
        splitResources: true,
        variedGreetings: ["Boa", "Show", "Entendi", "Certo", "Bora", "Combinado"]
    });

    const [audioModeEnabled, setAudioModeEnabled] = useState(agent?.audioModeEnabled ?? false);
    const [audioMode, setAudioMode] = useState<'text' | 'audio' | 'both'>(agent?.audioMode || 'text');
    const [voiceProvider, setVoiceProvider] = useState<'gemini' | 'elevenlabs'>(agent?.voiceProvider || 'gemini');
    const [voiceSettings, setVoiceSettings] = useState(agent?.voiceSettings || {
        voiceId: 'Aoede',
        speed: 1.0,
        stability: 0.5,
        similarityBoost: 0.75, // ElevenLabs default
        style: 0.0, // ElevenLabs default
        useSpeakerBoost: true // ElevenLabs default
    });

    const [resources, setResources] = useState<AgentResource[]>(agent?.resources || []);

    useEffect(() => {
        if (agent) {
            setVariables(agent.variables || {
                PRODUTO: '',
                PRECO_CHEIO: '',
                PRECO_PIX: '',
                LINK_CHECKOUT: '',
                CHAVE_PIX: ''
            });
            setPresets(agent.behaviorPresets || {
                useAbbreviations: true,
                maxEmojisPerMessage: 2,
                boldSingleCTA: true,
                splitResources: true,
                variedGreetings: ["Boa", "Show", "Entendi", "Certo", "Bora", "Combinado"]
            });
            setAudioModeEnabled(agent.audioModeEnabled ?? false);
            setAudioMode(agent.audioMode || 'text');
            setVoiceProvider(agent.voiceProvider || 'gemini');
            setVoiceSettings(agent.voiceSettings || {
                voiceId: 'Aoede',
                speed: 1.0,
                stability: 0.5,
                similarityBoost: 0.75,
                style: 0.0,
                useSpeakerBoost: true
            });
            setResources(agent.resources || []);
        }
    }, [agent]);

    const handleVariableChange = (key: string, value: string) => {
        setVariables(prev => ({ ...prev, [key]: value }));
    };

    const handlePresetChange = (key: string, value: any) => {
        setPresets(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async () => {
        if (!agent?.id) return;
        setIsSaving(true);

        try {
            const response = await fetch(`/api/v1/ia/personas/${agent.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...agent,
                    variables,
                    behaviorPresets: presets,
                    audioModeEnabled,
                    audioMode,
                    voiceProvider,
                    voiceSettings,
                    resources
                }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Falha ao salvar as configurações de venda.');

            notify.success('Configurações Salvas!', 'As diretrizes de venda e humanização foram atualizadas.');
            onSaveSuccess(result);
        } catch (error: any) {
            notify.error('Erro ao salvar', error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* ✅ SECTION 0: VARIÁVEIS DE PRODUTO */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <ShoppingCart className="h-5 w-5 text-green-600" />
                        Variáveis de Oferta (O que o Agente Vende)
                    </CardTitle>
                    <CardDescription>
                        Defina os valores e links oficiais. O sistema usará estes campos para injetar informações corretas no chat.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="var-produto">Nome do Produto</Label>
                        <Input
                            id="var-produto"
                            placeholder="Ex: Método Master IA"
                            value={variables.PRODUTO}
                            onChange={(e) => handleVariableChange('PRODUTO', e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="var-checkout">Link de Checkout (Cartão)</Label>
                        <Input
                            id="var-checkout"
                            placeholder="https://pay.hotmart.com/..."
                            value={variables.LINK_CHECKOUT}
                            onChange={(e) => handleVariableChange('LINK_CHECKOUT', e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="var-preco-cheio">Preço Padrão (Cartão)</Label>
                        <Input
                            id="var-preco-cheio"
                            placeholder="Ex: R$ 97,00"
                            value={variables.PRECO_CHEIO}
                            onChange={(e) => handleVariableChange('PRECO_CHEIO', e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="var-preco-pix">Preço com Desconto (PIX)</Label>
                        <Input
                            id="var-preco-pix"
                            placeholder="Ex: R$ 49,90"
                            value={variables.PRECO_PIX}
                            onChange={(e) => handleVariableChange('PRECO_PIX', e.target.value)}
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="var-pix">Chave PIX (Manual ou Copia/Cola)</Label>
                        <Input
                            id="var-pix"
                            placeholder="Sua chave pix aqui..."
                            value={variables.CHAVE_PIX}
                            onChange={(e) => handleVariableChange('CHAVE_PIX', e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* ✅ SECTION 1: RECURSOS & LINKS (BANCO DE DADOS) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <LinkIcon className="h-5 w-5 text-blue-600" />
                        Banco de Recursos (Links, Pix, Checkouts)
                    </CardTitle>
                    <CardDescription>
                        Cadastre conteúdos extras que o agente pode enviar. Ele saberá quando usar cada um.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-end">
                        <Dialog open={isAddResourceDialogOpen} onOpenChange={(open) => {
                            setIsAddResourceDialogOpen(open);
                            if (!open) setEditingResource(null);
                        }}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => {
                                    setEditingResource(null);
                                    setIsAddResourceDialogOpen(true);
                                }}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Adicionar Conteúdo
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{editingResource ? 'Editar Recurso' : 'Novo Recurso'}</DialogTitle>
                                    <DialogDescription>O agente usará o nome e a descrição para identificar este recurso.</DialogDescription>
                                </DialogHeader>
                                <ResourceForm
                                    initialData={editingResource}
                                    onSave={(resource) => {
                                        setResources(prev => {
                                            if (prev.some(r => r.id === resource.id)) {
                                                return prev.map(r => r.id === resource.id ? resource : r);
                                            }
                                            return [...prev, resource];
                                        });
                                        setEditingResource(null);
                                    }}
                                    onClose={() => setIsAddResourceDialogOpen(false)}
                                />
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid gap-2">
                        {resources.length === 0 && (
                            <div className="text-center p-6 border border-dashed rounded-lg text-muted-foreground text-xs">
                                Nenhum recurso cadastrado além das variáveis básicas.
                            </div>
                        )}
                        {resources.map((resource) => (
                            <div key={resource.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${resource.type === 'PIX' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {resource.type === 'PIX' && <QrCode className="h-4 w-4" />}
                                        {resource.type === 'LINK' && <ExternalLink className="h-4 w-4" />}
                                        {resource.type === 'TEXT' && <FileText className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">{resource.name}</p>
                                        <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{resource.content}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Dialog
                                        open={editingResourceDialogOpen === resource.id}
                                        onOpenChange={(open) => {
                                            if (open) {
                                                setEditingResourceDialogOpen(resource.id);
                                            } else {
                                                setEditingResourceDialogOpen(null);
                                            }
                                        }}
                                    >
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => setEditingResourceDialogOpen(resource.id)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader><DialogTitle>Editar Recurso</DialogTitle></DialogHeader>
                                            <ResourceForm
                                                initialData={resource}
                                                onSave={(updated) => {
                                                    setResources(prev => prev.map(r => r.id === updated.id ? updated : r));
                                                }}
                                                onClose={() => setEditingResourceDialogOpen(null)}
                                            />
                                        </DialogContent>
                                    </Dialog>
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                                        setResources(prev => prev.filter(r => r.id !== resource.id));
                                    }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* ✅ SECTION 2: VOZ & ENVIO (NOVO) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Mic className="h-5 w-5 text-purple-600" />
                        Preferências de Voz & Envio
                    </CardTitle>
                    <CardDescription>
                        Escolha como o agente deve responder no WhatsApp: texto, áudio ou uma combinação de ambos.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-semibold">Modo de Resposta Manual</Label>
                                <p className="text-[10px] text-muted-foreground">
                                    {audioModeEnabled
                                        ? 'Ativado — Seguindo o modo selecionado abaixo.'
                                        : 'Desativado — Seguindo a Inteligência Comportamental do contato (VAK).'
                                    }
                                </p>
                            </div>
                            <Switch checked={audioModeEnabled} onCheckedChange={setAudioModeEnabled} />
                        </div>

                        {audioModeEnabled && (
                            <div className="pl-4 border-l-2 border-purple-300 space-y-2">
                                <Label className="text-xs text-muted-foreground">Modo Fixo</Label>
                                <Select value={audioMode} onValueChange={(val: any) => setAudioMode(val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o modo de resposta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="text">Só Texto</SelectItem>
                                        <SelectItem value="audio">Só Áudio (Consultor Real)</SelectItem>
                                        <SelectItem value="both">Texto + Áudio (Máximo Engajamento)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    * O modo &quot;Texto + Áudio&quot; também considera a Inteligência Comportamental do contato.
                                </p>
                            </div>
                        )}
                    </div>

                    {(!audioModeEnabled || audioMode === 'audio' || audioMode === 'both') && (
                        <div className="space-y-6 pt-4 border-t">
                            <p className="text-[10px] text-muted-foreground italic">
                                {!audioModeEnabled
                                    ? '⚡ Configurações de voz — usadas quando a Inteligência Comportamental decidir enviar áudio.'
                                    : '🎤 Configurações de voz para o modo selecionado.'
                                }
                            </p>
                            {/* SELEÇÃO DO PROVEDOR */}
                            <div className="space-y-3">
                                <Label className="font-semibold">Provedor de Voz</Label>
                                <Select
                                    value={voiceProvider}
                                    onValueChange={(val: 'gemini' | 'elevenlabs') => {
                                        setVoiceProvider(val);
                                        // Resetar para um ID válido ao trocar de provedor
                                        if (val === 'elevenlabs') {
                                            setVoiceSettings(prev => ({ ...prev, voiceId: '21m00Tcm4TlvDq8ikWAM' })); // Rachel
                                        } else {
                                            setVoiceSettings(prev => ({ ...prev, voiceId: 'Aoede' }));
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o provedor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gemini">Google Gemini (Rápido & Gratuito)</SelectItem>
                                        <SelectItem value="elevenlabs">ElevenLabs (Ultra Realista - Premium)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <Label className="flex items-center gap-2">
                                        <Volume2 className="h-4 w-4" /> Voz da IA
                                    </Label>
                                    <Select
                                        value={voiceSettings.voiceId}
                                        onValueChange={(val) => setVoiceSettings(prev => ({ ...prev, voiceId: val }))}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {voiceProvider === 'gemini' ? (
                                                <>
                                                    <SelectItem value="Aoede">Aoede (Feminina, Profissional)</SelectItem>
                                                    <SelectItem value="Charon">Charon (Masculina, Casual)</SelectItem>
                                                    <SelectItem value="Fenrir">Fenrir (Masculina, Autoridade)</SelectItem>
                                                    <SelectItem value="Kore">Kore (Feminina, Jovem)</SelectItem>
                                                </>
                                            ) : (
                                                <>
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
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-6">
                                    {voiceProvider === 'gemini' ? (
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <Label>Velocidade: {voiceSettings.speed}x</Label>
                                            </div>
                                            <Slider
                                                min={0.5}
                                                max={2.0}
                                                step={0.1}
                                                value={[voiceSettings.speed || 1.0]}
                                                onValueChange={(val) => setVoiceSettings(prev => ({ ...prev, speed: val[0] }))}
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <Label>Estabilidade: {voiceSettings.stability}</Label>
                                                </div>
                                                <Slider
                                                    min={0}
                                                    max={1}
                                                    step={0.05}
                                                    value={[voiceSettings.stability || 0.5]}
                                                    onValueChange={(val) => setVoiceSettings(prev => ({ ...prev, stability: val[0] }))}
                                                />
                                                <p className="text-[10px] text-muted-foreground">Maior = Mais consistente (menos emoção).</p>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <Label>Similarity Boost: {voiceSettings.similarityBoost}</Label>
                                                </div>
                                                <Slider
                                                    min={0}
                                                    max={1}
                                                    step={0.05}
                                                    value={[voiceSettings.similarityBoost || 0.75]}
                                                    onValueChange={(val) => setVoiceSettings(prev => ({ ...prev, similarityBoost: val[0] }))}
                                                />
                                                <p className="text-[10px] text-muted-foreground">Maior = Mais fiel à voz original (pode gerar artefatos).</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ✅ SECTION 3: HUMANIZAÇÃO */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Zap className="h-5 w-5 text-amber-500" />
                        Presets de Humanização & Resposta
                    </CardTitle>
                    <CardDescription>
                        Configure como as mensagens são processadas e enviadas para o WhatsApp.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-semibold">Abreviações Naturais</Label>
                            <p className="text-[10px] text-muted-foreground">Transforma &quot;você&quot; em &quot;vc&quot;, &quot;também&quot; em &quot;tbm&quot;, etc.</p>
                        </div>
                        <Switch checked={presets.useAbbreviations} onCheckedChange={(val) => handlePresetChange('useAbbreviations', val)} />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-semibold">Envio em Bolhas (Split Links)</Label>
                            <p className="text-[10px] text-muted-foreground">Envia links e Pix em uma mensagem separada (Anti-BAN).</p>
                        </div>
                        <Switch checked={presets.splitResources} onCheckedChange={(val) => handlePresetChange('splitResources', val)} />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-semibold">Negrito em Valor/CTA</Label>
                            <p className="text-[10px] text-muted-foreground">Destaque apenas o CTA principal com *negrito*.</p>
                        </div>
                        <Switch checked={presets.boldSingleCTA} onCheckedChange={(val) => handlePresetChange('boldSingleCTA', val)} />
                    </div>

                    <div className="space-y-3 pt-2">
                        <Label className="text-sm font-semibold">Saudações Variadas (Evita &quot;Perfeito&quot;)</Label>
                        <div className="flex flex-wrap gap-2">
                            {presets.variedGreetings.map((g: string, i: number) => (
                                <Badge key={i} variant="secondary">{g}</Badge>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Aberturas automáticas para manter a conversa natural e imprevisível.</p>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/10 border-t pt-4">
                    <Button
                        onClick={handleSubmit}
                        disabled={isSaving || !agent?.id}
                        className="w-full sm:w-auto ml-auto"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Salvar Diretrizes de Venda
                    </Button>
                </CardFooter>
            </Card>

            <div className="flex items-center gap-2 p-4 rounded-lg bg-blue-50 border border-blue-100 text-blue-800 text-[13px]">
                <Info className="h-5 w-5 shrink-0" />
                <p>
                    <b>Impacto:</b> Configurações estruturadas aqui têm maior peso que o prompt livre, garantindo que o agente nunca &quot;alucine&quot; preços ou links de pagamento.
                </p>
            </div>
        </div>
    );
}
