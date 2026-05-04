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
import { MultiListSelector, SelectedListsSummary } from './multi-list-selector';

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
    const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
    const [scheduleTime, setScheduleTime] = useState('09:00');
    const [sendNow, setSendNow] = useState(true);
    const [variableMappings, setVariableMappings] = useState<Record<string, VariableMapping>>({});
    const [delayOption, setDelayOption] = useState<string>('fast');

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
        setScheduleDate(undefined);
        setScheduleTime('09:00');
        setSendNow(true);
        setVariableMappings({});
        setDelayOption('fast');
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
        
        if (contactListIds.length === 0) {
            if (typeof notify?.error === 'function') {
                notify.error('Público Obrigatório', 'Por favor, selecione pelo menos uma lista de contatos.');
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
                schedule,
                minDelaySeconds: selectedDelay?.minDelay || 11,
                maxDelaySeconds: selectedDelay?.maxDelay || 33,
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

        if (currentStepConfig?.id === 'audience' && contactListIds.length === 0) {
            if (typeof notify?.error === 'function') {
                notify.error('Público Obrigatório', 'Selecione pelo menos uma lista de contatos.');
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
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                <strong>Campanhas WhatsApp Business:</strong> Mensagens estruturadas via Baileys. Para máxima compatibilidade, mantenha mensagens concisas.
                            </AlertDescription>
                        </Alert>
                        <div className="space-y-2">
                            <Label htmlFor="campaign-name">Nome da Campanha *</Label>
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
                            />
                            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="connection-select">Conexão WhatsApp Business *</Label>
                            {baileysConnections.length === 0 ? (
                                <Alert variant="destructive">
                                    <AlertDescription>
                                        Nenhuma conexão WhatsApp Business ativa encontrada. Configure uma em Sessões.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione uma conexão"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {baileysConnections.map(c => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.config_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
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

            case 'message':
                return (
                     <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="message-textarea">Mensagem *</Label>
                            <Textarea 
                                id="message-textarea"
                                value={messageText} 
                                onChange={(e) => {
                                    setMessageText(e.target.value);
                                    if (e.target.value.trim()) validateMessage(e.target.value);
                                }}
                                onBlur={() => validateMessage(messageText)}
                                placeholder="Digite sua mensagem aqui. Use {{1}}, {{2}} para variáveis."
                                className="min-h-[150px]"
                                maxLength={4096}
                                aria-invalid={!!messageError}
                            />
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span>{messageText.length} / 4096 caracteres</span>
                            </div>
                            {messageError && <p className="text-xs text-destructive">{messageError}</p>}
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Inserir Variáveis</Label>
                            <div className="flex flex-wrap gap-2">
                                {[1, 2, 3, 4, 5].map(n => (
                                    <Button 
                                        key={n} 
                                        type="button" 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => insertVariable(String(n))}
                                    >
                                        {`{{${n}}}`}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {variableNames.length > 0 && (
                            <Card className="p-4 space-y-3">
                                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-500/10 p-2 rounded-md">
                                    <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                    <p>Configure o valor de cada variável no próximo passo.</p>
                                </div>
                                <p className="text-sm font-medium">Variáveis detectadas: {variableNames.map(v => `{{${v}}}`).join(', ')}</p>
                            </Card>
                        )}

                        <div className="space-y-2">
                            <Label>Preview da Mensagem</Label>
                            <Card className="p-4 bg-muted">
                                <p className="whitespace-pre-wrap text-sm">{highlightMessage()}</p>
                            </Card>
                        </div>
                    </div>
                );

            case 'audience':
                 return (
                    <div className="space-y-6">
                        {variableNames.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-base font-semibold">Mapeamento de Variáveis</Label>
                                <Card className="p-4 space-y-3">
                                    {variableNames.map((varNum, index) => (
                                        <React.Fragment key={varNum}>
                                        {index > 0 && <Separator />}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                            <div className="space-y-2">
                                                <Label className="font-semibold text-base">{`{{${varNum}}}`}</Label>
                                                <RadioGroup 
                                                    value={variableMappings[varNum]?.type || 'fixed'} 
                                                    onValueChange={(type: 'dynamic' | 'fixed') => handleVariableMappingTypeChange(varNum, type)}
                                                    className="pt-2"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="fixed" id={`fixed-${varNum}`} />
                                                        <Label htmlFor={`fixed-${varNum}`}>Valor Fixo</Label>
                                                    </div>
                                                     <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="dynamic" id={`dynamic-${varNum}`} />
                                                        <Label htmlFor={`dynamic-${varNum}`}>Campo do Contato</Label>
                                                    </div>
                                                </RadioGroup>
                                            </div>
                                            <div className="mt-1">
                                                {variableMappings[varNum]?.type === 'dynamic' ? (
                                                     <Select value={variableMappings[varNum]?.value || ''} onValueChange={(value) => handleVariableMappingValueChange(varNum, value)}>
                                                        <SelectTrigger><SelectValue placeholder="Selecione um campo"/></SelectTrigger>
                                                        <SelectContent>
                                                            {contactFields.map(field => <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Input placeholder="Digite o valor fixo" value={variableMappings[varNum]?.value || ''} onChange={e => handleVariableMappingValueChange(varNum, e.target.value)} />
                                                )}
                                            </div>
                                        </div>
                                        </React.Fragment>
                                    ))}
                                </Card>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-base font-semibold">Público (selecione uma ou mais listas) *</Label>
                            <MultiListSelector
                                lists={availableLists}
                                selectedIds={contactListIds}
                                onSelectionChange={setContactListIds}
                                maxHeight="180px"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-base font-semibold">Agendamento</Label>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="send-now-checkbox-baileys" checked={sendNow} onCheckedChange={(checked) => setSendNow(!!checked)} />
                                <Label htmlFor="send-now-checkbox-baileys">Enviar Imediatamente</Label>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button type="button" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !scheduleDate && "text-muted-foreground", sendNow && 'opacity-50 cursor-not-allowed')} disabled={sendNow}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {scheduleDate ? format(scheduleDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} disabled={sendNow} initialFocus />
                                    </PopoverContent>
                                </Popover>
                                <Input 
                                    name="scheduleTime" 
                                    type="time" 
                                    value={scheduleTime} 
                                    onChange={(e) => setScheduleTime(e.target.value)} 
                                    className="w-full sm:w-auto" 
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
                            <Label htmlFor="campaign-name-review" className="text-base font-semibold">Nome da Campanha *</Label>
                            <Input 
                                id="campaign-name-review" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)}
                                onBlur={() => validateName(name)}
                                placeholder="Ex: Campanha Black Friday 2024"
                                required 
                                aria-invalid={!!nameError}
                            />
                            {nameError && (
                                <p className="text-xs text-destructive">{nameError}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-base font-semibold">Resumo da Campanha</Label>
                            <Card className="p-4 space-y-3">
                                <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                                    <span className="font-medium">Nome:</span>
                                    <span>{name || <span className="text-muted-foreground italic">Não definido</span>}</span>
                                    
                                    <span className="font-medium">Conexão:</span>
                                    <span>{selectedConnection?.config_name || 'N/A'}</span>
                                    
                                    <span className="font-medium">Listas:</span>
                                    <SelectedListsSummary lists={availableLists} selectedIds={contactListIds} />
                                    
                                    <span className="font-medium">Envio:</span>
                                    <span>{sendNow ? 'Imediato' : `Agendado para ${scheduleDate ? format(scheduleDate, "PPP 'às' HH:mm", { locale: ptBR }) : 'N/A'}`}</span>
                                    
                                    <span className="font-medium">Intervalo:</span>
                                    <span>{delayOptions.find(d => d.value === delayOption)?.label || 'Rápido (11-33s)'}</span>
                                </div>
                            </Card>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="delay-select-review" className="text-base font-semibold flex items-center gap-2">
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

                        <div className="space-y-2">
                            <Label className="text-base font-semibold">Preview da Mensagem</Label>
                            <Card className="p-4 bg-muted">
                                <p className="whitespace-pre-wrap text-sm">{highlightMessage()}</p>
                            </Card>
                        </div>

                        {variableNames.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-base font-semibold">Variáveis Configuradas</Label>
                                <Card className="p-4">
                                    <div className="grid gap-2 text-sm">
                                        {variableNames.map(v => {
                                            const mapping = variableMappings[v];
                                            const display = mapping?.type === 'dynamic' 
                                                ? contactFields.find(f => f.value === mapping.value)?.label 
                                                : `"${mapping?.value}"`;
                                            return (
                                                <div key={v} className="flex items-center gap-2">
                                                    <span className="font-mono font-semibold">{`{{${v}}}`}</span>
                                                    <span className="text-muted-foreground">→</span>
                                                    <span>{display}</span>
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
            {React.cloneElement(children as React.ReactElement<any>, {
                onClick: (e: React.MouseEvent) => {
                    setIsOpen(true);
                    (children as React.ReactElement<any>).props.onClick?.(e);
                },
            })}
            <Dialog open={isOpen} onOpenChange={handleOpenChange}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {currentStep > 0 && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={handlePrevStep}
                                    type="button"
                                    aria-label="Voltar para etapa anterior"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                            )}
                            <span>{currentStepConfig?.title || 'Nova Campanha WhatsApp Business'}</span>
                        </DialogTitle>
                        <DialogDescription>
                            Crie uma campanha de mensagens estruturadas via WhatsApp Business usando Baileys.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex gap-2 mb-4">
                        {steps.map((step, index) => (
                            <div 
                                key={step.id} 
                                className={cn(
                                    "flex-1 h-2 rounded-full transition-colors",
                                    index === currentStep ? "bg-primary" : index < currentStep ? "bg-primary/50" : "bg-muted"
                                )}
                            />
                        ))}
                    </div>

                    <form onSubmit={handleSubmit}>
                        {renderStepContent()}

                        <DialogFooter className="mt-6 flex justify-between">
                            {currentStep > 0 && (
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={handlePrevStep}
                                    aria-label="Voltar"
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Voltar
                                </Button>
                            )}
                            <div className="flex-1" />
                            {currentStep < steps.length - 1 ? (
                                <Button type="button" onClick={handleNextStep}>
                                    Próximo
                                </Button>
                            ) : (
                                <Button 
                                    type="submit" 
                                    disabled={isProcessing || !name.trim() || !messageText.trim()}
                                    aria-busy={isProcessing}
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Criando...
                                        </>
                                    ) : (
                                        <>
                                            {sendNow ? <Send className="mr-2 h-4 w-4" /> : <Clock className="mr-2 h-4 w-4" />}
                                            {sendNow ? 'Confirmar e Enviar' : 'Confirmar e Agendar'}
                                        </>
                                    )}
                                </Button>
                            )}
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
