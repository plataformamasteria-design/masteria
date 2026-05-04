// src/components/atendimentos/contact-details-panel.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Tag, ContactList, ExtendedContact } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Loader2, Save, Phone, MessageSquare, AlertCircle, Bot, Calendar, Video, ExternalLink, Plus, X, RefreshCw, Archive, Undo } from 'lucide-react';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { RelativeTime } from '../ui/relative-time';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { NeurolinguisticCard } from '@/components/contacts/neurolinguistic-card';

interface AIPersona {
    id: string;
    name: string;
    description: string | null;
}

interface EffectivePersona {
    effectivePersonaId: string | null;
    source: 'stage' | 'funnel' | 'connection' | 'conversation' | 'none';
    details: any;
    persona: AIPersona | null;
    manualPersonaId: string | null;
}

interface ScheduledMeeting {
    id: string;
    title: string;
    scheduledAt: string;
    durationMinutes: number;
    meetLink: string | null;
    calendarName: string | null;
    status: string;
}

export const ContactDetailsPanel = ({ contactId, isArchived, onArchive, onUnarchive }: { contactId: string | undefined, isArchived?: boolean, onArchive?: () => void, onUnarchive?: () => void }) => {
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);
    const [contact, setContact] = useState<ExtendedContact | null>(null);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isCalling, setIsCalling] = useState(false);
    const [notes, setNotes] = useState('');
    const [aiPersonas, setAiPersonas] = useState<AIPersona[]>([]);
    const [conversationPersonas, setConversationPersonas] = useState<Record<string, string | null>>({});
    const [effectivePersonas, setEffectivePersonas] = useState<Record<string, EffectivePersona>>({});
    const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [scheduleDateTime, setScheduleDateTime] = useState('');
    const [isScheduling, setIsScheduling] = useState(false);
    const [reschedulingMeetingId, setReschedulingMeetingId] = useState<string | null>(null);
    const [rescheduleDateTime, setRescheduleDateTime] = useState('');
    const [isRescheduling, setIsRescheduling] = useState(false);

    const fetchDetails = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const contactRes = await fetch(`/api/v1/contacts/${id}`);
            if (!contactRes.ok) {
                throw new Error('Falha ao buscar dados para o painel de detalhes.');
            }

            const contactData: ExtendedContact = await contactRes.json();
            setContact(contactData);
            setNotes(contactData.notes || '');

            // Buscar agentes IA disponíveis
            const personasRes = await fetch('/api/v1/ia/personas');
            if (personasRes.ok) {
                const personasData = await personasRes.json();
                setAiPersonas(personasData.personas || []);
            }

            // Buscar agentes vinculados e efetivos para cada conversa ativa (em paralelo)
            if (contactData.activeConversations) {
                const personaMap: Record<string, string | null> = {};
                const effectiveMap: Record<string, EffectivePersona> = {};

                await Promise.all(contactData.activeConversations.map(async (conv) => {
                    const [convRes, effectiveRes] = await Promise.all([
                        fetch(`/api/v1/conversations/${conv.id}`),
                        fetch(`/api/v1/conversations/${conv.id}/effective-persona`)
                    ]);

                    if (convRes.ok) {
                        const convData = await convRes.json();
                        personaMap[conv.id] = convData.assignedPersonaId || null;
                    }

                    if (effectiveRes.ok) {
                        const effectiveData = await effectiveRes.json();
                        effectiveMap[conv.id] = effectiveData;
                    }
                }));

                setConversationPersonas(personaMap);
                setEffectivePersonas(effectiveMap);
            }

            // Buscar reuniões agendadas
            try {
                const meetingsRes = await fetch(`/api/v1/contacts/${id}/meetings`);
                if (meetingsRes.ok) {
                    const meetingsData = await meetingsRes.json();
                    setMeetings(meetingsData.meetings || []);
                }
            } catch (e) {
                console.error('Failed to fetch meetings:', e);
            }

        } catch (error) {
            notify.error('Erro', (error as Error).message);
        } finally {
            setLoading(false);
        }
    }, [notify]);

    useEffect(() => {
        if (contactId) {
            fetchDetails(contactId);
        } else {
            setContact(null);
            setLoading(false);
        }
    }, [contactId, fetchDetails]);

    const handleSaveChanges = async () => {
        if (!contact) return;
        setIsSaving(true);
        try {
            const payload = {
                notes,
            };
            const response = await fetch(`/api/v1/contacts/${contact.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error('Falha ao salvar alterações.');

            // Refetch full contact data to preserve activeConversations
            await fetchDetails(contact.id);

            notify.success('Salvo!', 'As informações do contato foram atualizadas.');
        } catch (error) {
            notify.error('Erro ao Salvar', (error as Error).message);
        } finally {
            setIsSaving(false);
        }
    }

    const handleInitiateCall = async () => {
        if (!contact) return;
        setIsCalling(true);
        try {
            const response = await fetch('/api/v1/voice/initiate-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber: contact.phone,
                    customerName: contact.name,
                    contactId: contact.id,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao iniciar chamada');
            }

            const result = await response.json();
            notify.success('Chamada Iniciada!', `Ligando para ${contact.name}. ID: ${result.callId}`);
        } catch (error) {
            notify.error('Erro ao Iniciar Chamada', (error as Error).message);
        } finally {
            setIsCalling(false);
        }
    }

    const handlePersonaChange = async (conversationId: string, personaId: string) => {
        try {
            const response = await fetch(`/api/v1/conversations/${conversationId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assignedPersonaId: personaId === 'none' ? null : personaId
                }),
            });

            if (!response.ok) {
                throw new Error('Falha ao atualizar agente IA');
            }

            setConversationPersonas(prev => ({
                ...prev,
                [conversationId]: personaId === 'none' ? null : personaId
            }));

            const personaName = personaId === 'none'
                ? 'Genérico'
                : aiPersonas.find(p => p.id === personaId)?.name || 'Desconhecido';

            notify.success('✅ Agente IA Atualizado', `Agente ${personaName} vinculado à conversa.`);
        } catch (error) {
            notify.error('Erro', (error as Error).message);
        }
    }

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (!contact) {
        return (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground p-4 text-center">
                Selecione uma conversa para ver os detalhes do contato.
            </div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
                <div className="flex flex-col items-center text-center">
                    <Avatar className="h-20 w-20 mb-4">
                        <AvatarImage src={contact.avatarUrl || `https://placehold.co/80x80.png`} alt={contact.name || 'User'} data-ai-hint="avatar user" />
                        <AvatarFallback>{(contact.name || 'US').substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <h3 className="text-lg font-bold">{contact.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Image src="https://flagsapi.com/BR/flat/16.png" alt="Bandeira do Brasil" width={16} height={12} className="h-4 w-auto" style={{ width: 'auto', height: 'auto' }} />
                        {contact.phone}
                    </p>
                </div>

                <NeurolinguisticCard
                    vakProfile={contact.vakProfile}
                    dominantSocialNeed={contact.dominantSocialNeed}
                    communicationPace={contact.communicationPace}
                    variant="compact"
                />

                <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleInitiateCall}
                    disabled={isCalling}
                >
                    {isCalling ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Iniciando chamada...
                        </>
                    ) : (
                        <>
                            <Phone className="h-4 w-4 mr-2" />
                            Iniciar Chamada de Voz
                        </>
                    )}
                </Button>

                {(onArchive && onUnarchive) && (
                    <Button
                        size="sm"
                        variant={isArchived ? "default" : "secondary"}
                        className="w-full mt-2"
                        onClick={isArchived ? onUnarchive : onArchive}
                    >
                        {isArchived ? (
                            <><Undo className="h-4 w-4 mr-2" /> Reabrir Conversa</>
                        ) : (
                            <><Archive className="h-4 w-4 mr-2" /> Arquivar Conversa</>
                        )}
                    </Button>
                )}

                {contact.activeConversations && contact.activeConversations.length > 1 && (
                    <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-sm">
                            <span className="font-semibold">Conversas Múltiplas Detectadas</span>
                            <p className="text-xs text-muted-foreground mt-1">
                                Este contato está em conversa com {contact.activeConversations.length} números diferentes simultaneamente.
                            </p>
                        </AlertDescription>
                    </Alert>
                )}

                {contact.activeConversations && contact.activeConversations.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                Conversas Ativas ({contact.activeConversations.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {contact.activeConversations.map((conv) => (
                                <div key={conv.id} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                                    <div className="grid gap-1">
                                        <p className="font-medium text-sm truncate" title={conv.connectionName || 'Sem nome'}>{conv.connectionName || 'Sem nome'}</p>
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            <Badge variant="outline" className="text-[10px] px-1.5 h-5 shrink-0 whitespace-nowrap">
                                                {conv.connectionType === 'meta_api' ? 'Business' : 'Normal'}
                                            </Badge>
                                            <Badge variant={conv.status === 'NEW' ? 'default' : 'secondary'} className="text-[10px] px-1.5 h-5 shrink-0 whitespace-nowrap">
                                                {conv.status}
                                            </Badge>
                                            {conv.aiActive && (
                                                <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 shrink-0 whitespace-nowrap">
                                                    IA Ativa
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    {conv.lastMessageAt && (
                                        <p className="text-xs text-muted-foreground">
                                            Última mensagem: <RelativeTime date={conv.lastMessageAt} />
                                        </p>
                                    )}
                                    {conv.aiActive && (() => {
                                        const effective = effectivePersonas[conv.id];
                                        if (!effective) return null;

                                        return (
                                            <div className="space-y-3 pt-2 border-t">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs flex items-center gap-1.5 font-semibold">
                                                        <Bot className="h-3 w-3 text-primary" />
                                                        Agente IA Ativo
                                                    </Label>
                                                    <div className="p-2 rounded-md bg-primary/5 border border-primary/20">
                                                        <p className="text-sm font-medium text-primary">
                                                            {effective.persona?.name || 'Agente Genérico'}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {effective.source === 'stage' && `🎯 Estágio: ${effective.details?.stageId}`}
                                                            {effective.source === 'funnel' && `📊 Funil: ${effective.details?.boardName}`}
                                                            {effective.source === 'connection' && `📱 Conexão padrão`}
                                                            {effective.source === 'conversation' && `👤 Configuração manual`}
                                                            {effective.source === 'none' && `⚠️ Resposta básica genérica`}
                                                        </p>
                                                        {effective.persona?.description && (
                                                            <p className="text-xs text-muted-foreground italic mt-1">
                                                                {effective.persona.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                                                        Fallback Manual (Opcional)
                                                    </Label>
                                                    <Select
                                                        value={conversationPersonas[conv.id] || 'none'}
                                                        onValueChange={(value) => handlePersonaChange(conv.id, value)}
                                                    >
                                                        <SelectTrigger className="h-8 text-xs">
                                                            <SelectValue placeholder="Selecione um agente" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Nenhum</SelectItem>
                                                            {aiPersonas.map((persona) => (
                                                                <SelectItem key={persona.id} value={persona.id}>
                                                                    {persona.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-xs text-muted-foreground">
                                                        Usado apenas se não houver no Kanban ou Conexão
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Reuniões Agendadas */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Reuniões Agendadas {meetings.length > 0 && `(${meetings.length})`}
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setShowScheduleForm(!showScheduleForm)}
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Agendar
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {/* Inline scheduling form */}
                        {showScheduleForm && (
                            <div className="p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-2">
                                <Label className="text-xs font-medium">Data e Horário</Label>
                                <Input
                                    type="datetime-local"
                                    value={scheduleDateTime}
                                    onChange={(e) => setScheduleDateTime(e.target.value)}
                                    className="text-sm h-8"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className="h-7 text-xs flex-1"
                                        disabled={!scheduleDateTime || isScheduling}
                                        onClick={async () => {
                                            if (!contactId || !scheduleDateTime) return;
                                            setIsScheduling(true);
                                            try {
                                                const res = await fetch(`/api/v1/contacts/${contactId}/meetings`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ meetingTime: new Date(scheduleDateTime).toISOString() }),
                                                });
                                                const data = await res.json();
                                                if (res.ok && data.success) {
                                                    notify.success('Reunião agendada com sucesso!' + (data.meetLink ? ` Meet: ${data.meetLink}` : ''));
                                                    setShowScheduleForm(false);
                                                    setScheduleDateTime('');
                                                    // Refresh meetings list
                                                    const meetRes = await fetch(`/api/v1/contacts/${contactId}/meetings`);
                                                    if (meetRes.ok) {
                                                        const meetData = await meetRes.json();
                                                        setMeetings(meetData.meetings || []);
                                                    }
                                                } else {
                                                    notify.error(data.error || 'Erro ao agendar');
                                                }
                                            } catch {
                                                notify.error('Erro de conexão');
                                            } finally {
                                                setIsScheduling(false);
                                            }
                                        }}
                                    >
                                        {isScheduling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Calendar className="h-3 w-3 mr-1" />}
                                        Criar no Calendar
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => { setShowScheduleForm(false); setScheduleDateTime(''); }}
                                    >
                                        Cancelar
                                    </Button>
                                </div>
                            </div>
                        )}

                        {meetings.length === 0 && !showScheduleForm && (
                            <p className="text-xs text-muted-foreground text-center py-2">Nenhuma reunião agendada</p>
                        )}
                        {meetings.map((m) => {
                            const d = m.scheduledAt ? new Date(m.scheduledAt) : null;
                            const isInvalid = !d || isNaN(d.getTime());
                            const isPast = !isInvalid && d! < new Date();
                            const canManage = m.status === 'scheduled' && !isPast;
                            return (
                                <div key={m.id} className={`p-3 rounded-lg border space-y-1.5 ${m.status === 'cancelled' ? 'opacity-40 border-red-200 dark:border-red-800' : isPast ? 'opacity-60' : 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800'}`}>
                                    <p className="text-sm font-medium">{m.title}</p>
                                    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                                        <span>📅 {!isInvalid ? d!.toLocaleDateString('pt-BR') : '--/--/----'}</span>
                                        <span>🕐 {!isInvalid ? d!.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                                        <span>⏱️ {m.durationMinutes}min</span>
                                    </div>
                                    {m.calendarName && (
                                        <p className="text-xs text-muted-foreground">📆 {m.calendarName}</p>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <Badge variant={m.status === 'scheduled' ? 'default' : m.status === 'cancelled' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 h-5">
                                            {m.status === 'scheduled' ? (isPast ? 'Concluída' : 'Agendada') : m.status === 'cancelled' ? 'Cancelada' : m.status}
                                        </Badge>
                                        {m.meetLink && m.status !== 'cancelled' && (
                                            <a href={m.meetLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                                <Video className="h-3 w-3" />
                                                Meet
                                                <ExternalLink className="h-2.5 w-2.5" />
                                            </a>
                                        )}
                                    </div>
                                    {/* Cancel / Reschedule actions */}
                                    {canManage && (
                                        <div className="flex gap-1.5 pt-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={async () => {
                                                    if (!confirm('Cancelar esta reunião?')) return;
                                                    try {
                                                        const res = await fetch(`/api/v1/contacts/${contactId}/meetings/${m.id}`, { method: 'DELETE' });
                                                        const data = await res.json();
                                                        if (res.ok && data.success) {
                                                            notify.success('Reunião cancelada');
                                                            const meetRes = await fetch(`/api/v1/contacts/${contactId}/meetings`);
                                                            if (meetRes.ok) { const d = await meetRes.json(); setMeetings(d.meetings || []); }
                                                        } else notify.error(data.error || 'Erro ao cancelar');
                                                    } catch { notify.error('Erro de conexão'); }
                                                }}
                                            >
                                                <X className="h-3 w-3 mr-0.5" /> Cancelar
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                onClick={() => {
                                                    setReschedulingMeetingId(reschedulingMeetingId === m.id ? null : m.id);
                                                    setRescheduleDateTime('');
                                                }}
                                            >
                                                <RefreshCw className="h-3 w-3 mr-0.5" /> Reagendar
                                            </Button>
                                        </div>
                                    )}
                                    {/* Inline reschedule form */}
                                    {reschedulingMeetingId === m.id && (
                                        <div className="p-2 rounded border border-dashed border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 space-y-1.5 mt-1">
                                            <Input
                                                type="datetime-local"
                                                value={rescheduleDateTime}
                                                onChange={(e) => setRescheduleDateTime(e.target.value)}
                                                className="text-xs h-7"
                                            />
                                            <div className="flex gap-1.5">
                                                <Button
                                                    size="sm"
                                                    className="h-6 text-[10px] flex-1"
                                                    disabled={!rescheduleDateTime || isRescheduling}
                                                    onClick={async () => {
                                                        if (!rescheduleDateTime) return;
                                                        setIsRescheduling(true);
                                                        try {
                                                            const res = await fetch(`/api/v1/contacts/${contactId}/meetings/${m.id}`, {
                                                                method: 'PATCH',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ newDateTime: new Date(rescheduleDateTime).toISOString() }),
                                                            });
                                                            const data = await res.json();
                                                            if (res.ok && data.success) {
                                                                notify.success('Reunião reagendada!');
                                                                setReschedulingMeetingId(null);
                                                                setRescheduleDateTime('');
                                                                const meetRes = await fetch(`/api/v1/contacts/${contactId}/meetings`);
                                                                if (meetRes.ok) { const d = await meetRes.json(); setMeetings(d.meetings || []); }
                                                            } else notify.error(data.error || 'Erro ao reagendar');
                                                        } catch { notify.error('Erro de conexão'); }
                                                        finally { setIsRescheduling(false); }
                                                    }}
                                                >
                                                    {isRescheduling ? <Loader2 className="h-3 w-3 animate-spin mr-0.5" /> : <RefreshCw className="h-3 w-3 mr-0.5" />}
                                                    Confirmar
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setReschedulingMeetingId(null); setRescheduleDateTime(''); }}>
                                                    Cancelar
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Segmentação</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Tags</Label>
                            <div className="flex flex-wrap gap-2 pt-2">
                                {contact.tags?.map((tag: Tag) => (<Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#fff' }}>{tag.name}</Badge>))}
                                {(!contact.tags || contact.tags.length === 0) && (<p className="text-sm text-muted-foreground">Nenhuma tag.</p>)}
                            </div>
                        </div>
                        <div>
                            <Label>Listas</Label>
                            <div className="flex flex-wrap gap-2 pt-2">
                                {contact.lists?.map((list: ContactList) => (<Badge key={list.id} variant="secondary">{list.name}</Badge>))}
                                {(!contact.lists || contact.lists.length === 0) && (<p className="text-sm text-muted-foreground">Nenhuma lista.</p>)}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Dados do Formulário (campos customizados do webhook) */}
                {contact.customFields && typeof contact.customFields === 'object' && Object.keys(contact.customFields).length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                📋 Dados do Formulário
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1.5">
                                {Object.entries(contact.customFields).map(([key, value]) => {
                                    const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                                    const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);
                                    return (
                                        <div key={key} className="flex justify-between items-start gap-2 text-sm">
                                            <span className="text-muted-foreground font-medium min-w-0 shrink-0">{displayLabel}:</span>
                                            <span className="text-right break-words">{String(value)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Notas Internas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder="Adicione uma nota sobre este contato..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[100px] text-xs"
                        />
                    </CardContent>
                </Card>

                <Button size="sm" className="w-full" onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar Alterações
                </Button>
            </div>
        </ScrollArea>
    )
}
