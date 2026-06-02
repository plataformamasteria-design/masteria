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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ContactList, Connection } from '@/lib/types';
import { Loader2, Info, ArrowLeft, CalendarIcon, Send, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Separator } from '../ui/separator';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '../ui/alert';
import { SelectedListsSummary } from './multi-list-selector';
import { AdvancedAudienceSelector } from './advanced-audience-selector';

const contactFields = [
    { value: 'name', label: 'Nome' },
    { value: 'phone', label: 'Telefone' },
    { value: 'email', label: 'Email' },
    { value: 'addressStreet', label: 'Endereço (Rua)' },
    { value: 'addressCity', label: 'Endereço (Cidade)' },
];

const steps = [
    { id: 'info', title: '1. Informações Básicas'},
    { id: 'message', title: '2. Compor Mensagem'},
    { id: 'audience', title: '3. Público e Agendamento'},
    { id: 'review', title: '4. Revisão e Envio'},
];

type VariableMapping = {
    type: 'dynamic' | 'fixed';
    value: string;
};

interface CreateBaileysCampaignDialogProps {
    children: React.ReactNode;
}

export function CreateBaileysCampaignDialog({ children }: CreateBaileysCampaignDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const router = useRouter();

    const [connections, setConnections] = useState<Connection[]>([]);
    const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
    const [name, setName] = useState('');
    const [nameError, setNameError] = useState('');
    const [messageText, setMessageText] = useState('');
    const [messageError, setMessageError] = useState('');
    const [contactListIds, setContactListIds] = useState<string[]>([]);
    const [excludeListIds, setExcludeListIds] = useState<string[]>([]);
    const [tagIds, setTagIds] = useState<string[]>([]);
    const [excludeTagIds, setExcludeTagIds] = useState<string[]>([]);
    const [funnelIds, setFunnelIds] = useState<string[]>([]);
    const [funnelStageIds, setFunnelStageIds] = useState<string[]>([]);
    const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
    const [scheduleTime, setScheduleTime] = useState('09:00');
    const [sendNow, setSendNow] = useState(true);
    const [variableMappings, setVariableMappings] = useState<Record<string, VariableMapping>>({});
    const [delayOption, setDelayOption] = useState<string>('fast');
    const [disableBotOnSend, setDisableBotOnSend] = useState<boolean>(false);

    const delayOptions = [
        { value: 'fast', label: 'Rápido (11-33s)', minDelay: 11, maxDelay: 33, description: 'Mais rápido, maior risco de bloqueio' },
        { value: 'normal', label: 'Normal (61-121s)', minDelay: 61, maxDelay: 121, description: 'Equilibrado, recomendado' },
        { value: 'safe', label: 'Seguro (210-341s)', minDelay: 210, maxDelay: 341, description: 'Mais lento, menor risco' },
    ];
    const [availableLists, setAvailableLists] = useState<ContactList[]>([]);
    
    const { toast } = useToast();
    const notify = useMemo(() => {
        if (typeof createToastNotifier !== 'undefined' && createToastNotifier && typeof toast !== 'undefined') {
            return createToastNotifier(toast);
        }
        return {
            error: (title: string, msg: string) => console.error(`${title}: ${msg}`),
            success: (title: string, msg: string) => console.log(`${title}: ${msg}`),
        };
    }, [toast]);

    const baileysConnections = useMemo(() => {
        return connections.filter(c => c.connectionType === 'baileys' && c.isActive);
    }, [connections]);

    const extractVariables = useCallback((text: string): string[] => {
        const regex = /\{\{(\d+)\}\}/g;
        const matches = text.match(regex);
        if (!matches) return [];
        return [...new Set(matches.map(m => m.match(/\d+/)?.[0] || ''))].filter(Boolean);
    }, []);

    const variableNames = useMemo(() => extractVariables(messageText), [messageText, extractVariables]);

    useEffect(() => {
        const checkForTemplate = () => {
            try {
                const templateData = localStorage.getItem('selectedTemplate');
                if (templateData) {
                    const template = JSON.parse(templateData);
                    setMessageText(template.content || '');
                    setCurrentStep(1);
                    setIsOpen(true);
                }
            } catch (error) {
                console.error('Error loading template:', error);
            }
        };
        
        checkForTemplate();
    }, []);

    useEffect(() => {
        if (isOpen) {
            const fetchData = async () => {
                try {
                    const [connRes, listsRes] = await Promise.all([
                        fetch('/api/v1/connections'),
                        fetch('/api/v1/lists?limit=0')
                    ]);
                    if (!connRes.ok || !listsRes.ok) {
                        throw new Error('Falha ao carregar dados necessários');
                    }
                    
                    const connData = await connRes.json();
                    const listsData = await listsRes.json();
                    
                    setConnections(connData);
                    setAvailableLists(listsData.data || []);
                    
                    const firstBaileys = connData.find((c: Connection) => 
                        c.connectionType === 'baileys' && c.isActive
                    );
                    if (firstBaileys) {
                        setSelectedConnectionId(firstBaileys.id);
                    }
                } catch (error) {
                    if (typeof notify?.error === 'function') {
                        notify.error('Erro', 'Falha ao carregar dados.');
                    }
                }
            };
            fetchData();
        }
    }, [isOpen, notify]);

    useEffect(() => {
        const initialMappings: Record<string, VariableMapping> = {};
        variableNames.forEach(num => {
            initialMappings[num] = variableMappings[num] || { type: 'fixed', value: '' };
        });
        setVariableMappings(initialMappings);
    }, [variableNames]);

    const highlightMessage = useCallback(() => {
        if (!messageText) return '';
        return messageText.split(/(\{\{\d+\}\})/).map((part, index) => {
          const match = part.match(/\{\{(\d+)\}\}/);
          if (match) {
            const varNum = match[1];
            const mapping = variableMappings[varNum!];
            if (mapping?.type === 'fixed' && mapping.value) {
                 return ( <span key={index} className="font-bold text-green-500">{mapping.value}</span> )
            }
            if (mapping?.type === 'dynamic' && mapping.value) {
                const mappedField = contactFields.find(f => f.value === mapping.value);
                return ( <span key={index} className="font-bold text-primary">[{mappedField?.label.toUpperCase()}]</span> )
            }
            return ( <span key={index} className="font-bold text-yellow-500">{part}</span> )
          }
          return part;
        });
    }, [messageText, variableMappings]);

    const resetState = useCallback(() => {
        setIsProcessing(false);
        setCurrentStep(0);
        setSelectedConnectionId('');
        setName('');
        setNameError('');
        setMessageText('');
        setMessageError('');
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
        setDelayOption('fast');
        setDisableBotOnSend(false);
    }, []);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
          resetState();
          localStorage.removeItem('selectedTemplate');
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

    const insertVariable = (varNumber: string) => {
        const cursorPos = document.getElementById('message-textarea') as HTMLTextAreaElement;
        if (!cursorPos) return;
        
        const start = cursorPos.selectionStart;
        const end = cursorPos.selectionEnd;
        const text = messageText;
        const before = text.substring(0, start);
        const after = text.substring(end);
        const newText = before + `{{${varNumber}}}` + after;
        
        setMessageText(newText);
        setTimeout(() => {
            cursorPos.focus();
            const newPos = start + `{{${varNumber}}}`.length;
            cursorPos.setSelectionRange(newPos, newPos);
        }, 0);
    };

    const validateName = (value: string): boolean => {
        if (!value.trim()) {
            setNameError('Nome da campanha é obrigatório');
            return false;
        }
        if (value.trim().length < 3) {
            setNameError('Nome deve ter pelo menos 3 caracteres');
            return false;
        }
        setNameError('');
        return true;
    };

    const validateMessage = (value: string): boolean => {
        if (!value.trim()) {
            setMessageError('Mensagem é obrigatória');
            return false;
        }
        if (value.trim().length < 5) {
            setMessageError('Mensagem deve ter pelo menos 5 caracteres');
            return false;
        }
        setMessageError('');
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateName(name)) {
            if (typeof notify?.error === 'function') {
                notify.error('Nome Obrigatório', nameError);
            }
            return;
        }

        if (!validateMessage(messageText)) {
            if (typeof notify?.error === 'function') {
                notify.error('Mensagem Obrigatória', messageError);
            }
            return;
        }
        
        if (contactListIds.length === 0 && tagIds.length === 0 && funnelIds.length === 0 && funnelStageIds.length === 0) {
            if (typeof notify?.error === 'function') {
                notify.error('Público Obrigatório', 'Por favor, selecione pelo menos uma lista, etiqueta, funil ou etapa.');
            }
            return;
        }

        const unmappedVars = variableNames.filter(v => !variableMappings[v]?.value);
        if (unmappedVars.length > 0) {
            if (typeof notify?.error === 'function') {
                notify.error('Variáveis Pendentes', `As variáveis {{${unmappedVars.join('}}, {{')}}}} não foram mapeadas.`);
            }
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
            const selectedDelay = delayOptions.find(d => d.value === delayOption);
            const payload = {
                name,
                connectionId: selectedConnectionId,
                messageText,
                variableMappings,
                contactListIds,
                excludeListIds,
                tagIds,
                excludeTagIds,
                funnelIds,
                funnelStageIds,
                schedule,
                minDelaySeconds: selectedDelay?.minDelay || 11,
                maxDelaySeconds: selectedDelay?.maxDelay || 33,
                disableBot: disableBotOnSend,
            };

            const response = await fetch('/api/v1/campaigns/baileys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Falha ao criar a campanha.');
            }

            if (typeof notify?.success === 'function') {
                notify.success('Campanha Criada!', result.message || `A campanha "${name}" foi criada com sucesso.`);
            }
            
            handleOpenChange(false);
            router.refresh();

        } catch (error) {
            if (typeof notify?.error === 'function') {
                notify.error('Erro ao Criar Campanha', error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
            }
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleNextStep = () => {
        const currentStepConfig = steps[currentStep];

        if (currentStepConfig?.id === 'info') {
            if (!selectedConnectionId) {
                if (typeof notify?.error === 'function') {
                    notify.error('Conexão Obrigatória', 'Selecione uma conexão WhatsApp Business.');
                }
                return;
            }
        }

        if (currentStepConfig?.id === 'message') {
            if (!validateMessage(messageText)) {
                if (typeof notify?.error === 'function') {
                    notify.error('Mensagem Obrigatória', messageError);
                }
                return;
            }
        }

        if (currentStepConfig?.id === 'audience' && contactListIds.length === 0 && tagIds.length === 0 && funnelIds.length === 0 && funnelStageIds.length === 0) {
            if (typeof notify?.error === 'function') {
                notify.error('Público Obrigatório', 'Selecione pelo menos uma lista, etiqueta, funil ou etapa.');
            }
            return;
        }

        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };
    
    const handlePrevStep = () => {
         if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };
    
    const currentStepConfig = steps[currentStep];

    const renderStepContent = () => {
        const stepId = steps[currentStep]?.id;
        
        switch(stepId) {
            case 'info':
                return (
                    <div className="space-y-4">
                        <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                <strong>Campanhas WhatsApp Business:</strong> Mensagens estruturadas via Baileys. Para máxima compatibilidade, mantenha mensagens concisas.
                            </AlertDescription>
                        </Alert>
                        <div className="space-y-2">
                            <Label htmlFor="campaign-name" className="text-zinc-300">Nome da Campanha *</Label>
                            <Input 
                                id="campaign-name" 
                                value={name} 
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (e.target.value.trim()) validateName(e.target.value);
                                }}
                                onBlur={() => validateName(name)}
                                placeholder="Ex: Campanha Black Friday 2024"
                                required 
                                aria-invalid={!!nameError}
                                className="bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50"
                            />
                            {nameError && <p className="text-xs text-red-400">{nameError}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="connection-select" className="text-zinc-300">Conexão WhatsApp Business *</Label>
                            {baileysConnections.length === 0 ? (
                                <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
                                    <AlertDescription>
                                        Nenhuma conexão WhatsApp Business ativa encontrada. Configure uma em Sessões.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                                    <SelectTrigger className="bg-white/[0.03] border-white/10 text-white focus:ring-emerald-500/30">
                                        <SelectValue placeholder="Selecione uma conexão"/>
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-950 border-white/10 text-white">
                                        {baileysConnections.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer">
                                                {c.config_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="delay-select" className="flex items-center gap-2 text-zinc-300">
                                <Clock className="h-4 w-4" />
                                Intervalo entre Mensagens
                            </Label>
                            <Select value={delayOption} onValueChange={setDelayOption}>
                                <SelectTrigger className="bg-white/[0.03] border-white/10 text-white focus:ring-emerald-500/30">
                                    <SelectValue placeholder="Selecione o intervalo"/>
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-white/10 text-white">
                                    {delayOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value} className="focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer">
                                            <div className="flex flex-col">
                                                <span>{opt.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-zinc-500">
                                {delayOptions.find(d => d.value === delayOption)?.description}
                            </p>
                        </div>
                    </div>
                );

            case 'message':
                return (
                     <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="message-textarea" className="text-zinc-300">Mensagem *</Label>
                            <Textarea 
                                id="message-textarea"
                                value={messageText} 
                                onChange={(e) => {
                                    setMessageText(e.target.value);
                                    if (e.target.value.trim()) validateMessage(e.target.value);
                                }}
                                onBlur={() => validateMessage(messageText)}
                                placeholder="Digite sua mensagem aqui. Use {{1}}, {{2}} para variáveis."
                                className="min-h-[150px] bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50"
                                maxLength={4096}
                                aria-invalid={!!messageError}
                            />
                            <div className="flex justify-between items-center text-xs text-zinc-500">
                                <span>{messageText.length} / 4096 caracteres</span>
                            </div>
                            {messageError && <p className="text-xs text-red-400">{messageError}</p>}
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-zinc-300">Inserir Variáveis</Label>
                            <div className="flex flex-wrap gap-2">
                                {[1, 2, 3, 4, 5].map(n => (
                                    <Button 
                                        key={n} 
                                        type="button" 
                                        variant="outline" 
                                        size="sm"
                                        className="bg-white/[0.03] border-white/10 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                                        onClick={() => insertVariable(String(n))}
                                    >
                                        {`{{${n}}}`}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {variableNames.length > 0 && (
                            <Card className="p-4 space-y-3 bg-white/[0.02] border-white/5 backdrop-blur-md">
                                <div className="flex items-start gap-2 text-xs text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]">
                                    <Info className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                                    <p>Configure o valor de cada variável no próximo passo.</p>
                                </div>
                                <p className="text-sm font-medium text-zinc-300">Variáveis detectadas: <span className="text-emerald-400 font-mono">{variableNames.map(v => `{{${v}}}`).join(', ')}</span></p>
                            </Card>
                        )}
                    </div>
                );

            case 'audience':
                 return (
                    <div className="space-y-6">
                        {variableNames.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-base font-semibold text-zinc-300">Mapeamento de Variáveis</Label>
                                <Card className="p-4 space-y-3 bg-white/[0.02] border-white/5 backdrop-blur-md">
                                    {variableNames.map((varNum, index) => (
                                        <React.Fragment key={varNum}>
                                        {index > 0 && <Separator className="bg-white/10" />}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                            <div className="space-y-2">
                                                <Label className="font-semibold text-base text-emerald-400">{`{{${varNum}}}`}</Label>
                                                <RadioGroup 
                                                    value={variableMappings[varNum]?.type || 'fixed'} 
                                                    onValueChange={(type: 'dynamic' | 'fixed') => handleVariableMappingTypeChange(varNum, type)}
                                                    className="pt-2"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="fixed" id={`fixed-${varNum}`} className="border-white/20 text-emerald-500 focus-visible:ring-emerald-500" />
                                                        <Label htmlFor={`fixed-${varNum}`} className="text-zinc-300 cursor-pointer">Valor Fixo</Label>
                                                    </div>
                                                     <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="dynamic" id={`dynamic-${varNum}`} className="border-white/20 text-emerald-500 focus-visible:ring-emerald-500" />
                                                        <Label htmlFor={`dynamic-${varNum}`} className="text-zinc-300 cursor-pointer">Campo do Contato</Label>
                                                    </div>
                                                </RadioGroup>
                                            </div>
                                            <div className="mt-1">
                                                {variableMappings[varNum]?.type === 'dynamic' ? (
                                                     <Select value={variableMappings[varNum]?.value || ''} onValueChange={(value) => handleVariableMappingValueChange(varNum, value)}>
                                                        <SelectTrigger className="bg-white/[0.03] border-white/10 text-white focus:ring-emerald-500/30">
                                                            <SelectValue placeholder="Selecione um campo"/>
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-zinc-950 border-white/10 text-white">
                                                            {contactFields.map(field => <SelectItem key={field.value} value={field.value} className="focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer">{field.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Input 
                                                        placeholder="Digite o valor fixo" 
                                                        value={variableMappings[varNum]?.value || ''} 
                                                        onChange={e => handleVariableMappingValueChange(varNum, e.target.value)} 
                                                        className="bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        </React.Fragment>
                                    ))}
                                </Card>
                            </div>
                        )}

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

                        <div className="space-y-2">
                            <Label className="text-base font-semibold text-zinc-300">Agendamento</Label>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="send-now-checkbox-baileys" checked={sendNow} onCheckedChange={(checked) => setSendNow(!!checked)} className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
                                <Label htmlFor="send-now-checkbox-baileys" className="text-zinc-300 cursor-pointer">Enviar Imediatamente</Label>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button type="button" variant={"outline"} className={cn("w-full justify-start text-left font-normal bg-white/[0.03] border-white/10 hover:bg-white/5 hover:text-white", !scheduleDate && "text-zinc-500", sendNow ? 'opacity-50 cursor-not-allowed text-zinc-600' : 'text-white')} disabled={sendNow}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {scheduleDate ? format(scheduleDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-zinc-950 border-white/10 text-white" align="start">
                                        <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} disabled={sendNow} initialFocus className="bg-zinc-950 text-white" />
                                    </PopoverContent>
                                </Popover>
                                <Input 
                                    name="scheduleTime" 
                                    type="time" 
                                    value={scheduleTime} 
                                    onChange={(e) => setScheduleTime(e.target.value)} 
                                    className="w-full sm:w-auto bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50 [color-scheme:dark]" 
                                    disabled={sendNow}
                                    pattern="[0-9]{2}:[0-9]{2}"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 'review': {
                const selectedConnection = baileysConnections.find(c => c.id === selectedConnectionId);
                
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="campaign-name-review" className="text-base font-semibold text-zinc-300">Nome da Campanha *</Label>
                            <Input 
                                id="campaign-name-review" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)}
                                onBlur={() => validateName(name)}
                                placeholder="Ex: Campanha Black Friday 2024"
                                required 
                                aria-invalid={!!nameError}
                                className="bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50"
                            />
                            {nameError && (
                                <p className="text-xs text-red-400">{nameError}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-base font-semibold text-zinc-300">Resumo da Campanha</Label>
                            <Card className="p-4 space-y-3 bg-white/[0.02] border-white/5 backdrop-blur-md">
                                <div className="grid grid-cols-[120px_1fr] gap-3 text-sm">
                                    <span className="font-medium text-zinc-400">Nome:</span>
                                    <span className="text-zinc-100">{name || <span className="text-zinc-600 italic">Não definido</span>}</span>
                                    
                                    <span className="font-medium text-zinc-400">Conexão:</span>
                                    <span className="text-zinc-100">{selectedConnection?.config_name || 'N/A'}</span>
                                    
                                    <span className="font-medium text-zinc-400">Listas:</span>
                                    <div className="text-zinc-100"><SelectedListsSummary lists={availableLists} selectedIds={contactListIds} /></div>
                                    
                                    <span className="font-medium text-zinc-400">Envio:</span>
                                    <span className="text-zinc-100">{sendNow ? 'Imediato' : `Agendado para ${scheduleDate ? format(scheduleDate, "PPP 'às' HH:mm", { locale: ptBR }) : 'N/A'}`}</span>
                                    
                                    <span className="font-medium text-zinc-400">Intervalo:</span>
                                    <span className="text-zinc-100">{delayOptions.find(d => d.value === delayOption)?.label || 'Rápido (11-33s)'}</span>
                                </div>
                            </Card>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="delay-select-review" className="text-base font-semibold flex items-center gap-2 text-zinc-300">
                                <Clock className="h-4 w-4" />
                                Intervalo entre Mensagens
                            </Label>
                            <Select value={delayOption} onValueChange={setDelayOption}>
                                <SelectTrigger className="bg-white/[0.03] border-white/10 text-white focus:ring-emerald-500/30">
                                    <SelectValue placeholder="Selecione o intervalo"/>
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-white/10 text-white">
                                    {delayOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value} className="focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer">
                                            <div className="flex flex-col">
                                                <span>{opt.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-zinc-500">
                                {delayOptions.find(d => d.value === delayOption)?.description}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-base font-semibold text-zinc-300">Automação</Label>
                            <Card className="p-4 bg-white/[0.02] border-white/5 backdrop-blur-md">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="disable-bot-checkbox" checked={disableBotOnSend} onCheckedChange={(checked) => setDisableBotOnSend(!!checked)} className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
                                    <Label htmlFor="disable-bot-checkbox" className="font-normal cursor-pointer text-sm text-zinc-300">
                                        Desativar o robô (AI) instantaneamente para os contatos que receberem este disparo
                                    </Label>
                                </div>
                            </Card>
                        </div>

                        {variableNames.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-base font-semibold text-zinc-300">Variáveis Configuradas</Label>
                                <Card className="p-4 bg-white/[0.02] border-white/5 backdrop-blur-md">
                                    <div className="grid gap-2 text-sm text-zinc-300">
                                        {variableNames.map(v => {
                                            const mapping = variableMappings[v];
                                            const display = mapping?.type === 'dynamic' 
                                                ? contactFields.find(f => f.value === mapping.value)?.label 
                                                : `"${mapping?.value}"`;
                                            return (
                                                <div key={v} className="flex items-center gap-2">
                                                    <span className="font-mono font-semibold text-emerald-400">{`{{${v}}}`}</span>
                                                    <span className="text-zinc-600">→</span>
                                                    <span className="text-zinc-100">{display}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Card>
                            </div>
                        )}
                    </div>
                );
            }

            default:
                return null;
        }
    };

    return (
        <>
            {children && React.cloneElement(children as React.ReactElement<any>, {
                onClick: (e: React.MouseEvent) => {
                    setIsOpen(true);
                    (children as React.ReactElement<any>).props.onClick?.(e);
                },
            })}
            <Dialog open={isOpen} onOpenChange={handleOpenChange}>
                <DialogContent className="sm:max-w-[1200px] w-[95vw] h-[90vh] flex flex-col p-0 bg-zinc-950/90 backdrop-blur-3xl border border-white/10 text-zinc-100 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden" onPointerDownOutside={(e) => { e.preventDefault(); }} onInteractOutside={(e) => { e.preventDefault(); }}>
                    <div className="flex flex-1 min-h-0 h-full">
                        {/* Left Sidebar: Steps */}
                        <div className="w-full max-w-[280px] border-r border-white/10 bg-black/20 flex-col hidden md:flex">
                            <div className="p-6 border-b border-white/10 flex items-center gap-3">
                                <Button type="button" variant="ghost" size="icon" onClick={handlePrevStep} className="h-8 w-8 hover:bg-white/5 hover:text-white text-zinc-400 shrink-0">
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <div>
                                    <h2 className="text-lg font-bold tracking-tight text-white leading-tight">Nova Campanha</h2>
                                    <p className="text-xs text-zinc-400">WhatsApp (Baileys)</p>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {steps.map((step, idx) => {
                                    const isActive = idx === currentStep;
                                    const isPast = idx < currentStep;
                                    return (
                                        <div key={step.id} className={cn("relative flex items-start p-3 rounded-lg transition-all duration-300", isActive ? "bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]" : (isPast ? "opacity-70" : "opacity-40"))}>
                                            {isActive && <motion.div layoutId="active-step-baileys" className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-l-lg shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
                                            <div className="flex flex-col ml-1">
                                                <span className={cn("text-sm font-semibold", isActive ? "text-emerald-400" : "text-white")}>{step.title}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Center Area: Form Content */}
                        <div className="flex-1 flex flex-col min-w-0 relative bg-zinc-950/50">
                            <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between bg-black/10">
                                <div className="flex items-center gap-3 md:hidden">
                                    <Button type="button" variant="ghost" size="icon" onClick={handlePrevStep} className="h-8 w-8 hover:bg-white/5 hover:text-white text-zinc-400 shrink-0">
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                </div>
                                <h3 className="text-xl font-medium text-white">{currentStepConfig?.title}</h3>
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

                            <div className="p-4 border-t border-white/10 bg-black/20 flex justify-between items-center shrink-0">
                                <Button type="button" variant="ghost" className="hover:bg-white/5 hover:text-white text-zinc-400" onClick={() => handleOpenChange(false)} disabled={isProcessing}>Cancelar</Button>
                                <div className="flex gap-2">
                                    {currentStep > 0 && currentStep !== steps.length - 1 && (
                                        <Button type="button" variant="outline" onClick={handlePrevStep} className="bg-transparent border-white/10 text-white hover:bg-white/5 hidden sm:flex">Voltar</Button>
                                    )}
                                    {currentStep === steps.length - 1 ? (
                                        <Button type="button" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all duration-300" onClick={handleSubmit} disabled={isProcessing || (contactListIds.length === 0 && tagIds.length === 0 && funnelIds.length === 0 && funnelStageIds.length === 0)}>
                                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {sendNow ? <><Send className="mr-2 h-4 w-4" /> Confirmar e Enviar</> : <><Clock className="mr-2 h-4 w-4" /> Confirmar Agendamento</>}
                                        </Button>
                                    ) : (
                                        <Button type="button" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all duration-300" onClick={handleNextStep} disabled={isProcessing}>
                                            Avançar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Area: Sticky Preview */}
                        {currentStepConfig?.id !== 'review' && (
                            <div className="w-full max-w-[350px] border-l border-white/10 bg-[#0b141a] flex-col relative hidden lg:flex shadow-[inset_10px_0_20px_rgba(0,0,0,0.5)]">
                                <div className="p-4 border-b border-white/5 bg-black/20">
                                    <h3 className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                                        Visualização Dinâmica
                                    </h3>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                    {messageText ? (
                                        <div className="space-y-2">
                                            <Label className="text-zinc-400 text-xs uppercase tracking-wider">Preview da Mensagem</Label>
                                            <Card className="p-4 bg-white/[0.02] border-white/5 backdrop-blur-md text-zinc-200">
                                                <p className="whitespace-pre-wrap text-sm leading-relaxed">{highlightMessage()}</p>
                                            </Card>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40 text-sm p-4">
                                            <p>A prévia da sua mensagem aparecerá aqui conforme você digita.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
