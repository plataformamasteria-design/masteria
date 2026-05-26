

'use client';

import * as React from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
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
        }
    }, [isOpen, notify]);
    
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
                            <Label htmlFor="campaign-name">Nome da Campanha</Label>
                            <Input id="campaign-name" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="connection-select">Enviar de</Label>
                            <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                                <SelectTrigger><SelectValue placeholder="Selecione uma conexão"/></SelectTrigger>
                                <SelectContent>{connections.map(c => <SelectItem key={c.id} value={c.id}>{c.config_name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="template-select">Usando o Modelo</Label>
                            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                <SelectTrigger disabled={!wabaId}><SelectValue placeholder="Selecione um modelo"/></SelectTrigger>
                                <SelectContent>{availableTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                )
            case 'content':
                return (
                     <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Mapeamento de Variáveis</Label>
                            <Card className="p-4 space-y-3">
                                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-500/10 p-2 rounded-md">
                                    <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                    <p>Associe cada variável a um campo do contato ou insira um valor fixo para todos.</p>
                                </div>
                                {variableNames.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Este modelo não possui variáveis.</p>
                                ) : (
                                    variableNames.map((varName, index) => (
                                        <React.Fragment key={varName}>
                                        {index > 0 && <Separator />}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                            <div className="space-y-2">
                                                <Label className="font-semibold text-base">{`{{${varName}}}`}</Label>
                                                <RadioGroup 
                                                    value={variableMappings[varName]?.type || 'fixed'} 
                                                    onValueChange={(type: 'dynamic' | 'fixed') => handleVariableMappingTypeChange(varName, type)}
                                                    className="pt-2"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="fixed" id={`fixed-${varName}`} />
                                                        <Label htmlFor={`fixed-${varName}`}>Valor Fixo</Label>
                                                    </div>
                                                     <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="dynamic" id={`dynamic-${varName}`} />
                                                        <Label htmlFor={`dynamic-${varName}`}>Campo do Contato</Label>
                                                    </div>
                                                </RadioGroup>
                                            </div>
                                            <div className="mt-1">
                                                {variableMappings[varName]?.type === 'dynamic' ? (
                                                     <Select value={variableMappings[varName]?.value || ''} onValueChange={(value) => handleVariableMappingValueChange(varName, value)}>
                                                        <SelectTrigger><SelectValue placeholder="Selecione um campo"/></SelectTrigger>
                                                        <SelectContent>
                                                            {contactFields.map(field => <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Input placeholder="Digite o valor fixo" value={variableMappings[varName]?.value || ''} onChange={e => handleVariableMappingValueChange(varName, e.target.value)} />
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
                        <div className="space-y-4 pt-2 border-t mt-4">
                            <Label className="text-base font-semibold">Agendamento</Label>
                            
                            <Card className="p-4 border-dashed bg-muted/30">
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
                        <DialogFooter className="pt-4 border-t mt-auto shrink-0">
                            <Button type="button" variant="secondary" onClick={() => setCurrentStep(steps.length - 2)} disabled={isProcessing}>Voltar</Button>
                            <Button type="submit" disabled={isProcessing || (contactListIds.length === 0 && tagIds.length === 0 && funnelIds.length === 0 && funnelStageIds.length === 0)} onClick={handleSubmit}>
                                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {sendNow ? (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        Confirmar e Enviar Agora
                                    </>
                                ) : (
                                    <>
                                        <Clock className="mr-2 h-4 w-4" />
                                        Confirmar e Agendar
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                );
            default:
                return null;
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChangeWithReset}>
            <DialogContent className="sm:max-w-4xl lg:max-w-5xl h-[90vh] flex flex-col p-6">
                <DialogHeader className="px-2">
                    <div className="flex items-center gap-2">
                         <Button type="button" variant="ghost" size="icon" onClick={handlePrevStep} className="h-8 w-8">
                            <ArrowLeft />
                        </Button>
                        <div>
                             <DialogTitle className="text-2xl font-bold tracking-tight">Criar Campanha WhatsApp</DialogTitle>
                             <DialogDescription className="text-base">{currentStepConfig?.title}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                {isLoading ? (
                    <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : currentStepConfig?.id === 'review' ? (
                     renderStepContent()
                ) : (
                <div className="flex-1 min-h-0 flex flex-col px-2">
                    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-8 py-4 flex-1 min-h-0 overflow-y-auto pr-2", isMediaStep && "md:grid-cols-1")}>
                        <div className={cn("space-y-6", isMediaStep && "md:col-span-2")}>
                           {renderStepContent()}
                        </div>
                        {!isMediaStep && selectedTemplate?.components && (() => {
                            const contactFieldsMapping = contactFields.reduce((acc, field) => {
                                acc[field.value] = field.label;
                                return acc;
                            }, {} as Record<string, string>);
                            
                            return (
                                <div className="space-y-2 hidden md:flex md:flex-col overflow-auto bg-muted/30 p-4 rounded-xl border border-border/50">
                                    <TemplatePreview
                                        components={selectedTemplate.components as any}
                                        variableMappings={variableMappings}
                                        contactFieldsMap={contactFieldsMapping}
                                        mediaUrl={null}
                                    />
                                </div>
                            );
                        })()}
                    </div>
                    <DialogFooter className="pt-4 border-t">
                        <div className="flex justify-end w-full">
                            <div className="flex gap-2">
                                <Button type="button" variant="secondary" onClick={() => handleOpenChangeWithReset(false)} disabled={isProcessing}>Cancelar</Button>
                                <Button type="button" onClick={handleNextStep} disabled={isProcessing || !selectedTemplateId}>
                                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Avançar
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
