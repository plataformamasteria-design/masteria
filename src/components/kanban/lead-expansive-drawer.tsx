'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Phone, Mail, DollarSign, Calendar as CalendarIcon, Clock, MessageCircle, X, Edit, Save, Loader2, Pause, Play, Tag as TagIcon, MapPin, User, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { MultiSelectCreatable } from '@/components/ui/multi-select-creatable';
import type { KanbanCard, ExtendedContact, Tag, KanbanStage } from '@/lib/types';
import { NeurolinguisticCard } from '@/components/contacts/neurolinguistic-card';
import { ContactHistoryTimeline } from '@/components/contacts/contact-history-timeline';
import { OutboundConversationStarter } from '@/components/kanban/outbound-conversation-starter';

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

  // Load Contact Details deeper
  const [contactDetails, setContactDetails] = useState<ExtendedContact | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);

  const fetchContactDetails = useCallback(async () => {
    if (!card.contact?.id) return;
    setLoadingContact(true);
    try {
      const res = await fetch(`/api/v1/contacts/${card.contact.id}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setContactDetails(data);
        setContactForm(data);
        setSelectedTagIds(data.tags?.map((t: Tag) => t.id) || []);
      }
      
      const tagsRes = await fetch('/api/v1/tags');
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        setAvailableTags(tagsData.tags || tagsData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingContact(false);
    }
  }, [card.contact?.id]);

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
      setContactDetails(null);
      void fetchContactDetails();
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
      
      await fetchContactDetails();
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
        className={`w-full ${isChatMode && isContactDetailsOpen ? 'sm:max-w-5xl' : 'sm:max-w-2xl'} p-0 flex flex-col h-full bg-background dark:bg-[#09090b] border-l border-border/40 shadow-2xl transition-all duration-300`}
      >
        {/* HEADER EXPANSO */}
        {!isChatMode && (
          <div className="px-6 py-4 border-b bg-card">
          <SheetHeader className="text-left space-y-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border shadow-sm">
                  <AvatarImage src={card.contact?.avatarUrl || ''} />
                  <AvatarFallback>{(card.contact?.name || 'L').substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle className="text-xl flex items-center gap-2">
                    {card.contact?.name || 'Lead sem nome'}
                    {leadStatus === 'PAUSED' && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        Pausado
                      </Badge>
                    )}
                  </SheetTitle>
                  <SheetDescription className="text-sm mt-1 flex items-center gap-2">
                    {card.contact?.phone}
                    <span className="text-muted-foreground/30">•</span>
                    {leadTitle || 'Sem título'}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant={leadStatus === 'ACTIVE' ? "secondary" : "default"} size="sm" onClick={togglePauseStatus}>
                  {leadStatus === 'ACTIVE' ? (
                    <><Pause className="h-4 w-4 mr-1" /> Pausar</>
                  ) : (
                    <><Play className="h-4 w-4 mr-1" /> Retomar</>
                  )}
                </Button>
                {card.contact?.id && (
                  <Button size="sm" onClick={(e) => { e.stopPropagation(); setIsChatMode(true); }}>
                    <MessageCircle className="h-4 w-4 mr-1" /> Chat
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Metrics Header */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-primary">R$ {Number(leadValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center gap-2">
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
                  <SelectTrigger className="h-7 text-xs border-dashed bg-muted/30 max-w-[200px]">
                    <SelectValue placeholder="Selecione a Etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                Criado em {format(new Date(card.createdAt), 'dd/MM/yyyy')}
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
            ) : (contactDetails as any)?.activeConversations?.[0]?.id ? (() => {
              const activeConv = (contactDetails as any).activeConversations[0];
              // Map the basic properties required to make it look like a real conversation initially
              // It will fetch the real one if we need full data, but InboxView handles it gracefully if preselected is provided.
              const syntheticConversation = {
                id: activeConv.id,
                contactId: (contactDetails as any).id,
                connectionId: activeConv.connectionId || '',
                connectionName: activeConv.connectionName || 'Conexão',
                connectionType: activeConv.connectionType || 'apicloud',
                status: activeConv.status || 'OPEN',
                lastMessageAt: activeConv.lastMessageAt || new Date(),
                aiActive: activeConv.aiActive || false,
                contactName: (contactDetails as any).name || (contactDetails as any).whatsappName || 'Contato',
                contactPhone: (contactDetails as any).phone || '',
                contactAvatarUrl: (contactDetails as any).avatarUrl || null,
                createdAt: new Date(),
                updatedAt: new Date(),
                archivedAt: null,
                archivedBy: null,
                lastMessage: null,
                lastMessageSenderType: null,
                assignedTo: activeConv.assignedTo || null,
                teamId: activeConv.teamId || null,
                assignedUserName: activeConv.assignedUserName || null,
                tags: [],
              };

              return (
                <InboxView 
                  preselectedConversationId={activeConv.id}
                  preselectedConversation={syntheticConversation as any}
                  initialConversations={[syntheticConversation as any]}
                  hideConversationList={true}
                  hideContactDetails={false}
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
                  // Rebuscar detalhes do contato (inclui activeConversations)
                  // para que o drawer troque automaticamente para o chat criado
                  await fetchContactDetails();
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
              <div className="px-6 pt-2 border-b">
                <TabsList className="bg-transparent border-b-0 space-x-4">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0">Resumo</TabsTrigger>
                  <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0">Detalhes</TabsTrigger>
                  <TabsTrigger value="history" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0">Histórico</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden relative">
                <ScrollArea className="h-full p-6">
                  {/* TAB OVERVIEW */}
                  <TabsContent value="overview" className="mt-0 space-y-6">
                
                {/* Loss Reason Alert */}
                {currentStage?.type === 'LOSS' && leadNotes && (
                  <div className="p-4 bg-red-100 border border-red-200 rounded-lg text-sm text-red-900 dark:bg-red-900/30 dark:border-red-900/50 dark:text-red-200">
                    <strong className="block mb-1 font-semibold">Motivo da Perda (Notas Internas):</strong>
                    <p className="whitespace-pre-wrap">{leadNotes}</p>
                  </div>
                )}

                {/* Lead Edit Quick Form */}
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Informações do Lead no Funil</CardTitle>
                    <Button size="sm" onClick={handleSaveLead} disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Salvar Lead
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Título da Oportunidade</Label>
                        <Input value={leadTitle} onChange={(e) => setLeadTitle(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Valor (R$)</Label>
                        <Input type="number" value={leadValue} onChange={(e) => setLeadValue(Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Anotações do Lead</Label>
                      <Textarea rows={3} value={leadNotes} onChange={(e) => setLeadNotes(e.target.value)} placeholder="Anotações sobre a negociação..." />
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Profile Summary */}
                <Card className="border-border/50 shadow-sm">
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
                          <div className="space-y-1.5"><Label>Nome</Label><Input value={contactForm.name || ''} onChange={e => setContactForm({...contactForm, name: e.target.value})} /></div>
                          <div className="space-y-1.5"><Label>Telefone</Label><Input value={contactForm.phone || ''} onChange={e => setContactForm({...contactForm, phone: e.target.value})} /></div>
                          <div className="space-y-1.5"><Label>Email</Label><Input value={contactForm.email || ''} onChange={e => setContactForm({...contactForm, email: e.target.value})} /></div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)}>Cancelar</Button>
                          <Button size="sm" onClick={handleSaveContact} disabled={isSaving}>Salvar</Button>
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
                <Card className="border-border/50 shadow-sm">
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
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)}>Cancelar</Button>
                          <Button size="sm" onClick={handleSaveContact} disabled={isSaving}>Salvar</Button>
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

              </TabsContent>

              {/* TAB DETAILS (Custom Fields, Neurolinguistic, Address) */}
              <TabsContent value="details" className="mt-0 space-y-6">
                
                {/* Custom Fields */}
                <Card className="border-border/50 shadow-sm">
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
                            <Input placeholder="Nome do Campo" value={field.key} onChange={(e) => setCustomFieldsArray(prev => prev.map(f => f.id === field.id ? {...f, key: e.target.value} : f))} className="flex-1" />
                            <Input placeholder="Valor" value={field.value} onChange={(e) => setCustomFieldsArray(prev => prev.map(f => f.id === field.id ? {...f, value: e.target.value} : f))} className="flex-1" />
                            <Button variant="ghost" size="icon" onClick={() => setCustomFieldsArray(prev => prev.filter(f => f.id !== field.id))} className="text-destructive"><X className="h-4 w-4" /></Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setCustomFieldsArray(prev => [...prev, { id: Date.now().toString(), key: '', value: '' }])}>
                          + Adicionar Campo
                        </Button>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)}>Cancelar</Button>
                          <Button size="sm" onClick={handleSaveContact} disabled={isSaving}>Salvar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0 divide-y divide-border/40 border rounded-md">
                        {contactDetails?.customFields && Object.entries(contactDetails.customFields).map(([key, value]) => {
                          if (!value) return null;
                          return (
                            <div key={key} className="flex justify-between p-2.5 text-sm">
                              <span className="font-medium text-muted-foreground">{key}</span>
                              <span>{String(value)}</span>
                            </div>
                          )
                        })}
                        {(!contactDetails?.customFields || Object.keys(contactDetails.customFields).length === 0) && <p className="p-3 text-xs text-muted-foreground">Nenhum campo personalizado.</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Neurolinguistic Card */}
                {contactDetails && (
                  <NeurolinguisticCard 
                    vakProfile={contactDetails.vakProfile} 
                    dominantSocialNeed={contactDetails.dominantSocialNeed} 
                    communicationPace={contactDetails.communicationPace} 
                    variant="compact" 
                  />
                )}

              </TabsContent>

              {/* TAB HISTORY */}
              <TabsContent value="history" className="mt-0 space-y-6">
                {card.contact?.id && (
                  <ContactHistoryTimeline contactId={card.contact.id} hideAvatar />
                )}
              </TabsContent>

              </ScrollArea>
            </div>
          </Tabs>
          </div>
        )}

        {/* BOTTOM ACTIONS */}
        {!isChatMode && (
          <div className="px-6 py-4 border-t bg-card flex justify-between items-center">
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
