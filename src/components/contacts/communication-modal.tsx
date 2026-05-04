'use client';

import { useState, useEffect, useMemo } from 'react';
import { Phone, MessageCircle, MessageSquare, Loader2, PhoneCall, Smartphone, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import type { Contact } from '@/lib/types';

interface PhoneNumberResource {
  phoneNumber: string;
  friendlyName: string;
  nickname?: string;
  inboundAgentId?: string;
  inboundAgentName?: string;
  inboundAgentVersion?: number;
  outboundAgentId?: string;
  outboundAgentName?: string;
  outboundAgentVersion?: number;
}

interface RetellAgent {
  id: string;
  name: string;
  version: number;
  isPublished: boolean;
}

interface WhatsAppConnection {
  id: string;
  name: string;
  phoneNumber?: string | null;
  type: 'meta_api' | 'baileys';
  status: string;
}

interface SMSGateway {
  id: string;
  name: string;
  provider: string;
}

interface CallResources {
  phoneNumbers: PhoneNumberResource[];
  retellAgents: RetellAgent[];
  whatsappConnections: WhatsAppConnection[];
  smsGateways: SMSGateway[];
}

interface CommunicationModalProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CommunicationChannel = 'voice' | 'whatsapp' | 'sms';

export function CommunicationModal({ contact, open, onOpenChange }: CommunicationModalProps) {
  const [resources, setResources] = useState<CallResources | null>(null);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [channel, setChannel] = useState<CommunicationChannel>('voice');
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('');
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [selectedGatewayId, setSelectedGatewayId] = useState<string>('');
  const [smsMessage, setSmsMessage] = useState<string>('');

  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  useEffect(() => {
    if (open) {
      fetchResources();
    }
  }, [open]);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/voice/call-resources');
      if (!response.ok) throw new Error('Falha ao carregar recursos');
      const data: CallResources = await response.json();
      setResources(data);
      
      if (data.phoneNumbers.length > 0 && data.phoneNumbers[0]) {
        setSelectedPhoneNumber(data.phoneNumbers[0].phoneNumber);
      }
      if (data.whatsappConnections.length > 0 && data.whatsappConnections[0]) {
        setSelectedConnectionId(data.whatsappConnections[0].id);
      }
      if (data.smsGateways.length > 0 && data.smsGateways[0]) {
        setSelectedGatewayId(data.smsGateways[0].id);
      }
    } catch (error) {
      notify.error('Erro', 'Falha ao carregar recursos de comunicação');
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceCall = async () => {
    if (!contact) return;
    
    const selectedPhone = resources?.phoneNumbers.find(p => p.phoneNumber === selectedPhoneNumber);
    const agentId = selectedPhone?.inboundAgentId;
    
    if (!agentId) {
      notify.error('Erro', 'Este número não possui agente configurado');
      return;
    }
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/v1/voice/initiate-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: contact.phone,
          customerName: contact.name,
          contactId: contact.id,
          agentId: agentId,
          fromNumber: selectedPhoneNumber,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao iniciar chamada');
      }

      notify.success('Chamada iniciada!', `Ligando para ${contact.name}...`);
      onOpenChange(false);
    } catch (error) {
      notify.error('Erro', error instanceof Error ? error.message : 'Erro ao iniciar chamada');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWhatsApp = () => {
    notify.info('WhatsApp', 'Use a funcionalidade "Iniciar Conversa" para enviar mensagens via WhatsApp.');
    onOpenChange(false);
  };

  const handleSms = () => {
    if (!smsMessage.trim()) {
      notify.error('Erro', 'Digite uma mensagem');
      return;
    }
    notify.info('SMS', 'Use a funcionalidade de Campanhas SMS para enviar mensagens.');
    onOpenChange(false);
  };

  const handleSubmit = () => {
    switch (channel) {
      case 'voice':
        handleVoiceCall();
        break;
      case 'whatsapp':
        handleWhatsApp();
        break;
      case 'sms':
        handleSms();
        break;
    }
  };

  const canSubmit = () => {
    if (!contact) return false;
    switch (channel) {
      case 'voice': {
        const selectedPhone = resources?.phoneNumbers.find(p => p.phoneNumber === selectedPhoneNumber);
        return !!selectedPhone?.inboundAgentId;
      }
      case 'whatsapp':
        return !!selectedConnectionId && (resources?.whatsappConnections.length ?? 0) > 0;
      case 'sms':
        return !!selectedGatewayId && smsMessage.trim().length > 0;
      default:
        return false;
    }
  };

  const charCount = smsMessage.length;
  const maxChars = 159;
  const isOverLimit = charCount > maxChars;

  const selectedPhoneData = resources?.phoneNumbers.find(p => p.phoneNumber === selectedPhoneNumber);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Comunicar com {contact?.name || 'Contato'}
          </DialogTitle>
          <DialogDescription>
            Escolha o canal e as configurações para entrar em contato
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label>Canal de Comunicação</Label>
              <RadioGroup
                value={channel}
                onValueChange={(value) => setChannel(value as CommunicationChannel)}
                className="grid grid-cols-3 gap-4"
              >
                <div>
                  <RadioGroupItem value="voice" id="voice" className="peer sr-only" />
                  <Label
                    htmlFor="voice"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Phone className="mb-3 h-6 w-6" />
                    <span className="text-sm font-medium">Ligar</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="whatsapp" id="whatsapp" className="peer sr-only" />
                  <Label
                    htmlFor="whatsapp"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <MessageCircle className="mb-3 h-6 w-6" />
                    <span className="text-sm font-medium">WhatsApp</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="sms" id="sms" className="peer sr-only" />
                  <Label
                    htmlFor="sms"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <MessageSquare className="mb-3 h-6 w-6" />
                    <span className="text-sm font-medium">SMS</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {channel === 'voice' && (
              <>
                <div className="space-y-2">
                  <Label>Número de Origem</Label>
                  <Select value={selectedPhoneNumber} onValueChange={setSelectedPhoneNumber}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o número" />
                    </SelectTrigger>
                    <SelectContent>
                      {resources?.phoneNumbers.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Nenhum número disponível
                        </SelectItem>
                      ) : (
                        resources?.phoneNumbers.map((phone) => (
                          <SelectItem key={phone.phoneNumber} value={phone.phoneNumber}>
                            <div className="flex flex-col">
                              <span>{phone.friendlyName || phone.phoneNumber}</span>
                              {phone.inboundAgentName && (
                                <span className="text-xs text-muted-foreground">
                                  Agente: {phone.inboundAgentName} (v{phone.inboundAgentVersion})
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPhoneData?.inboundAgentName ? (
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-sm space-y-1">
                    <p className="font-medium text-green-900 dark:text-green-100">
                      ✓ Agente Configurado
                    </p>
                    <p className="text-green-800 dark:text-green-200">
                      {selectedPhoneData.inboundAgentName} (v{selectedPhoneData.inboundAgentVersion})
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 text-sm">
                    <p className="text-yellow-800 dark:text-yellow-200">
                      ⚠️ Este número não possui agente configurado
                    </p>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                  <p><strong>Contato:</strong> {contact?.name}</p>
                  <p><strong>Destino:</strong> {contact?.phone}</p>
                </div>
              </>
            )}

            {channel === 'whatsapp' && (
              <>
                <div className="space-y-2">
                  <Label>Conexão WhatsApp</Label>
                  <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conexão" />
                    </SelectTrigger>
                    <SelectContent>
                      {resources?.whatsappConnections.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Nenhuma conexão ativa
                        </SelectItem>
                      ) : (
                        resources?.whatsappConnections.map((conn) => (
                          <SelectItem key={conn.id} value={conn.id}>
                            <div className="flex items-center gap-2">
                              {conn.type === 'baileys' ? (
                                <Smartphone className="h-4 w-4 text-blue-500" />
                              ) : (
                                <Lock className="h-4 w-4 text-green-500" />
                              )}
                              <div className="flex flex-col">
                                <span>{conn.name}</span>
                                {conn.phoneNumber && (
                                  <span className="text-xs text-muted-foreground">
                                    {conn.type === 'baileys' ? 'Baileys' : 'Meta API'} · {conn.phoneNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                  <p><strong>Contato:</strong> {contact?.name}</p>
                  <p><strong>Destino:</strong> {contact?.phone}</p>
                </div>
              </>
            )}

            {channel === 'sms' && (
              <>
                <div className="space-y-2">
                  <Label>Gateway SMS</Label>
                  <Select value={selectedGatewayId} onValueChange={setSelectedGatewayId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gateway" />
                    </SelectTrigger>
                    <SelectContent>
                      {resources?.smsGateways.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Nenhum gateway ativo
                        </SelectItem>
                      ) : (
                        resources?.smsGateways.map((gw) => (
                          <SelectItem key={gw.id} value={gw.id}>
                            {gw.name} ({gw.provider})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Mensagem (máximo {maxChars} caracteres)</Label>
                  <Textarea
                    placeholder="Digite sua mensagem aqui..."
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value.slice(0, maxChars))}
                    className="min-h-24 resize-none"
                  />
                  <div className="flex justify-between text-xs">
                    <span className={`font-medium ${isOverLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {charCount}/{maxChars} caracteres
                    </span>
                    {charCount > 0 && (
                      <span className={`${charCount <= maxChars ? 'text-green-500' : 'text-red-500'}`}>
                        {charCount <= maxChars ? '✓' : '✗ Limite excedido'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                  <p><strong>Contato:</strong> {contact?.name}</p>
                  <p><strong>Destino:</strong> {contact?.phone}</p>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isProcessing || loading || !canSubmit()}
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {channel === 'voice' && 'Iniciar Chamada'}
            {channel === 'whatsapp' && 'Abrir WhatsApp'}
            {channel === 'sms' && 'Enviar SMS'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CommunicationButtonProps {
  contact: Contact;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  trigger?: React.ReactNode;
}

export function CommunicationButton({
  contact,
  variant = 'default',
  size = 'default',
  className,
  trigger,
}: CommunicationButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={() => setOpen(true)}
        >
          <PhoneCall className="h-4 w-4 mr-2" />
          {size !== 'icon' && 'Ligar'}
        </Button>
      )}

      <CommunicationModal contact={contact} open={open} onOpenChange={setOpen} />
    </>
  );
}
