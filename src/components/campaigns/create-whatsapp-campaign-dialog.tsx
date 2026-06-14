

'use client';

import * as React from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Template, ContactList, MediaAsset, HeaderType, Connection } from '@/lib/types';
import { Loader2, Info, ArrowLeft, CalendarIcon, Send, Clock, VideoIcon, FileText, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Separator } from '../ui/separator';
import { MediaUploader } from './media-uploader';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { TemplatePreview } from './TemplatePreview';
import { MultiListSelector, SelectedListsSummary } from './multi-list-selector';
import { AdvancedAudienceSelector } from './advanced-audience-selector';
import { useSession } from '@/contexts/session-context';
import { listFlows } from '@/lib/automations';

const contactFields = [
    { value: 'name', label: 'Nome' },
    { value: 'phone', label: 'Telefone' },
    { value: 'email', label: 'Email' },
    { value: 'addressStreet', label: 'Endereço (Rua)' },
    { value: 'addressCity', label: 'Endereço (Cidade)' },
];

const baseDelayOptions = [
    { value: 'fast', label: 'Rápido (2 a 5 segundos)', min: 2, max: 5, description: 'Indicado para números de alta reputação e bases quentes.' },
    { value: 'normal', label: 'Normal (5 a 15 segundos)', min: 5, max: 15, description: 'Equilíbrio entre velocidade e segurança.' },
    { value: 'safe', label: 'Seguro (15 a 30 segundos)', min: 15, max: 30, description: 'Mais seguro, previne bloqueios em envios longos.' },
];

const getSteps = (requiresMedia: boolean) => {
    const baseSteps = [
        { id: 'info', title: '1. Informações Básicas'},
        { id: 'content', title: '2. Conteúdo da Mensagem'},
    ];
    
    if (requiresMedia) {
        baseSteps.push({ id: 'media', title: 'Mídia da Mensagem' });
    }
    
    baseSteps.push({ id: 'audience', title: 'Público e Agendamento'});
    baseSteps.push({ id: 'review', title: 'Revisão e Envio'});
    
    // Auto-number the steps
    return baseSteps.map((step, index) => {
        const titleWithoutNumber = step.title.replace(/^\d+\.\s*/, '');
        return { ...step, title: `${index + 1}. ${titleWithoutNumber}` };
    });
};

type VariableMapping = {
    type: 'dynamic' | 'fixed';
    value: string;
};

interface CreateWhatsappCampaignDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    connections: Connection[];
    templates: Template[];
    isLoading: boolean;
    onBack: () => void;
    initialTemplate?: Template | null;
}

