'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ContactList } from '@/lib/types';
import { Loader2, CalendarIcon, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { useRouter } from 'next/navigation';
import { MultiListSelector } from './multi-list-selector';

interface VoiceAgent {
  id: string;
  name: string;
  status: string;
  retellAgentId: string | null;
}

interface TwilioNumber {
  phoneNumber: string;
  friendlyName: string;
  voiceEnabled: boolean;
  registeredInRetell: boolean;
}

interface CreateVoiceCampaignDialogProps {
  children: React.ReactNode;
  onSaveSuccess?: () => void;
}

export function CreateVoiceCampaignDialog({ children, onSaveSuccess }: CreateVoiceCampaignDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [name, setName] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('');
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [sendNow, setSendNow] = useState(true);
  const [enableRetry, setEnableRetry] = useState(false);
  const [maxRetryAttempts, setMaxRetryAttempts] = useState(3);
  const [retryDelayMinutes, setRetryDelayMinutes] = useState(30);

  const [agents, setVoiceAgents] = useState<VoiceAgent[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<TwilioNumber[]>([]);
  const [lists, setContactLists] = useState<ContactList[]>([]);
  
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const fetchPrereqs = async () => {
        try {
          const [agentsRes, listsRes, phonesRes] = await Promise.all([
            fetch('/api/v1/voice/agents'),
            fetch('/api/v1/lists?limit=0'),
            fetch('/api/v1/voice/phone-numbers'),
          ]);
          if (!agentsRes.ok || !listsRes.ok) throw new Error('Falha ao carregar dados necessários.');
          
          const agentsData = await agentsRes.json();
          const listsData = await listsRes.json();
          const phonesData = phonesRes.ok ? await phonesRes.json() : { data: [] };

          const activeAgents = (agentsData.data || agentsData || []).filter(
            (a: VoiceAgent) => a.status !== 'archived'
          );
          setVoiceAgents(activeAgents);
          setContactLists(listsData.data || []);
          
          const voiceNumbers = (phonesData.data || []).filter((p: TwilioNumber) => p.voiceEnabled);
          setPhoneNumbers(voiceNumbers);

          if (activeAgents.length > 0) {
            setSelectedAgentId(activeAgents[0].id);
          }
          if (voiceNumbers.length > 0) {
            setSelectedPhoneNumber(voiceNumbers[0].phoneNumber);
          }
        } catch (error) {
          notify.error('Erro', (error as Error).message);
        } finally {
          setIsLoading(false);
        }
      };
      fetchPrereqs();
    }
  }, [isOpen, notify]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    const payload = {
      name,
      voiceAgentId: selectedAgentId,
      fromNumber: selectedPhoneNumber,
      contactListIds: selectedListIds,
      schedule,
      enableRetry,
      maxRetryAttempts: enableRetry ? maxRetryAttempts : 0,
      retryDelayMinutes: enableRetry ? retryDelayMinutes : 30,
    };

    try {
      const response = await fetch('/api/v1/campaigns/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('[Voice Campaign] API Error:', result);
        const errorDetails = result.details?.fieldErrors ? Object.entries(result.details.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ') : '';
        throw new Error(result.error + (errorDetails ? ` (${errorDetails})` : ''));
      }
      
      notify.success('Sucesso!', result.message);
      setIsOpen(false);
      setName('');
      setSelectedAgentId('');
      setSelectedListIds([]);
      setScheduleDate(undefined);
      setSendNow(true);
      router.refresh();
      if (onSaveSuccess) onSaveSuccess();

    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Criar Campanha de Voz
          </DialogTitle>
           <DialogDescription>
            Configure e agende sua campanha de ligações em massa usando agentes de voz AI.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            <div className="space-y-2">
              <Label htmlFor="voice-campaign-name">Nome da Campanha</Label>
              <Input 
                id="voice-campaign-name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Ex: Campanha de Vendas Dezembro"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-agent">Agente de Voz</Label>
              {agents.length === 0 && !isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum agente de voz configurado. Configure um agente na seção Voice AI.
                </p>
              ) : (
                <Select 
                  value={selectedAgentId} 
                  onValueChange={setSelectedAgentId}
                >
                  <SelectTrigger id="voice-agent" className={!selectedAgentId ? 'text-muted-foreground' : ''}>
                    <SelectValue placeholder="Selecione um agente de voz">
                      {selectedAgentId ? agents.find(a => a.id === selectedAgentId)?.name : 'Selecione um agente de voz'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="from-number">Número de Origem (Twilio)</Label>
              {phoneNumbers.length === 0 && !isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum número Twilio disponível.
                </p>
              ) : (
                <Select 
                  value={selectedPhoneNumber} 
                  onValueChange={setSelectedPhoneNumber}
                >
                  <SelectTrigger id="from-number" className={!selectedPhoneNumber ? 'text-muted-foreground' : ''}>
                    <SelectValue placeholder="Selecione um número">
                      {selectedPhoneNumber || 'Selecione um número'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.map(phone => (
                      <SelectItem key={phone.phoneNumber} value={phone.phoneNumber}>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span>{phone.phoneNumber}</span>
                          <span className="text-muted-foreground text-xs">({phone.friendlyName})</span>
                          {phone.registeredInRetell && (
                            <span className="text-green-600 text-xs">Retell</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                Este número aparecerá como originador das chamadas.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Listas de Contatos (selecione uma ou mais)</Label>
              <MultiListSelector
                lists={lists}
                selectedIds={selectedListIds}
                onSelectionChange={setSelectedListIds}
                maxHeight="150px"
              />
            </div>
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-base font-semibold">Agendamento</Label>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="send-now-checkbox-voice" 
                  checked={sendNow} 
                  onCheckedChange={(checked) => setSendNow(!!checked)} 
                />
                <Label htmlFor="send-now-checkbox-voice">Iniciar Imediatamente</Label>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant={"outline"} 
                      className={cn(
                        "w-full justify-start text-left font-normal", 
                        !scheduleDate && "text-muted-foreground", 
                        sendNow && 'opacity-50 cursor-not-allowed'
                      )} 
                      disabled={sendNow}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduleDate ? format(scheduleDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} initialFocus />
                  </PopoverContent>
                </Popover>
                <Input 
                  type="time" 
                  value={scheduleTime} 
                  onChange={(e) => setScheduleTime(e.target.value)} 
                  className="w-full sm:w-auto" 
                  disabled={sendNow} 
                />
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-base font-semibold">Rediscagem Automática</Label>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="enable-retry-checkbox" 
                  checked={enableRetry} 
                  onCheckedChange={(checked) => setEnableRetry(!!checked)} 
                />
                <Label htmlFor="enable-retry-checkbox">Habilitar rediscagem para quem não atender</Label>
              </div>
              {enableRetry && (
                <div className="flex flex-col sm:flex-row gap-3 mt-2 pl-6">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tentativas</Label>
                    <Select value={String(maxRetryAttempts)} onValueChange={(v) => setMaxRetryAttempts(Number(v))}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2x</SelectItem>
                        <SelectItem value="3">3x</SelectItem>
                        <SelectItem value="4">4x</SelectItem>
                        <SelectItem value="5">5x</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Intervalo</Label>
                    <Select value={String(retryDelayMinutes)} onValueChange={(v) => setRetryDelayMinutes(Number(v))}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="120">2 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground pl-6">
                {enableRetry 
                  ? `Contatos que não atenderem, caixa de mensagens ou ocupado serão rediscados até ${maxRetryAttempts}x com intervalo de ${retryDelayMinutes} minutos.`
                  : 'Quando desativado, cada contato recebe apenas uma ligação.'}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Rate Limiting</p>
              <p>As chamadas serão feitas em lotes de até 20 ligações simultâneas com intervalo de 50 segundos entre lotes para respeitar os limites da API.</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={isProcessing} onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isProcessing || isLoading || !selectedAgentId || selectedListIds.length === 0}
            >
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {sendNow ? 'Iniciar Campanha' : 'Agendar Campanha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
