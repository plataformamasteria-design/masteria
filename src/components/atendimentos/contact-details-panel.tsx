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
import { Loader2, Save, Phone, MessageSquare, AlertCircle, Bot, Calendar, Video, ExternalLink, Plus, X, RefreshCw, Archive, Undo, Play, Pause, XCircle } from 'lucide-react';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { RelativeTime } from '../ui/relative-time';
import Image from 'next/image';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { NeurolinguisticCard } from '@/components/contacts/neurolinguistic-card';
import { MultiSelectCreatable } from '../ui/multi-select-creatable';
import { FileText, Tag as TagIcon, Edit, Kanban, Zap, Clock, CheckCircle2, History } from 'lucide-react';
import { ContactHistoryTimeline } from '@/components/contacts/contact-history-timeline';

interface EditableSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  isEditing: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
}

const PREMIUM_CARD_CLASS = "border border-zinc-200 dark:border-white/10 !bg-white dark:!bg-white/[0.02] shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(0,0,0,0.3)] backdrop-blur-md rounded-2xl";

const EditableCardSection: React.FC<EditableSectionProps> = ({ title, icon: Icon, children, isEditing, isSaving, onEdit, onSave, onCancel }) => (
  <Card className={PREMIUM_CARD_CLASS}>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {title}
      </CardTitle>
      {!isEditing && (
        <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 text-xs text-muted-foreground hover:text-foreground">
          <Edit className="h-3.5 w-3.5 mr-1" /> Editar
        </Button>
      )}
    </CardHeader>
    <CardContent>
      {children}
      {isEditing && (
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border/40">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving} className="h-8 text-xs">
            Cancelar
          </Button>
          <Button size="sm" onClick={onSave} disabled={isSaving} className="h-8 text-xs">
            {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Salvar
          </Button>
        </div>
      )}
    </CardContent>
  </Card>
);

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

export const ContactDetailsPanel = ({ contactId, isArchived, onArchive, onUnarchive, onClose }: { contactId: string | undefined, isArchived?: boolean, onArchive?: () => void, onUnarchive?: () => void, onClose?: () => void }) => {
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

    // Novos estados de edição (Tags e Custom Fields)
    const [editingSection, setEditingSection] = useState<'segmentation' | 'customFields' | null>(null);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [customFieldsArray, setCustomFieldsArray] = useState<{ id: string, key: string, value: string }[]>([]);
    const [availableBoards, setAvailableBoards] = useState<any[]>([]);
    const [isAddingFunnel, setIsAddingFunnel] = useState(false);
    const [newFunnelBoardId, setNewFunnelBoardId] = useState<string>('');
    const [newFunnelStageId, setNewFunnelStageId] = useState<string>('');

    const fetchDetails = useCallback(async (id: string, isBackgroundRefresh = false) => {
        if (!isBackgroundRefresh) {
            setLoading(true);
        }
        try {
            const contactRes = await fetch(`/api/v1/contacts/${id}`);
            if (!contactRes.ok) {
                throw new Error('Falha ao buscar dados para o painel de detalhes.');
            }

            const contactData: ExtendedContact = await contactRes.json();
            setContact(contactData);
            setNotes(contactData.notes || '');
            
            // Popula os seletores de etiquetas e funil
            if (contactData.tags) {
                setSelectedTagIds(contactData.tags.map(t => t.id));
            }

            // Buscar agentes IA disponíveis
            const personasRes = await fetch('/api/v1/ia/personas');
            if (personasRes.ok) {
                const personasData = await personasRes.json();
                setAiPersonas(personasData.personas || []);
            }

            // Buscar agentes vinculados e efetivos para cada conversa ativa (em paralelo)
            if (contactData.activeConversations && contactData.activeConversations.length > 0) {
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

            // Buscar Tags disponíveis para Segmentação
            try {
                const tagsRes = await fetch('/api/v1/tags?limit=1000');
                if (tagsRes.ok) {
                    const tagsData = await tagsRes.json();
                    setAvailableTags(tagsData.data || []);
                }
            } catch (e) {
                console.error('Failed to fetch tags:', e);
            }

            // Buscar Funis/Kanbans disponíveis
            try {
                const boardsRes = await fetch('/api/v1/kanbans');
                if (boardsRes.ok) {
                    const boardsData = await boardsRes.json();
                    setAvailableBoards(boardsData || []);
                }
            } catch (e) {
                console.error('Failed to fetch kanban boards:', e);
            }

        } catch (error) {
            notify.error('Erro', (error as Error).message);
        } finally {
            if (!isBackgroundRefresh) {
                setLoading(false);
            }
        }
    }, [notify]);

    useEffect(() => {
        if (contactId) {
            if (contact?.id !== contactId) {
                setContact(null);
            }
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
            const payload: any = { notes };
            
            if (editingSection === 'segmentation') {
                payload.tagIds = selectedTagIds;
            }

            if (editingSection === 'customFields') {
                const customObj: Record<string, string> = {};
                customFieldsArray.forEach(f => {
                    const key = f.key.trim();
                    if (key) customObj[key] = f.value;
                });
                payload.customFields = customObj;
            }

            const response = await fetch(`/api/v1/contacts/${contact.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error('Falha ao salvar alterações.');

            await fetchDetails(contact.id, true);
            setEditingSection(null);
            notify.success('Salvo!', 'As informações do contato foram atualizadas.');
        } catch (error) {
            notify.error('Erro ao Salvar', (error as Error).message);
        } finally {
            setIsSaving(false);
        }
    }

    const handleCancelEdit = () => {
        setEditingSection(null);
    }

    const handleEditCustomFields = () => {
        setEditingSection('customFields');
        const fields = Object.entries(contact?.customFields as Record<string, string> || {}).map(([k, v], i) => ({
            id: `field-${i}-${Date.now()}`,
            key: k,
            value: String(v)
        }));
        setCustomFieldsArray(fields);
    };

    const handleEditSegmentation = () => {
        setEditingSection('segmentation');
        setSelectedTagIds(contact?.tags?.map(t => t.id) || []);
    };

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
                let errorMessage = 'Falha ao iniciar chamada';
                try {
                    const textData = await response.text();
                    try {
                        const errorData = JSON.parse(textData);
                        errorMessage = errorData.error || errorMessage;
                    } catch (e) {
                        errorMessage = textData.substring(0, 100) + '... (Resposta inválida do servidor)';
                    }
                } catch (e) {}
                throw new Error(errorMessage);
            }

            await response.json();
            notify.success('Chamada Iniciada!', `O seu ramal irá tocar para falar com ${contact.name}.`);
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

    const handleUpdateFunnelStage = async (leadId: string, stageId: string) => {
        try {
            const response = await fetch(`/api/v1/leads/${leadId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stageId })
            });
            if (!response.ok) throw new Error('Falha ao atualizar etapa');
            notify.success('Funil Atualizado!', 'O lead foi movido de etapa.');
            if (contact) fetchDetails(contact.id, true);
        } catch (error) {
            notify.error('Erro ao mover lead', (error as Error).message);
        }
    };

    const handleUpdateTags = async (newTagIds: string[]) => {
        setSelectedTagIds(newTagIds);
        if (!contact) return;
        try {
            const response = await fetch(`/api/v1/contacts/${contact.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagIds: newTagIds }),
            });
            if (!response.ok) throw new Error('Falha ao atualizar etiquetas.');
            fetchDetails(contact.id, true);
        } catch (error) {
            notify.error('Erro ao atualizar', (error as Error).message);
        }
    };

    const handleAddFunnel = async () => {
        if (!newFunnelBoardId || !newFunnelStageId || !contact) return;
        setIsAddingFunnel(true);
        try {
            const response = await fetch(`/api/v1/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    boardId: newFunnelBoardId,
                    stageId: newFunnelStageId,
                    contactId: contact.id,
                    title: contact.name,
                    value: 0
                })
            });
            if (!response.ok) throw new Error('Falha ao adicionar ao funil');
            notify.success('Lead Adicionado!', 'Contato adicionado ao funil com sucesso.');
            setNewFunnelBoardId('');
            setNewFunnelStageId('');
            fetchDetails(contact.id, true);
        } catch (error) {
            notify.error('Erro ao adicionar', (error as Error).message);
        } finally {
            setIsAddingFunnel(false);
        }
    };

    const handleAutomationAction = async (executionId: string, action: 'pause' | 'resume' | 'cancel') => {
        try {
            const response = await fetch(`/api/v1/automations/executions/${executionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            if (!response.ok) throw new Error(`Falha ao executar ação: ${action}`);
            
            const msgMap = {
                'pause': 'Automação pausada.',
                'resume': 'Automação retomada.',
                'cancel': 'Automação cancelada.'
            };
            notify.success('Sucesso', msgMap[action]);
            if (contact) fetchDetails(contact.id, true);
        } catch (error) {
            notify.error('Erro na Automação', (error as Error).message);
        }
    };


    if (loading && !contact) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (!contact && !loading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                <Bot className="h-10 w-10 mb-4 opacity-20" />
                Selecione uma conversa para ver os detalhes.
            </div>
        );
    }

    // Se passou, temos um contact válido
    const hasActiveConversations = contact && contact.activeConversations && contact.activeConversations.length > 0;

    return (
        <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
                {onClose && (
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8 lg:hidden" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                )}
                
                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(0,0,0,0.3)] backdrop-blur-md p-6 mb-2">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <Avatar className="h-20 w-20 mb-4 ring-2 ring-zinc-200 dark:ring-white/10 shadow-md">
                            <AvatarImage src={contact.avatarUrl || `https://placehold.co/80x80.png`} alt={contact.name || 'User'} data-ai-hint="avatar user" />
                            <AvatarFallback>{(contact.name || 'US').substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{contact.name}</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-1">
                            <Image src="https://flagsapi.com/BR/flat/16.png" alt="Bandeira do Brasil" width={16} height={12} className="h-4 w-auto" style={{ width: 'auto', height: 'auto' }} />
                            {contact.phone}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-5 pb-6">
                    {/* --- GERAL --- */}
                    <div className="space-y-5">
                        <NeurolinguisticCard
                            vakProfile={contact.vakProfile}
                            dominantSocialNeed={contact.dominantSocialNeed}
                            communicationPace={contact.communicationPace}
                            variant="compact"
                        />

                        <Card className={PREMIUM_CARD_CLASS}>
                            <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0">
                                <TagIcon className="h-4 w-4" />
                                <CardTitle className="text-sm">Segmentação (Etiquetas)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1.5">
                                    <MultiSelectCreatable
                                        selected={selectedTagIds}
                                        onChange={handleUpdateTags}
                                        placeholder="Adicionar etiquetas..."
                                        createEndpoint="tags"
                                        createResourceType="tag"
                                        initialOptions={availableTags.map(t => ({ value: t.id, label: t.name, color: t.color }))}
                                    />
                                </div>
                                {contact.lists && contact.lists.length > 0 && (
                                    <div className="pt-2 border-t border-border/40">
                                        <Label className="text-xs text-muted-foreground">Listas</Label>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {contact.lists.map((list: ContactList) => (<Badge key={list.id} variant="secondary" className="text-[10px] px-1.5">{list.name}</Badge>))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <EditableCardSection
                            title="Campos do Contato"
                            icon={FileText}
                            isEditing={editingSection === 'customFields'}
                            isSaving={isSaving}
                            onEdit={handleEditCustomFields}
                            onSave={handleSaveChanges}
                            onCancel={handleCancelEdit}
                        >
                            {editingSection === 'customFields' ? (
                                <div className="space-y-2">
                                    {customFieldsArray.map((field) => (
                                        <div key={field.id} className="flex items-center gap-1.5">
                                            <Input
                                                placeholder="Campo"
                                                value={field.key}
                                                onChange={(e) => setCustomFieldsArray(prev => prev.map(item => item.id === field.id ? { ...item, key: e.target.value } : item))}
                                                className="flex-1 h-8 text-xs"
                                            />
                                            <Input
                                                placeholder="Valor"
                                                value={field.value}
                                                onChange={(e) => setCustomFieldsArray(prev => prev.map(item => item.id === field.id ? { ...item, value: e.target.value } : item))}
                                                className="flex-1 h-8 text-xs"
                                            />
                                            <Button variant="ghost" size="icon" onClick={() => setCustomFieldsArray(prev => prev.filter(item => item.id !== field.id))} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCustomFieldsArray(prev => [...prev, { id: `new-${Date.now()}`, key: '', value: '' }])}
                                        className="w-full mt-2 border-dashed text-xs text-muted-foreground"
                                    >
                                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar campo
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-0">
                                    {(!contact.customFields || Object.keys(contact.customFields).length === 0) ? (
                                        <p className="text-xs text-muted-foreground">Nenhum campo personalizado.</p>
                                    ) : (
                                        <div className="divide-y divide-border/40 border border-border/40 rounded-md overflow-hidden">
                                            {Object.entries(contact.customFields as Record<string, string>).map(([key, value]) => {
                                                if (!value || !String(value).trim()) return null;
                                                const displayLabel = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                                                const capitalizedLabel = displayLabel.charAt(0).toUpperCase() + displayLabel.slice(1);
                                                return (
                                                    <div key={key} className="flex flex-col sm:flex-row sm:items-baseline justify-between p-2 hover:bg-muted/30 transition-colors">
                                                        <span className="text-xs font-medium text-muted-foreground w-full sm:w-[120px] truncate">{capitalizedLabel}</span>
                                                        <span className="text-xs text-foreground font-medium flex-1 sm:text-right break-words">{String(value)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </EditableCardSection>

                        <Card className={PREMIUM_CARD_CLASS}>
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
                                <Button size="sm" className="w-full mt-3" onClick={handleSaveChanges} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                    Salvar Notas
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* --- CRM & IA --- */}
                    <div className="space-y-5">
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

                        <Card className={PREMIUM_CARD_CLASS}>
                            <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0">
                                <Kanban className="h-4 w-4" />
                                <CardTitle className="text-sm">Funil de Vendas</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {contact.funnels && contact.funnels.length > 0 ? (
                                    contact.funnels.map((funnel) => (
                                        <div key={funnel.leadId} className="flex flex-col gap-2 p-2 rounded bg-muted/20 border border-border/40">
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{funnel.boardName}</span>
                                            {funnel.boardStages && funnel.boardStages.length > 0 ? (
                                                <Select
                                                    value={funnel.stageId}
                                                    onValueChange={(val) => handleUpdateFunnelStage(funnel.leadId, val)}
                                                >
                                                    <SelectTrigger className="h-7 text-xs bg-background/50">
                                                        <SelectValue placeholder="Selecione a etapa" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {funnel.boardStages.map((stage: any) => (
                                                            <SelectItem key={stage.id} value={stage.id} className="text-xs">
                                                                {stage.title || stage.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Badge variant="secondary" className="w-fit text-xs font-medium">
                                                    {funnel.stageName}
                                                </Badge>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-muted-foreground/50">Não atribuído a nenhum funil.</p>
                                )}

                                {isAddingFunnel ? (
                                    <div className="flex flex-col gap-2 p-2 mt-2 rounded bg-muted/30 border border-dashed border-border/60">
                                        <Select value={newFunnelBoardId} onValueChange={(val) => { setNewFunnelBoardId(val); setNewFunnelStageId(''); }}>
                                            <SelectTrigger className="h-7 text-xs bg-background"><SelectValue placeholder="Selecione o Funil" /></SelectTrigger>
                                            <SelectContent>
                                                {availableBoards.map(b => <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Select value={newFunnelStageId} onValueChange={setNewFunnelStageId} disabled={!newFunnelBoardId}>
                                            <SelectTrigger className="h-7 text-xs bg-background"><SelectValue placeholder="Selecione a Etapa" /></SelectTrigger>
                                            <SelectContent>
                                                {availableBoards.find(b => b.id === newFunnelBoardId)?.stages?.map((s: any) => (
                                                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.title || s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="flex gap-2 justify-end mt-1">
                                            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setIsAddingFunnel(false)}>Cancelar</Button>
                                            <Button size="sm" className="h-6 text-[10px]" onClick={handleAddFunnel} disabled={!newFunnelStageId}>Adicionar</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button variant="outline" size="sm" className="w-full text-xs h-7 border-dashed mt-2" onClick={() => setIsAddingFunnel(true)}>
                                        <Plus className="h-3 w-3 mr-1" /> Adicionar a um Funil
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        {contact.activeConversations && contact.activeConversations.length > 0 && (
                            <Card className={PREMIUM_CARD_CLASS}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" />
                                        Conversas & IA
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
                        
                        {/* --- SEÇÃO DE AUTOMAÇÕES --- */}
                        <Card className={PREMIUM_CARD_CLASS}>
                            <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0">
                                <Zap className="h-4 w-4" />
                                <CardTitle className="text-sm">Automações</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {(!contact.automations || contact.automations.length === 0) ? (
                                    <p className="text-xs text-muted-foreground/50">Nenhuma automação registrada.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {/* Automações Ativas/Pausadas/Atrasadas */}
                                        {contact.automations.filter(a => ['running', 'paused', 'delayed'].includes(a.status)).length > 0 && (
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Em andamento</Label>
                                                <div className="flex flex-col gap-2">
                                                    {contact.automations.filter(a => ['running', 'paused', 'delayed'].includes(a.status)).map(a => (
                                                        <div key={a.executionId} className={`flex flex-col gap-1 text-xs p-2 rounded border ${a.status === 'paused' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'}`}>
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-1.5 font-medium truncate pr-2">
                                                                    {a.status === 'paused' ? <Pause className="h-3 w-3 shrink-0" /> : <Clock className="h-3 w-3 animate-pulse shrink-0" />}
                                                                    <span className="truncate">{a.flowName}</span>
                                                                </div>
                                                                <div className="flex gap-1 shrink-0">
                                                                    {['running', 'delayed'].includes(a.status) ? (
                                                                        <button onClick={() => handleAutomationAction(a.executionId, 'pause')} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors" title="Pausar"><Pause className="h-3 w-3" /></button>
                                                                    ) : (
                                                                        <button onClick={() => handleAutomationAction(a.executionId, 'resume')} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors" title="Retomar"><Play className="h-3 w-3" /></button>
                                                                    )}
                                                                    <button onClick={() => handleAutomationAction(a.executionId, 'cancel')} className="p-1 hover:bg-red-500/20 text-red-600 rounded transition-colors" title="Cancelar"><XCircle className="h-3 w-3" /></button>
                                                                </div>
                                                            </div>
                                                            {a.currentStepLabel && (
                                                                <div className="flex items-center gap-1 opacity-80 mt-0.5">
                                                                    <span className="text-[10px] uppercase font-semibold">Etapa:</span>
                                                                    <span className="truncate text-xs">{a.currentStepLabel}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* --- AGENDA --- */}
                    <div className="space-y-5">
                        <Button
                            size="sm"
                            className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm"
                            onClick={handleInitiateCall}
                            disabled={isCalling}
                        >
                            {isCalling ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Conectando ramal...
                                </>
                            ) : (
                                <>
                                    <Phone className="h-4 w-4 mr-2" />
                                    Ligar para o Contato
                                </>
                            )}
                        </Button>
                        <Card className={PREMIUM_CARD_CLASS}>
                            <CardHeader className="pb-2 flex flex-row justify-between items-center space-y-0">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Agenda / Reuniões
                                </CardTitle>
                                <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setShowScheduleForm(!showScheduleForm)}>
                                    <Plus className="h-3 w-3 mr-1" /> Novo
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {showScheduleForm && (
                                    <div className="p-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 space-y-2 mb-3">
                                        <Label className="text-xs font-semibold">Agendar Nova Reunião</Label>
                                        <Input
                                            type="datetime-local"
                                            value={scheduleDateTime}
                                            onChange={(e) => setScheduleDateTime(e.target.value)}
                                            className="text-sm h-8"
                                        />
                                        <div className="flex gap-2 pt-1">
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
                    </div>

                    {/* --- HISTÓRICO --- */}
                    <div className="space-y-5">
                        <ContactHistoryTimeline contactId={contact.id} />
                    </div>
                </div>
                
                <div className="border-t border-border/40 pt-4 mt-2">
                    {(onArchive && onUnarchive) && (
                        <Button
                            size="sm"
                            variant={isArchived ? "default" : "secondary"}
                            className="w-full"
                            onClick={isArchived ? onUnarchive : onArchive}
                        >
                            {isArchived ? (
                                <><Undo className="h-4 w-4 mr-2" /> Reabrir Conversa</>
                            ) : (
                                <><Archive className="h-4 w-4 mr-2" /> Arquivar Conversa</>
                            )}
                        </Button>
                    )}
                </div>

            </div>
        </ScrollArea>
    )
}