export function CreateWhatsappCampaignDialog({
    isOpen,
    onOpenChange,
    connections,
    templates,
    isLoading,
    onBack,
    initialTemplate = null
}: CreateWhatsappCampaignDialogProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const router = useRouter();

    const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

    const [availableAutomations, setAvailableAutomations] = useState<any[]>([]);
    const [selectedAutomationId, setSelectedAutomationId] = useState<string>('none');
    const { session } = useSession();

    const wabaId = useMemo(() => {
        return connections.find(c => c.id === selectedConnectionId)?.wabaId;
    }, [connections, selectedConnectionId]);

    const availableTemplates = useMemo(() => {
        if (!wabaId) return [];
        return templates.filter(t => t.wabaId === wabaId && (t.status === 'APPROVED' || t.status === 'APROVADO'));
    }, [templates, wabaId]);

    const selectedTemplate = useMemo(() => {
        return availableTemplates.find(t => t.id === selectedTemplateId);
    }, [availableTemplates, selectedTemplateId]);

    const [name, setName] = useState('');
    const [contactListIds, setContactListIds] = useState<string[]>([]);
    const [excludeListIds, setExcludeListIds] = useState<string[]>([]);
    const [tagIds, setTagIds] = useState<string[]>([]);
    const [excludeTagIds, setExcludeTagIds] = useState<string[]>([]);
    const [funnelIds, setFunnelIds] = useState<string[]>([]);
    const [funnelStageIds, setFunnelStageIds] = useState<string[]>([]);
    const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
    const [scheduleTime, setScheduleTime] = useState<string>('');
    const [sendNow, setSendNow] = useState(true);
    const [variableMappings, setVariableMappings] = useState<Record<string, VariableMapping>>({});
    const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null);
    const [mediaHandleId, setMediaHandleId] = useState<string | null>(null);
    const [availableLists, setAvailableLists] = useState<ContactList[]>([]);
    const [delayOption, setDelayOption] = useState<string>('normal');
    
    const isOfficialApi = useMemo(() => {
        return connections.find(c => c.id === selectedConnectionId)?.connectionType === 'meta_api';
    }, [connections, selectedConnectionId]);

    const delayOptions = useMemo(() => {
        if (isOfficialApi) {
            return [
                { value: 'none', label: 'Sem intervalo (0 segundos) - API Oficial', min: 0, max: 0, description: 'Disparo massivo instantâneo. Exclusivo para Meta API.' },
                ...baseDelayOptions
            ];
        }
        return baseDelayOptions;
    }, [isOfficialApi]);

    useEffect(() => {
        if (!isOfficialApi && delayOption === 'none') {
            setDelayOption('normal');
        }
    }, [isOfficialApi, delayOption]);
    
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);
    
    const resolvedHeaderType = useMemo(() => {
        if (selectedTemplate?.headerType) return selectedTemplate.headerType.toUpperCase();
        if (Array.isArray(selectedTemplate?.components)) {
             const header = selectedTemplate.components.find((c: any) => c.type === 'HEADER');
             return header?.format?.toUpperCase() || null;
        }
        return null;
    }, [selectedTemplate]);

    const requiresMedia = useMemo(() => {
        if (!resolvedHeaderType) return false;
        return ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(resolvedHeaderType);
    }, [resolvedHeaderType]);
    const steps = getSteps(requiresMedia);

    const templateParts = useMemo(() => {
        if (!selectedTemplate?.body) return [];
        return selectedTemplate.body.split(/(\{\{.*?\}\})/).map((part: string) => ({
          type: part.match(/(\{\{.*?\}\})/) ? 'variable' as const : 'text' as const,
          content: part,
          name: part.match(/\{\{(.*?)\}\}/)?.[1] || '',
        }));
    }, [selectedTemplate]);
    
    const variableNames = useMemo(() => 
        templateParts.filter((p) => p.type === 'variable').map((p) => p.name).filter((v, i, a) => a.indexOf(v) === i)
    , [templateParts]);

    useEffect(() => {
        if(isOpen) {
            fetch('/api/v1/lists?limit=0')
                .then(res => {
                    if (!res.ok) throw new Error('Falha ao carregar listas de contatos');
                    return res.json();
                })
                .then(data => setAvailableLists(data.data || []))
                .catch(error => {
                    notify.error('Erro', error.message);
                    setAvailableLists([]);
                });
                
            if (session?.empresaId) {
                listFlows(session.empresaId)
                    .then(flows => {
                        const filtered = (flows || []).filter(f => f.isActive);
                        setAvailableAutomations(filtered);
                    })
                    .catch(error => {
                        console.error('Erro ao carregar automações:', error);
                    });
            }
        }
    }, [isOpen, notify, session?.empresaId]);
    
    useEffect(() => {
        if(connections.length > 0 && !selectedConnectionId) {
            setSelectedConnectionId(connections[0]?.id || '');
        }
    }, [connections, selectedConnectionId]);
    
     useEffect(() => {
        if (initialTemplate) {
            const matchingConnection = connections.find(c => c.wabaId === initialTemplate.wabaId);
            if (matchingConnection) {
                setSelectedConnectionId(matchingConnection.id);
            }
            setSelectedTemplateId(initialTemplate.id);
        }
    }, [initialTemplate, connections]);
    
    useEffect(() => {
        if (selectedTemplate) {
            setName(`Campanha - ${selectedTemplate.name}`);
            const initialMappings: Record<string, VariableMapping> = {};
            
            // Tentar extrair valores de exemplo do template Meta API
            const bodyComponent = selectedTemplate.components?.find((c: any) => c.type === 'BODY');
            const exampleValues = bodyComponent?.example?.body_text?.[0] || [];
            
            variableNames.forEach((varName) => {
                // Converter nome da variável para índice numérico (ex: '1' -> 0, '2' -> 1)
                const varIndex = parseInt(varName, 10);
                const exampleIndex = !isNaN(varIndex) ? varIndex - 1 : -1;
                
                // Se houver valor de exemplo no índice correto, usar como fixed
                if (exampleIndex >= 0 && exampleValues[exampleIndex]) {
                    initialMappings[varName] = { type: 'fixed', value: exampleValues[exampleIndex] };
                } else {
                    // Senão, usar dynamic com fallback para 'name'
                    initialMappings[varName] = { type: 'dynamic', value: 'name' };
                }
            });
            setVariableMappings(initialMappings);
        } else {
            setName('');
            setVariableMappings({});
        }
    }, [selectedTemplate, variableNames]);

    const resetState = useCallback(() => {
        setIsProcessing(false);
        setCurrentStep(0);
        setSelectedConnectionId(connections[0]?.id || '');
        setSelectedTemplateId('');
        setName('');
        setContactListIds([]);
        setExcludeListIds([]);
        setTagIds([]);
        setExcludeTagIds([]);
        setFunnelIds([]);
        setFunnelStageIds([]);
        setScheduleDate(undefined);
        setScheduleTime('09:00');
        setSendNow(true);
        setVariableMappings({});
        setSelectedMedia(null);
        setMediaHandleId(null);
        setDelayOption('normal');
        setSelectedAutomationId('none');
    }, [connections]);

    const handleOpenChangeWithReset = (open: boolean) => {
        onOpenChange(open);
        if (!open) {
          resetState();
          onBack();
        }
    };
    
    const handleVariableMappingTypeChange = (variable: string, type: 'dynamic' | 'fixed') => {
        setVariableMappings(prev => ({
            ...prev,
            [variable]: { type, value: '' }
        }));
    };
    
    const handleVariableMappingValueChange = (variable: string, value: string) => {
        setVariableMappings(prev => ({ ...prev, [variable]: { type: prev[variable]?.type || 'fixed', value } }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedTemplate) {
            notify.error('Erro', 'O modelo de base não foi encontrado.');
            return;
        }
        
        if (contactListIds.length === 0 && tagIds.length === 0 && funnelIds.length === 0 && funnelStageIds.length === 0) {
            notify.error('Público Obrigatório', 'Por favor, selecione pelo menos uma lista, etiqueta, funil ou etapa.');
            return;
        }

        setIsProcessing(true);

        let schedule = null;
        if (!sendNow && scheduleDate) {
            const [hours, minutes] = scheduleTime.split(':').map(Number);
            const scheduledDateTime = new Date(scheduleDate);
            if (hours !== undefined && minutes !== undefined) {
                scheduledDateTime.setHours(hours, minutes, 0, 0);
            }
            schedule = scheduledDateTime.toISOString();
        }

        try {
            const selectedDelay = delayOptions.find(d => d.value === delayOption) || baseDelayOptions.find(d => d.value === 'normal') || baseDelayOptions[1];
            
            const payload = {
                name,
                connectionId: selectedConnectionId,
                templateId: selectedTemplate.id,
                variableMappings,
                contactListIds: contactListIds,
                excludeListIds,
                tagIds: tagIds,
                excludeTagIds: excludeTagIds,
                funnelIds: funnelIds,
                funnelStageIds: funnelStageIds,
                schedule,
                minDelaySeconds: selectedDelay?.min || 0,
                maxDelaySeconds: selectedDelay?.max || 0,
                mediaAssetId: selectedMedia?.id || undefined,
                mediaHandleId: mediaHandleId || undefined,
                automationFlowId: selectedAutomationId !== 'none' ? selectedAutomationId : undefined,
            };

            const response = await fetch('/api/v1/campaigns/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Falha ao criar a campanha.');
            }

            notify.success('Campanha Criada!', result.message || `A campanha "${name}" foi criada e está em processamento.`);
            
            handleOpenChangeWithReset(false);
            router.refresh();

        } catch (error) {
            notify.error('Erro ao Criar Campanha', error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleNextStep = async () => {
        const currentStepConfig = steps[currentStep];

        if (currentStepConfig?.id === 'info' && !selectedTemplate) {
            notify.error('Seleção Obrigatória', 'Por favor, selecione um modelo para continuar.');
            return;
        }

        if (currentStepConfig?.id === 'audience' && contactListIds.length === 0 && tagIds.length === 0 && funnelIds.length === 0 && funnelStageIds.length === 0) {
            notify.error('Público Obrigatório', 'Por favor, selecione pelo menos uma lista, etiqueta, funil ou etapa.');
            return;
        }

        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    }
    
    const handlePrevStep = () => {
         if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        } else {
            onBack();
        }
    }
    
    const currentStepConfig = steps[currentStep];
    const isMediaStep = currentStepConfig?.id === 'media';

    const renderStepContent = () => {
        const stepId = steps[currentStep]?.id;
        
        switch(stepId) {
            case 'info':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="campaign-name" className="text-zinc-700 dark:text-zinc-300">Nome da Campanha</Label>
                            <Input id="campaign-name" className="bg-white dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="connection-select" className="text-zinc-700 dark:text-zinc-300">Enviar de</Label>
                            <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                                <SelectTrigger className="bg-white dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:ring-emerald-500/30"><SelectValue placeholder="Selecione uma conexão"/></SelectTrigger>
                                <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">{connections.map(c => <SelectItem key={c.id} value={c.id} className="focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer">{c.config_name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="template-select" className="text-zinc-700 dark:text-zinc-300">Usando o Modelo</Label>
                            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                <SelectTrigger disabled={!wabaId} className="bg-white dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:ring-emerald-500/30 disabled:opacity-50"><SelectValue placeholder="Selecione um modelo"/></SelectTrigger>
                                <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">{availableTemplates.map(t => <SelectItem key={t.id} value={t.id} className="focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer">{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="automation-select" className="text-zinc-700 dark:text-zinc-300">Automação Associada (Opcional)</Label>
                            <Select value={selectedAutomationId} onValueChange={setSelectedAutomationId}>
                                <SelectTrigger className="bg-white dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:ring-emerald-500/30"><SelectValue placeholder="Selecione uma automação para iniciar após o envio"/></SelectTrigger>
                                <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
                                    <SelectItem value="none" className="focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer">Nenhuma (Apenas Envio)</SelectItem>
                                    {availableAutomations.map(a => <SelectItem key={a.id} value={a.id} className="focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer">{a.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-zinc-500 mt-1">O contato entrará neste fluxo caso responda a mensagem ou de acordo com as regras da automação.</p>
                        </div>
                    </div>
                )
            case 'content':
                return (
                     <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-zinc-700 dark:text-zinc-300">Mapeamento de Variáveis</Label>
                            <Card className="p-4 space-y-3 bg-white/[0.02] border-white/5 backdrop-blur-md">
                                <div className="flex items-start gap-2 text-xs text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]">
                                    <Info className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                                    <p>Associe cada variável a um campo do contato ou insira um valor fixo para todos.</p>
                                </div>
                                {variableNames.length === 0 ? (
                                    <p className="text-sm text-zinc-400">Este modelo não possui variáveis.</p>
                                ) : (
                                    variableNames.map((varName, index) => (
                                        <React.Fragment key={varName}>
                                        {index > 0 && <Separator />}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                            <div className="space-y-2">
                                                <Label className="font-semibold text-base text-white">{`{{${varName}}}`}</Label>
                                                <RadioGroup 
                                                    value={variableMappings[varName]?.type || 'fixed'} 
                                                    onValueChange={(type: 'dynamic' | 'fixed') => handleVariableMappingTypeChange(varName, type)}
                                                    className="pt-2"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="fixed" id={`fixed-${varName}`} className="border-white/20 text-emerald-500" />
                                                        <Label htmlFor={`fixed-${varName}`} className="text-zinc-700 dark:text-zinc-300">Valor Fixo</Label>
                                                    </div>
                                                     <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="dynamic" id={`dynamic-${varName}`} className="border-white/20 text-emerald-500" />
                                                        <Label htmlFor={`dynamic-${varName}`} className="text-zinc-700 dark:text-zinc-300">Campo do Contato</Label>
                                                    </div>
                                                </RadioGroup>
                                            </div>
                                            <div className="mt-1">
                                                {variableMappings[varName]?.type === 'dynamic' ? (
                                                     <Select value={variableMappings[varName]?.value || ''} onValueChange={(value) => handleVariableMappingValueChange(varName, value)}>
                                                        <SelectTrigger className="bg-white dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:ring-emerald-500/30"><SelectValue placeholder="Selecione um campo"/></SelectTrigger>
                                                        <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
                                                            {contactFields.map(field => <SelectItem key={field.value} value={field.value} className="focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer">{field.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Input className="bg-white dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50" placeholder="Digite o valor fixo" value={variableMappings[varName]?.value || ''} onChange={e => handleVariableMappingValueChange(varName, e.target.value)} />
                                                )}
                                            </div>
                                        </div>
                                        </React.Fragment>
                                    ))
                                )}
                            </Card>
                        </div>
                    </div>
                )
            case 'media':
                return (
                    <div className="space-y-4">
                        <Label>Mídia do Cabeçalho (Opcional)</Label>
                        <div className="text-sm text-muted-foreground space-y-2">
                            <p>Este modelo inclui uma mídia no cabeçalho. O sistema tentará usar automaticamente a mídia original aprovada.</p>
                            <p><strong>Atenção:</strong> Se o modelo foi importado do Gerenciador da Meta há muito tempo, o link original pode ter expirado (Erro 403). Nesse caso, faça o upload do arquivo novamente abaixo para garantir o envio.</p>
                        </div>
                        <MediaUploader
                            mediaType={resolvedHeaderType as HeaderType | null}
                            selectedMedia={selectedMedia}
                            connectionId={selectedConnectionId}
                            onMediaSelect={(asset) => setSelectedMedia(asset)}
                            onHandleGenerated={(handleId) => setMediaHandleId(handleId)}
                        />
                    </div>
                );
            case 'audience':
                 return (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <AdvancedAudienceSelector
                                availableLists={availableLists}
                                contactListIds={contactListIds}
                                setContactListIds={setContactListIds}
                                excludeListIds={excludeListIds}
                                setExcludeListIds={setExcludeListIds}
                                tagIds={tagIds}
                                setTagIds={setTagIds}
                                excludeTagIds={excludeTagIds}
                                setExcludeTagIds={setExcludeTagIds}
                                funnelIds={funnelIds}
                                setFunnelIds={setFunnelIds}
                                funnelStageIds={funnelStageIds}
                                setFunnelStageIds={setFunnelStageIds}
                            />
                        </div>
                        <div className="space-y-4 pt-2 border-t border-white/10 mt-4">
                            <Label className="text-base font-semibold text-white">Agendamento</Label>
                            
                            <Card className="p-4 border-dashed border-white/10 bg-white/[0.01]">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="send-now-checkbox-whatsapp">Enviar Imediatamente</Label>
                                            <p className="text-sm text-muted-foreground">Desmarque para agendar uma data futura</p>
                                        </div>
                                        <Checkbox id="send-now-checkbox-whatsapp" checked={sendNow} onCheckedChange={(checked) => setSendNow(!!checked)} />
                                    </div>
                                    
                                    {!sendNow && (
                                        <div className="flex flex-col sm:flex-row gap-2 pt-2 animate-in fade-in zoom-in-95 duration-200">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button type="button" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !scheduleDate && "text-muted-foreground")}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {scheduleDate ? format(scheduleDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                            <Input name="scheduleTime" type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full sm:w-auto" />
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="delay-select" className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Intervalo entre Mensagens
                            </Label>
                            <Select value={delayOption} onValueChange={setDelayOption}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o intervalo"/>
                                </SelectTrigger>
                                <SelectContent>
                                    {delayOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <div className="flex flex-col">
                                                <span>{opt.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {delayOptions.find(d => d.value === delayOption)?.description}
                            </p>
                        </div>
                    </div>
                );
            case 'review':
                return (
                    <div className="flex flex-col h-full flex-1 min-h-0">
                        <div className="space-y-4 text-sm flex-1 overflow-y-auto pr-2 min-h-0">
                            <h4 className="font-semibold text-lg">Revisar e Enviar</h4>
                            <div className="space-y-2">
                                <p><span className="font-semibold">Nome:</span> {name}</p>
                                <div><span className="font-semibold">Listas:</span> <SelectedListsSummary lists={availableLists} selectedIds={contactListIds} /></div>
                                <p><span className="font-semibold">Agendamento:</span> {sendNow ? 'Imediato' : `Para ${scheduleDate ? format(scheduleDate, 'dd/MM/yyyy') : 'data não definida'} às ${scheduleTime}`}</p>
                            </div>
                            
                            <div className="space-y-2">
                                <p className="font-semibold">Preview da Mensagem:</p>
                                <TemplatePreview
                                    components={selectedTemplate?.components || []}
                                    variableMappings={variableMappings}
                                    contactFieldsMap={Object.fromEntries(contactFields.map(f => [f.value, f.label]))}
                                    mediaUrl={null}
                                    compact
                                />
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChangeWithReset}>
            <DialogContent className="sm:max-w-[1200px] w-[95vw] h-[90vh] flex flex-col p-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-3xl border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 shadow-[0_0_50px_rgba(0,0,0,0.1)] dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
                <div className="flex flex-1 min-h-0 h-full">
                    {/* Left Sidebar: Steps */}
                    <div className="w-full max-w-[280px] border-r border-zinc-200 dark:border-white/10 bg-zinc-100/50 dark:bg-black/20 flex-col hidden md:flex">
                        <div className="p-6 border-b border-zinc-200 dark:border-white/10 flex items-center gap-3">
                            <Button type="button" variant="ghost" size="icon" onClick={handlePrevStep} className="h-8 w-8 hover:bg-zinc-200 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white text-zinc-500 dark:text-zinc-400 shrink-0">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">Nova Campanha</h2>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">WhatsApp Oficial</p>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {steps.map((step, idx) => {
                                const isActive = idx === currentStep;
                                const isPast = idx < currentStep;
                                return (
                                    <div key={step.id} className={cn("relative flex items-start p-3 rounded-lg transition-all duration-300", isActive ? "bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]" : (isPast ? "opacity-70" : "opacity-40"))}>
                                        {isActive && <motion.div layoutId="active-step-whatsapp" className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-l-lg shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
                                        <div className="flex flex-col ml-1">
                                            <span className={cn("text-sm font-semibold", isActive ? "text-emerald-500 dark:text-emerald-400" : "text-zinc-600 dark:text-white")}>{step.title}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Center Area: Form Content */}
                    <div className="flex-1 flex flex-col min-w-0 relative bg-white dark:bg-zinc-950/50">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500"/></div>
                        ) : (
                            <>
                                <div className="p-4 md:p-6 border-b border-zinc-200 dark:border-white/5 flex items-center justify-between bg-zinc-50 dark:bg-black/10">
                                    <div className="flex items-center gap-3 md:hidden">
                                        <Button type="button" variant="ghost" size="icon" onClick={handlePrevStep} className="h-8 w-8 hover:bg-zinc-200 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white text-zinc-500 dark:text-zinc-400 shrink-0">
                                            <ArrowLeft className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <h3 className="text-xl font-medium text-zinc-900 dark:text-white">{currentStepConfig?.title}</h3>
                                    <span className="text-sm text-zinc-500 hidden sm:block">Passo {currentStep + 1} de {steps.length}</span>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-4 md:p-6 relative min-h-0 custom-scrollbar">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={currentStep}
                                            initial={{ opacity: 0, x: 15 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -15 }}
                                            transition={{ duration: 0.2 }}
                                            className="h-full"
                                        >
                                            {renderStepContent()}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                <div className="p-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 flex justify-between items-center shrink-0">
                                    <Button type="button" variant="ghost" className="hover:bg-zinc-200 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white text-zinc-500 dark:text-zinc-400" onClick={() => handleOpenChangeWithReset(false)} disabled={isProcessing}>Cancelar</Button>
                                    <div className="flex gap-2">
                                        {currentStep > 0 && (
                                            <Button type="button" variant="outline" onClick={handlePrevStep} className="bg-transparent border-white/10 text-white hover:bg-white/5 hidden sm:flex">Voltar</Button>
                                        )}
                                        {currentStep === steps.length - 1 ? (
                                            <Button type="button" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all duration-300" onClick={handleSubmit} disabled={isProcessing || (contactListIds.length === 0 && tagIds.length === 0 && funnelIds.length === 0 && funnelStageIds.length === 0)}>
                                                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                {sendNow ? <><Send className="mr-2 h-4 w-4" /> Confirmar e Enviar</> : <><Clock className="mr-2 h-4 w-4" /> Confirmar Agendamento</>}
                                            </Button>
                                        ) : (
                                            <Button type="button" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all duration-300" onClick={handleNextStep} disabled={isProcessing || (!selectedTemplateId && currentStep === 0)}>
                                                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Avançar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right Area: Sticky Preview */}
                    {!isLoading && currentStepConfig?.id !== 'review' && (
                        <div className="w-full max-w-[350px] border-l border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#0b141a] flex-col relative hidden lg:flex shadow-none dark:shadow-[inset_10px_0_20px_rgba(0,0,0,0.5)]">
                            <div className="p-4 border-b border-zinc-200 dark:border-white/5 bg-white dark:bg-black/20">
                                <h3 className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                                    <VideoIcon className="h-4 w-4" />
                                    Visualização Dinâmica
                                </h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {selectedTemplate?.components ? (
                                    <TemplatePreview
                                        components={selectedTemplate.components as any}
                                        variableMappings={variableMappings}
                                        contactFieldsMap={contactFields.reduce((acc, field) => { acc[field.value] = field.label; return acc; }, {} as Record<string, string>)}
                                        mediaUrl={null}
                                    />
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40 text-sm p-4">
                                        <FileText className="h-10 w-10 mb-3 mx-auto text-zinc-500" />
                                        <p>Selecione um modelo para visualizar como a mensagem será recebida pelos contatos.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
