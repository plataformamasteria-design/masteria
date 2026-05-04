'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { KanbanCard, KanbanStage } from '@/lib/types';
import { Badge } from '../ui/badge';
import { Phone, Mail, Calendar, DollarSign, MessageCircle, Pencil, Trash2, Clock, User, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================================
// EditLeadDialog — Editar todas as informações do Lead/Contato
// ============================================================

const editLeadSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(100, 'Título muito longo'),
  value: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '' || (typeof val === 'number' && isNaN(val))) {
        return undefined;
      }
      return Number(val);
    },
    z.number().min(0, 'Valor deve ser positivo').optional()
  ),
  notes: z.string().max(1000, 'Anotações muito longas').optional(),
  contactName: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email('Email inválido').or(z.literal('')).optional(),
});

type EditLeadFormData = z.infer<typeof editLeadSchema>;

interface EditLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: KanbanCard;
  onSave: (leadId: string, data: { title?: string; value?: number | null; notes?: string }) => Promise<void>;
}

export function EditLeadDialog({ open, onOpenChange, card, onSave }: EditLeadDialogProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<EditLeadFormData>({
    resolver: zodResolver(editLeadSchema),
    defaultValues: {
      title: card.title || '',
      value: (card.value !== null && card.value !== undefined) ? Number(card.value) : undefined,
      notes: card.notes || '',
      contactName: card.contact?.name || '',
      contactPhone: card.contact?.phone || '',
      contactEmail: card.contact?.email || '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: card.title || '',
        value: (card.value !== null && card.value !== undefined) ? Number(card.value) : undefined,
        notes: card.notes || '',
        contactName: card.contact?.name || '',
        contactPhone: card.contact?.phone || '',
        contactEmail: card.contact?.email || '',
      });
    }
  }, [open, card, form]);

  const handleSubmit = async (data: EditLeadFormData) => {
    setLoading(true);
    try {
      // 1. Atualizar contato se houver mudanças
      if (card.contact?.id && (
        data.contactName !== card.contact?.name ||
        data.contactPhone !== card.contact?.phone ||
        data.contactEmail !== card.contact?.email
      )) {
        const contactUpdate: Record<string, string> = {};
        if (data.contactName !== card.contact?.name) contactUpdate.name = data.contactName;
        if (data.contactPhone !== card.contact?.phone) contactUpdate.phone = data.contactPhone || '';
        if (data.contactEmail !== (card.contact?.email || '')) contactUpdate.email = data.contactEmail || '';

        await fetch(`/api/v1/contacts/${card.contact.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contactUpdate),
        });
      }

      // 2. Atualizar lead
      const submitData = {
        title: data.title,
        value: data.value === undefined ? null : data.value,
        notes: data.notes || undefined,
      };
      await onSave(card.id, submitData);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar lead:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
          <DialogDescription>
            Atualize as informações do lead e contato
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="grid gap-4 py-4">
              {/* Informações do Contato */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Informações do Contato
                </h4>
                <div className="grid gap-2">
                  <Label htmlFor="contactName">Nome *</Label>
                  <Input
                    id="contactName"
                    {...form.register('contactName')}
                    placeholder="Nome do contato"
                  />
                  {form.formState.errors.contactName && (
                    <p className="text-sm text-destructive">{form.formState.errors.contactName.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactPhone">Telefone</Label>
                  <Input
                    id="contactPhone"
                    {...form.register('contactPhone')}
                    placeholder="+5511999999999"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    {...form.register('contactEmail')}
                    placeholder="email@exemplo.com"
                  />
                  {form.formState.errors.contactEmail && (
                    <p className="text-sm text-destructive">{form.formState.errors.contactEmail.message}</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Informações do Lead */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Informações do Lead
                </h4>
                <div className="grid gap-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    {...form.register('title')}
                    placeholder="Ex: Interesse em consultoria"
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="value">Valor (R$)</Label>
                  <Input
                    id="value"
                    type="number"
                    min="0"
                    step="0.01"
                    {...form.register('value', { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                  {form.formState.errors.value && (
                    <p className="text-sm text-destructive">{form.formState.errors.value.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Anotações</Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    {...form.register('notes')}
                    placeholder="Anotações sobre o lead..."
                  />
                  {form.formState.errors.notes && (
                    <p className="text-sm text-destructive">{form.formState.errors.notes.message}</p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// DeleteLeadDialog
// ============================================================

interface DeleteLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: KanbanCard;
  onConfirm: (leadId: string) => Promise<void>;
}

export function DeleteLeadDialog({ open, onOpenChange, card, onConfirm }: DeleteLeadDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(card.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao excluir lead:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o lead <strong>{card.contact?.name || 'sem nome'}</strong>?
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading} className="bg-destructive hover:bg-destructive/90">
            {loading ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================
// ViewLeadDialog — com Abrir WhatsApp redirecionando para /atendimentos
// ============================================================

interface ViewLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: KanbanCard;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpenWhatsApp?: () => void;
}

export function ViewLeadDialog({ open, onOpenChange, card, onEdit, onDelete, onOpenWhatsApp }: ViewLeadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Detalhes do Lead</DialogTitle>
          <DialogDescription>
            Visualize todas as informações e histórico do lead
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
          <div className="grid gap-6 py-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">Informações do Contato</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium min-w-[100px]">Nome:</span>
                    <span className="text-muted-foreground">{card.contact?.name || 'Não informado'}</span>
                  </div>
                  {card.contact?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{card.contact.phone}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto h-7 text-xs"
                        onClick={onOpenWhatsApp}
                      >
                        <MessageCircle className="h-3 w-3 mr-1" />
                        Abrir WhatsApp
                      </Button>
                    </div>
                  )}
                  {card.contact?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{card.contact.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {card.contact?.tags && card.contact.tags.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {card.contact.tags.map((tag: any) => (
                        <Badge key={tag.id} variant="outline" style={{ backgroundColor: tag.color }}>
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <h3 className="text-sm font-semibold mb-3">Informações do Lead</h3>
                <div className="space-y-3 text-sm">
                  {card.title && (
                    <div>
                      <span className="font-medium">Título:</span>
                      <span className="text-muted-foreground ml-2">{card.title}</span>
                    </div>
                  )}
                  {(card.value !== null && card.value !== undefined) && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Valor:</span>
                      <span className="text-muted-foreground">
                        R$ {Number(card.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Criado em:</span>
                    <span className="text-muted-foreground">
                      {card.createdAt ? format(new Date(card.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {card.notes && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Anotações</h3>
                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md whitespace-pre-wrap">
                      {card.notes}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Linha do Tempo
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="relative flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <div className="h-full w-0.5 bg-border mt-1" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium">Lead criado</p>
                      <p className="text-xs text-muted-foreground">
                        {card.createdAt ? format(new Date(card.createdAt), "dd/MM/yyyy 'às' HH:mm") : 'N/A'}
                      </p>
                    </div>
                  </div>
                  {card.updatedAt && card.updatedAt !== card.createdAt && (
                    <div className="flex gap-3">
                      <div className="relative flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Última atualização</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(card.updatedAt), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:flex-1">
            Fechar
          </Button>
          {onDelete && (
            <Button
              variant="destructive"
              onClick={() => {
                onOpenChange(false);
                onDelete();
              }}
              className="sm:flex-1"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          )}
          {onEdit && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onEdit();
              }}
              className="sm:flex-1"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// AddMeetingTimeDialog
// ============================================================

interface AddMeetingTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: KanbanCard;
  onSave: (leadId: string, data: { notes?: string }) => Promise<void>;
}

export function AddMeetingTimeDialog({ open, onOpenChange, card, onSave }: AddMeetingTimeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [meetingDateTime, setMeetingDateTime] = useState('');
  const [result, setResult] = useState<{ success: boolean; meetLink?: string; calendarName?: string; error?: string } | null>(null);

  useEffect(() => {
    if (open) {
      setMeetingDateTime('');
      setResult(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!meetingDateTime) return;

    setLoading(true);
    setResult(null);
    try {
      // Try to create a real Google Calendar event
      const response = await fetch('/api/v1/kanban/schedule-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: card.id,
          meetingTime: new Date(meetingDateTime).toISOString(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Update lead notes with meeting info
        const meetDate = new Date(meetingDateTime);
        const dateStr = meetDate.toLocaleDateString('pt-BR');
        const timeStr = meetDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const meetInfo = data.meetLink ? ` | Meet: ${data.meetLink}` : '';
        const normalizedNote = `📅 Reunião agendada: ${dateStr} às ${timeStr}${meetInfo}`;

        const currentNotes = card.notes || '';
        let updatedNotes: string;
        if (/📅 Reunião agendada:/i.test(currentNotes)) {
          updatedNotes = currentNotes.replace(/📅 Reunião agendada:.*?(\n|$)/i, `${normalizedNote}\n`);
        } else {
          updatedNotes = currentNotes ? `${normalizedNote}\n\n${currentNotes}` : normalizedNote;
        }

        await onSave(card.id, { notes: updatedNotes.trim() });
        setResult({ success: true, meetLink: data.meetLink, calendarName: data.calendarName });
      } else {
        // Fallback: save as text note only
        const meetDate = new Date(meetingDateTime);
        const dateStr = meetDate.toLocaleDateString('pt-BR');
        const timeStr = meetDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const normalizedNote = `📅 Reunião agendada: ${dateStr} às ${timeStr} (manual)`;

        const currentNotes = card.notes || '';
        let updatedNotes: string;
        if (/📅 Reunião agendada:/i.test(currentNotes)) {
          updatedNotes = currentNotes.replace(/📅 Reunião agendada:.*?(\n|$)/i, `${normalizedNote}\n`);
        } else {
          updatedNotes = currentNotes ? `${normalizedNote}\n\n${currentNotes}` : normalizedNote;
        }

        await onSave(card.id, { notes: updatedNotes.trim() });
        setResult({ success: false, error: data.error || 'Calendário não disponível. Salvo como nota.' });
      }
    } catch (error) {
      console.error('Erro ao salvar horário da reunião:', error);
      setResult({ success: false, error: 'Erro ao conectar com o servidor.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agendar Reunião
          </DialogTitle>
          <DialogDescription>
            Agende uma reunião no Google Calendar com {card.contact?.name || 'este lead'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="meetingDateTime">Data e Horário</Label>
            <Input
              id="meetingDateTime"
              type="datetime-local"
              value={meetingDateTime}
              onChange={(e) => setMeetingDateTime(e.target.value)}
              autoFocus
            />
          </div>

          {result && (
            <div className={`p-3 rounded-lg border text-sm ${result.success
              ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
              }`}>
              {result.success ? (
                <div className="space-y-1">
                  <p className="font-medium">✅ Reunião criada no Google Calendar!</p>
                  {result.calendarName && <p className="text-xs">📆 {result.calendarName}</p>}
                  {result.meetLink && (
                    <a href={result.meetLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block">
                      🎥 {result.meetLink}
                    </a>
                  )}
                </div>
              ) : (
                <p>⚠️ {result.error}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {result?.success ? 'Fechar' : 'Cancelar'}
          </Button>
          {!result?.success && (
            <Button
              onClick={handleSave}
              disabled={!meetingDateTime || loading}
            >
              {loading ? 'Agendando...' : 'Agendar no Calendar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// CreateLeadDialog — Criar novo lead manualmente
// ============================================================

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  stages: KanbanStage[];
  onCreated: () => void;
}

const createLeadSchema = z.object({
  contactName: z.string().min(1, 'Nome é obrigatório').max(200),
  contactPhone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos').max(20),
  contactEmail: z.string().email('Email inválido').or(z.literal('')).optional(),
  title: z.string().max(100).optional(),
  value: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '' || (typeof val === 'number' && isNaN(val))) {
        return 0;
      }
      return Number(val);
    },
    z.number().min(0, 'Valor deve ser positivo').default(0)
  ),
  stageId: z.string().min(1, 'Selecione uma etapa'),
  notes: z.string().max(1000).optional(),
});

type CreateLeadFormData = z.infer<typeof createLeadSchema>;

export function CreateLeadDialog({ open, onOpenChange, boardId, stages, onCreated }: CreateLeadDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<CreateLeadFormData>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      title: '',
      value: 0,
      stageId: stages[0]?.id || '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        title: '',
        value: 0,
        stageId: stages[0]?.id || '',
        notes: '',
      });
      setError('');
    }
  }, [open, stages, form]);

  const handleSubmit = async (data: CreateLeadFormData) => {
    setLoading(true);
    setError('');
    try {
      // 1. Criar contato
      const contactRes = await fetch('/api/v1/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.contactName,
          phone: data.contactPhone,
          email: data.contactEmail || undefined,
        }),
      });

      let contactId: string;

      if (contactRes.ok) {
        const contactData = await contactRes.json();
        contactId = contactData.id;
      } else if (contactRes.status === 409) {
        // Contato já existe, usar o existente
        const existing = await contactRes.json();
        contactId = existing.existingContactId || existing.id;
        if (!contactId) {
          // Buscar pelo telefone
          const searchRes = await fetch(`/api/v1/contacts?search=${encodeURIComponent(data.contactPhone)}`);
          const searchData = await searchRes.json();
          const contacts = searchData.contacts || searchData;
          if (contacts.length > 0) {
            contactId = contacts[0].id;
          } else {
            throw new Error('Contato duplicado mas não encontrado.');
          }
        }
      } else {
        const errData = await contactRes.json();
        throw new Error(errData.error || 'Falha ao criar contato.');
      }

      // 2. Criar lead
      const leadRes = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId,
          stageId: data.stageId,
          contactId,
          value: data.value || 0,
        }),
      });

      if (!leadRes.ok) {
        const errData = await leadRes.json();
        throw new Error(errData.error || 'Falha ao criar lead.');
      }

      // 3. Se houver título ou notas personalizadas, atualizar o lead
      const leadData = await leadRes.json();
      if (data.title || data.notes) {
        await fetch(`/api/v1/leads/${leadData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: data.title || data.contactName,
            notes: data.notes || undefined,
          }),
        });
      }

      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Novo Lead
          </DialogTitle>
          <DialogDescription>
            Crie um novo lead manualmente no funil
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="max-h-[60vh] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
            <div className="grid gap-4 py-4">
              {/* Informações do Contato */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Informações do Contato
                </h4>
                <div className="grid gap-2">
                  <Label htmlFor="create-name">Nome *</Label>
                  <Input
                    id="create-name"
                    {...form.register('contactName')}
                    placeholder="Nome do contato"
                    autoFocus
                  />
                  {form.formState.errors.contactName && (
                    <p className="text-sm text-destructive">{form.formState.errors.contactName.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-phone">Telefone *</Label>
                  <Input
                    id="create-phone"
                    {...form.register('contactPhone')}
                    placeholder="+5511999999999"
                  />
                  {form.formState.errors.contactPhone && (
                    <p className="text-sm text-destructive">{form.formState.errors.contactPhone.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-email">Email</Label>
                  <Input
                    id="create-email"
                    type="email"
                    {...form.register('contactEmail')}
                    placeholder="email@exemplo.com"
                  />
                  {form.formState.errors.contactEmail && (
                    <p className="text-sm text-destructive">{form.formState.errors.contactEmail.message}</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Informações do Lead */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Informações do Lead
                </h4>
                <div className="grid gap-2">
                  <Label htmlFor="create-stage">Etapa *</Label>
                  <Select
                    value={form.watch('stageId')}
                    onValueChange={(val) => form.setValue('stageId', val)}
                  >
                    <SelectTrigger id="create-stage">
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.stageId && (
                    <p className="text-sm text-destructive">{form.formState.errors.stageId.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-title">Título do Lead</Label>
                  <Input
                    id="create-title"
                    {...form.register('title')}
                    placeholder="Deixe vazio para usar o nome"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-value">Valor (R$)</Label>
                  <Input
                    id="create-value"
                    type="number"
                    min="0"
                    step="0.01"
                    {...form.register('value', { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-notes">Anotações</Label>
                  <Textarea
                    id="create-notes"
                    rows={3}
                    {...form.register('notes')}
                    placeholder="Anotações sobre o lead..."
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/20 text-destructive text-sm">
                  ❌ {error}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
