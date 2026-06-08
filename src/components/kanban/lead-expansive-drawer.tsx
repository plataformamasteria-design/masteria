'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { InboxView } from '@/components/atendimentos/inbox-view';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Mail, DollarSign, Calendar as CalendarIcon, Clock, MessageCircle, X, Edit, Save, Loader2, Pause, Play, Tag as TagIcon, MapPin, User, Trash2, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { MultiSelectCreatable } from '@/components/ui/multi-select-creatable';
import type { KanbanCard, ExtendedContact, Tag, KanbanStage } from '@/lib/types';
import { NeurolinguisticCard } from '@/components/contacts/neurolinguistic-card';
import { ContactHistoryTimeline } from '@/components/contacts/contact-history-timeline';
import { OutboundConversationStarter } from '@/components/kanban/outbound-conversation-starter';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Falha ao buscar dados');
  return res.json();
});

interface LeadExpansiveDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: KanbanCard;
  stages: KanbanStage[];
  initialTab?: string;
  onUpdate: (leadId: string, data: any) => Promise<void>;
  onDelete: (leadId: string) => Promise<void>;
  onOpenWhatsApp?: (contactId: string) => void;
  onUpdateCards?: () => void;
}

export function LeadExpansiveDrawer({ open, onOpenChange, card, stages, initialTab, onUpdate, onDelete, onOpenWhatsApp, onUpdateCards }: LeadExpansiveDrawerProps) {
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<'profile' | 'address' | 'customFields' | 'segmentation' | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isChatMode, setIsChatMode] = useState(false);
  const [isContactDetailsOpen, setIsContactDetailsOpen] = useState(false);

  // States for Editing Contact
  const [contactForm, setContactForm] = useState<Partial<ExtendedContact>>({});
  const [customFieldsArray, setCustomFieldsArray] = useState<{ id: string, key: string, value: string }[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  // States for Lead
  const [leadTitle, setLeadTitle] = useState(card.title || '');
  const [leadValue, setLeadValue] = useState(card.value || 0);
  const [leadNotes, setLeadNotes] = useState(card.notes || '');
  const [leadStatus, setLeadStatus] = useState(card.status || 'ACTIVE');
  const [leadStageId, setLeadStageId] = useState(card.stageId);

  // States for Loss Reason Dialog
  const [lossReasonOpen, setLossReasonOpen] = useState(false);
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState('');

  // Data Fetching with SWR
  const { 
    data: contactDetails, 
    isLoading: isLoadingContact, 
    mutate: mutateContact 
  } = useSWR(
    open && card.contact?.id ? `/api/v1/contacts/${card.contact.id}` : null,
    fetcher
  );

  const { data: tagsData } = useSWR(
    open ? '/api/v1/tags' : null,
    fetcher
  );

  // Sync Form State with SWR Data
  useEffect(() => {
    if (contactDetails && !editingSection) {
      setContactForm(contactDetails);
      setSelectedTagIds(contactDetails.tags?.map((t: Tag) => t.id) || []);
    }
  }, [contactDetails, editingSection]);

  useEffect(() => {
    if (tagsData) {
      setAvailableTags(tagsData.tags || tagsData);
    }
  }, [tagsData]);

  // Loading state abstraction
  const loadingContact = isLoadingContact && !contactDetails;

  useEffect(() => {
    if (open) {
      // Reset ALL state when a new card is opened (including switching between cards)
      setLeadTitle(card.title || '');
      setLeadValue(card.value || 0);
      setLeadNotes(card.notes || '');
      setLeadStatus(card.status || 'ACTIVE');
      setLeadStageId(card.stageId);
      setEditingSection(null);
      setIsChatMode(initialTab === 'chat');
      setIsContactDetailsOpen(false);
      setActiveTab('overview');
      // No need to nullify contactDetails or fetch manually, SWR handles it
    }
  // card.id ensures state resets when user opens a DIFFERENT card without closing drawer first
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card.id, initialTab]);

  // Actions
  const handleSaveContact = async () => {
    if (!card.contact?.id) return;
    setIsSaving(true);
    try {
      const payload: any = { ...contactForm };
      
      if (editingSection === 'customFields') {
        const customObj: Record<string, string> = {};
        customFieldsArray.forEach(f => {
          const key = f.key.trim();
          if (key) customObj[key] = f.value;
        });
        payload.customFields = customObj;
      }

      if (editingSection === 'segmentation') {
        payload.tagIds = selectedTagIds;
      }

      const response = await fetch(`/api/v1/contacts/${card.contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Falha ao salvar as alterações do contato.');
      
      await mutateContact();
      onUpdateCards?.();
      setEditingSection(null);
      notify.success('Contato atualizado!');
    } catch (e: any) {
      notify.error('Erro ao salvar', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLead = async () => {
    setIsSaving(true);
    try {
      await onUpdate(card.id, {
        title: leadTitle,
        value: leadValue,
        notes: leadNotes,
        status: leadStatus
      });
      notify.success('Lead atualizado!');
    } catch (e: any) {
      notify.error('Erro ao atualizar', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmLossReason = async () => {
    if (!pendingStageId) return;
    setIsSaving(true);
    try {
      const reasonPrefix = `[Motivo da perda]: ${lossReason.trim()}`;
      const newNotes = leadNotes ? `${reasonPrefix}\n\n${leadNotes}` : reasonPrefix;
      
      await onUpdate(card.id, { stageId: pendingStageId, notes: newNotes });
      setLeadStageId(pendingStageId);
      setLeadNotes(newNotes);
      notify.success('Etapa e motivo atualizados com sucesso!');
      setLossReasonOpen(false);
      setLossReason('');
      setPendingStageId(null);
      onUpdateCards?.();
    } catch (e: any) {
      notify.error('Erro ao mover lead', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const togglePauseStatus = async () => {
    const newStatus = leadStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setLeadStatus(newStatus);
    try {
      await onUpdate(card.id, { status: newStatus });
      notify.success(`Lead ${newStatus === 'PAUSED' ? 'pausado' : 'retomado'} com sucesso!`);
    } catch (e) {
      setLeadStatus(leadStatus); // revert
      notify.error('Erro ao alterar status');
    }
  };

  const handleEditCustomFields = () => {
    setEditingSection('customFields');
    const fields = Object.entries(contactDetails?.customFields || {}).map(([k, v], i) => ({
      id: `field-${i}-${Date.now()}`,
      key: k,
      value: String(v)
    }));
    setCustomFieldsArray(fields);
  };

  const currentStage = stages.find(s => s.id === card.stageId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent 
        hideOverlay
        className={`w-full ${isChatMode && isContactDetailsOpen ? 'sm:max-w-5xl' : 'sm:max-w-2xl'} p-0 flex flex-col h-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border-l border-zinc-200 dark:border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.2)] dark:shadow-[0_0_50px_rgba(0,0,0,0.7)] transition-all duration-300 text-zinc-900 dark:text-zinc-200`}
      >
        {/* HEADER EXPANSO */}
        {!isChatMode && (
          <div className="px-6 py-6 border-b border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-950 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
            <SheetHeader className="text-left space-y-0 relative z-10">
              <div className="flex items-start justify-between pb-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border-2 border-white dark:border-zinc-900 shadow-md">
                    <AvatarImage src={card.contact?.avatarUrl || ''} />
                    <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">{(card.contact?.name || 'L').substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="text-xl flex items-center gap-2 font-bold tracking-tight text-zinc-900 dark:text-white">
                      {card.contact?.name || 'Lead sem nome'}
                      {leadStatus === 'PAUSED' && (
                        <Badge variant="secondary" className="bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/50">
                          Pausado
                        </Badge>
                      )}
                    </SheetTitle>
                    <SheetDescription className="text-sm mt-1 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                      <Phone className="h-3.5 w-3.5" />
                      {card.contact?.phone}
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      {leadTitle || 'Sem título'}
                    </SheetDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={leadStatus === 'ACTIVE' ? "outline" : "default"} size="sm" onClick={togglePauseStatus} className="rounded-full shadow-sm bg-white dark:bg-zinc-900">
                    {leadStatus === 'ACTIVE' ? (
                      <><Pause className="h-4 w-4 mr-1 text-zinc-500" /> Pausar</>
                    ) : (
                      <><Play className="h-4 w-4 mr-1" /> Retomar</>
                    )}
                  </Button>
                  {card.contact?.id && (
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); setIsChatMode(true); }} className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] transition-all border border-transparent">
                      <MessageCircle className="h-4 w-4 mr-1.5" /> Chat
                    </Button>
                  )}
                </div>
              </div>

              {/* Quick Metrics Header - Premium Redesign */}
              <div className="pt-6 mt-2 border-t border-zinc-200/40 dark:border-white/5 flex flex-col xl:flex-row items-stretch xl:items-center gap-3">
                <div className="flex-1 bg-zinc-50/50 dark:bg-white/[0.02] border border-zinc-200/60 dark:border-white/10 rounded-2xl p-1.5 flex flex-col md:flex-row items-stretch md:items-center shadow-sm backdrop-blur-sm">
                  
                  {/* Stage Selector - Prominent */}
                  <div className="flex-1 relative group min-w-0">
                    <Select
                      value={leadStageId}
                      onValueChange={async (val) => {
                        const targetStage = stages.find(s => s.id === val);
                        if (targetStage?.type === 'LOSS') {
                          setPendingStageId(val);
                          setLossReasonOpen(true);
                          return;
                        }

                        setLeadStageId(val);
                        setIsSaving(true);
                        try {
                          await onUpdate(card.id, { stageId: val });
                          notify.success('Etapa atualizada!');
                        } catch (e: any) {
                          setLeadStageId(card.stageId);
                          notify.error('Erro ao alterar etapa', e.message);
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="w-full h-12 border-none bg-white dark:bg-white/5 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.2)] ring-1 ring-zinc-200/50 dark:ring-white/5 focus:ring-emerald-500/50 hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors flex justify-between px-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                            <Layers className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col items-start gap-0 min-w-0">
                            <span className="text-[9px] font-bold tracking-widest uppercase text-emerald-600/70 dark:text-emerald-400/70">Etapa do Funil</span>
                            <span className="font-semibold text-sm text-zinc-900 dark:text-white truncate max-w-full"><SelectValue placeholder="Selecione a Etapa" /></span>
                          </div>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-zinc-200 dark:border-white/10 shadow-xl">
                        {stages.map(s => (
                          <SelectItem key={s.id} value={s.id} className="text-sm font-medium py-2.5 focus:bg-zinc-100 dark:focus:bg-white/10 cursor-pointer">
                            {s.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="w-full md:w-px h-px md:h-8 bg-zinc-200 dark:bg-white/10 my-2 md:my-0 md:mx-3 flex-shrink-0" />
                  
                  {/* Values Row */}
                  <div className="flex items-center flex-1 md:flex-none justify-between md:justify-start gap-4 px-2 md:px-0">
                    {/* Value */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-white dark:bg-white/5 text-zinc-400 dark:text-zinc-500 shadow-sm border border-zinc-100 dark:border-white/5">
                        <DollarSign className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-400 dark:text-zinc-500">Valor Oportunidade</span>
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">R$ {Number(leadValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="w-px h-8 bg-zinc-200 dark:bg-white/10 mx-2 hidden sm:block" />

                    {/* Date */}
                    <div className="flex items-center gap-3 pr-2">
                      <div className="p-2 rounded-full bg-white dark:bg-white/5 text-zinc-400 dark:text-zinc-500 shadow-sm border border-zinc-100 dark:border-white/5">
                        <CalendarIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-400 dark:text-zinc-500">Criado em</span>
                        <span className="font-medium text-sm text-zinc-700 dark:text-zinc-300">{format(new Date(card.createdAt), 'dd/MM/yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>
            </SheetHeader>
          </div>
        )}

        {/* TABS OR CHAT */}
        {isChatMode ? (
          <div className="flex-1 overflow-hidden h-full flex flex-col">
            {loadingContact ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (contactDetails as any)?.activeConversations?.length > 0 ? (() => {
              const activeConvs = (contactDetails as any).activeConversations;
              
              const syntheticConversations = activeConvs.map((conv: any) => ({
                id: conv.id,
                contactId: (contactDetails as any).id,
                connectionId: conv.connectionId || '',
                connectionName: conv.connectionName || 'Conexão',
                connectionType: conv.connectionType || 'apicloud',
                status: conv.status || 'OPEN',
                lastMessageAt: conv.lastMessageAt || new Date(),
                aiActive: conv.aiActive || false,
                contactName: (contactDetails as any).name || (contactDetails as any).whatsappName || 'Contato',
                contactPhone: (contactDetails as any).phone || '',
                contactAvatarUrl: (contactDetails as any).avatarUrl || null,
                createdAt: new Date(),
                updatedAt: new Date(),
                archivedAt: null,
                archivedBy: null,
                lastMessage: null,
                lastMessageSenderType: null,
                assignedTo: conv.assignedTo || null,
                teamId: conv.teamId || null,
                assignedUserName: conv.assignedUserName || null,
                tags: [],
              }));

              const mainConv = syntheticConversations[0];

              return (
                <InboxView 
                  preselectedConversationId={mainConv.id}
                  preselectedConversation={mainConv as any}
                  initialConversations={syntheticConversations as any}
                  hideConversationList={true}
                  hideContactDetails={true}
                  onBack={() => setIsChatMode(false)}
                  forceShowBack={true}
                  onContactDetailsToggle={(isOpen) => setIsContactDetailsOpen(isOpen)}
                />
              );
            })() : (
              <OutboundConversationStarter
                contactId={card.contact?.id as string}
                kanbanCardId={card.id}
                onConversationStarted={async () => {
                  // Rebuscar detalhes do contato via SWR
                  // para que o drawer troque automaticamente para o chat criado
                  await mutateContact();
                  onUpdateCards?.();
                  // Forçar re-render do isChatMode para mostrar o InboxView
                  setIsChatMode(false);
                  setTimeout(() => setIsChatMode(true), 50);
                }}
              />
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden relative">
              <ScrollArea className="h-full p-6">
                <div className="flex flex-col gap-6 pb-12">
                
                {/* Loss Reason Alert */}
                {currentStage?.type === 'LOSS' && leadNotes && (
                  <div className="p-4 bg-red-100 border border-red-200 rounded-lg text-sm text-red-900 dark:bg-red-900/30 dark:border-red-900/50 dark:text-red-200">
                    <strong className="block mb-1 font-semibold">Motivo da Perda (Notas Internas):</strong>
                    <p className="whitespace-pre-wrap">{leadNotes}</p>
                  </div>
                )}

                {/* Lead Edit Quick Form */}
                <Card className="border border-zinc-200 dark:border-white/10 !bg-white dark:!bg-white/[0.02] shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(0,0,0,0.3)] backdrop-blur-md rounded-2xl">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Informações do Lead no Funil</CardTitle>
                    <Button size="sm" onClick={handleSaveLead} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all">
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Salvar Lead
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Título da Oportunidade</Label>
                        <Input value={leadTitle} onChange={(e) => setLeadTitle(e.target.value)} className="bg-zinc-50 dark:bg-black/50 border border-zinc-200 dark:border-white/10 shadow-inner focus-visible:ring-emerald-500/50 transition-colors" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Valor (R$)</Label>
                        <Input type="number" value={leadValue} onChange={(e) => setLeadValue(Number(e.target.value))} className="bg-zinc-50 dark:bg-black/50 border border-zinc-200 dark:border-white/10 shadow-inner focus-visible:ring-emerald-500/50 transition-colors" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Anotações do Lead</Label>
                      <Textarea rows={3} value={leadNotes} onChange={(e) => setLeadNotes(e.target.value)} placeholder="Anotações sobre a negociação..." className="bg-zinc-50 dark:bg-black/50 border border-zinc-200 dark:border-white/10 shadow-inner focus-visible:ring-emerald-500/50 transition-colors custom-scrollbar resize-none" />
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Profile Summary */}
                <Card className="border border-zinc-200 dark:border-white/10 !bg-white dark:!bg-white/[0.02] shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(0,0,0,0.3)] backdrop-blur-md rounded-2xl h-full flex flex-col">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Contato</CardTitle>
                    {editingSection !== 'profile' && (
                      <Button variant="ghost" size="sm" onClick={() => setEditingSection('profile')}><Edit className="h-3.5 w-3.5 mr-1" /> Editar</Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {editingSection === 'profile' ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5"><Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Nome</Label><Input value={contactForm.name || ''} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="bg-zinc-50 dark:bg-black/50 border border-zinc-200 dark:border-white/10 shadow-inner focus-visible:ring-emerald-500/50 h-8 text-xs" /></div>
                          <div className="space-y-1.5"><Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Telefone</Label><Input value={contactForm.phone || ''} onChange={e => setContactForm({...contactForm, phone: e.target.value})} className="bg-zinc-50 dark:bg-black/50 border border-zinc-200 dark:border-white/10 shadow-inner focus-visible:ring-emerald-500/50 h-8 text-xs" /></div>
                          <div className="space-y-1.5"><Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Email</Label><Input value={contactForm.email || ''} onChange={e => setContactForm({...contactForm, email: e.target.value})} className="bg-zinc-50 dark:bg-black/50 border border-zinc-200 dark:border-white/10 shadow-inner focus-visible:ring-emerald-500/50 h-8 text-xs" /></div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2 mt-auto">
                          <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)}>Cancelar</Button>
                          <Button size="sm" onClick={handleSaveContact} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]">Salvar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-y-4 text-sm">
                        <div><p className="text-muted-foreground text-xs">Email</p><p>{contactDetails?.email || '-'}</p></div>
                        <div><p className="text-muted-foreground text-xs">Nome de WhatsApp</p><p>{contactDetails?.whatsappName || '-'}</p></div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Segments and Tags */}
                <Card className="border border-zinc-200 dark:border-white/10 !bg-white dark:!bg-white/[0.02] shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(0,0,0,0.3)] backdrop-blur-md rounded-2xl h-full flex flex-col">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2"><TagIcon className="h-4 w-4" /> Segmentação (Tags)</CardTitle>
                    {editingSection !== 'segmentation' && (
                      <Button variant="ghost" size="sm" onClick={() => setEditingSection('segmentation')}><Edit className="h-3.5 w-3.5 mr-1" /> Editar</Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {editingSection === 'segmentation' ? (
                      <div className="space-y-4">
                        <MultiSelectCreatable
                          options={availableTags.map(t => ({ label: t.name, value: t.id }))}
                          selectedValues={selectedTagIds}
                          onChange={setSelectedTagIds}
                          placeholder="Selecione as tags..."
                        />
                        <div className="flex justify-end gap-2 pt-2 mt-auto">
                          <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)}>Cancelar</Button>
                          <Button size="sm" onClick={handleSaveContact} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]">Salvar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {contactDetails?.tags?.map((tag: any) => (
                          <Badge key={tag.id} variant="outline" style={{ borderColor: tag.color, color: tag.color }}>{tag.name}</Badge>
                        ))}
                        {(!contactDetails?.tags || contactDetails.tags.length === 0) && <p className="text-xs text-muted-foreground">Sem tags vinculadas.</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>

              {/* DETAILS (Custom Fields, Neurolinguistic) */}
                
                {/* Custom Fields */}
                <Card className="border border-zinc-200 dark:border-white/10 !bg-white dark:!bg-white/[0.02] shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(0,0,0,0.3)] backdrop-blur-md rounded-2xl h-full flex flex-col">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Campos Personalizados</CardTitle>
                    {editingSection !== 'customFields' && (
                      <Button variant="ghost" size="sm" onClick={handleEditCustomFields}><Edit className="h-3.5 w-3.5 mr-1" /> Editar</Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {editingSection === 'customFields' ? (
                      <div className="space-y-3">
                        {customFieldsArray.map((field) => (
                          <div key={field.id} className="flex items-center gap-2">
                            <Input placeholder="Nome do Campo" value={field.key} onChange={(e) => setCustomFieldsArray(prev => prev.map(f => f.id === field.id ? {...f, key: e.target.value} : f))} className="flex-1 bg-zinc-50 dark:bg-black/50 border border-zinc-200 dark:border-white/10 shadow-inner focus-visible:ring-emerald-500/50 h-8 text-xs" />
                            <Input placeholder="Valor" value={field.value} onChange={(e) => setCustomFieldsArray(prev => prev.map(f => f.id === field.id ? {...f, value: e.target.value} : f))} className="flex-1 bg-zinc-50 dark:bg-black/50 border border-zinc-200 dark:border-white/10 shadow-inner focus-visible:ring-emerald-500/50 h-8 text-xs" />
                            <Button variant="ghost" size="icon" onClick={() => setCustomFieldsArray(prev => prev.filter(f => f.id !== field.id))} className="text-destructive h-8 w-8"><X className="h-4 w-4" /></Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setCustomFieldsArray(prev => [...prev, { id: Date.now().toString(), key: '', value: '' }])}>
                          + Adicionar Campo
                        </Button>
                        <div className="flex justify-end gap-2 pt-2 mt-auto">
                          <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)}>Cancelar</Button>
                          <Button size="sm" onClick={handleSaveContact} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]">Salvar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0 divide-y divide-border/40 border rounded-md overflow-hidden">
                        {contactDetails?.customFields && Object.entries(contactDetails.customFields).map(([key, value]) => {
                          if (!value) return null;
                          return (
                            <div key={key} className="flex justify-between p-3 text-sm gap-4 items-center bg-zinc-50/50 dark:bg-zinc-900/30">
                              <span className="font-semibold text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[40%] flex-shrink-0" title={key}>{key}</span>
                              <span className="text-right text-xs text-zinc-900 dark:text-zinc-100 break-all w-full leading-relaxed" style={{ wordBreak: 'break-all' }}>{String(value)}</span>
                            </div>
                          )
                        })}
                        {(!contactDetails?.customFields || Object.keys(contactDetails.customFields).length === 0) && <p className="p-3 text-xs text-muted-foreground">Nenhum campo personalizado.</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>



              {/* HISTORY */}
                {card.contact?.id && (
                  <div className="mt-4">
                    <ContactHistoryTimeline contactId={card.contact.id} hideAvatar />
                  </div>
                )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* BOTTOM ACTIONS */}
        {!isChatMode && (
          <div className="px-6 py-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.02] flex justify-between items-center">
            <Button variant="destructive" size="sm" onClick={() => { onOpenChange(false); onDelete(card.id); }}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir Lead
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        )}

        {/* LOSS REASON DIALOG */}
        <Dialog open={lossReasonOpen} onOpenChange={(open) => {
          if (!open && !isSaving) {
            setLossReasonOpen(false);
            setLossReason('');
            setPendingStageId(null);
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Motivo da Perda</DialogTitle>
              <DialogDescription>
                Por que este lead não foi qualificado? O motivo será salvo nas notas internas.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea 
                value={lossReason} 
                onChange={(e) => setLossReason(e.target.value)} 
                placeholder="Descreva o motivo detalhadamente..."
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => {
                setLossReasonOpen(false);
                setLossReason('');
                setPendingStageId(null);
              }} disabled={isSaving}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmLossReason} disabled={isSaving || !lossReason.trim()}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Salvar e Mover
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
