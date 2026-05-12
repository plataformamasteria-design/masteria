import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { SearchableSelector } from "./SearchableSelector";
import { useOrganization } from "@/contexts/OrganizationContext";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarRange, Clock, Type, AlignLeft, MapPin, Video, MessageCircle, X, Check, Loader2 } from "lucide-react";

interface Calendar { id: string; name: string; is_general: boolean; color: string; }
interface Profile { id: string; full_name: string | null; email: string; }
interface Chat { id: string; wa_name: string | null; phone: string; }

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  event?: any;
  onEventSaved: () => void;
  calendarId?: string | null;
  isGeneralCalendar?: boolean;
  calendars?: Calendar[];
  defaultChatId?: string;
  defaultAssignedTo?: string;
  isRescheduling?: boolean;
}

export function EventDialog({ open, onOpenChange, selectedDate, event, onEventSaved, calendarId, isGeneralCalendar, calendars = [], defaultChatId, defaultAssignedTo, isRescheduling }: EventDialogProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Chat[]>([]);

  const [formData, setFormData] = useState({
    title: "", description: "", location: "", startTime: "", endTime: "",
    allDay: false, color: "#3B82F6", assignedTo: "", chatId: "", calendarId: "",
  });

  const [generateMeetLink, setGenerateMeetLink] = useState(true);
  const [notifyLead, setNotifyLead] = useState(true);

  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) { fetchUsers(); fetchLeads(); }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (!open) return;

    if (event) {
      setFormData({
        title: event.title, description: event.description || "", location: event.location || "",
        startTime: format(new Date(event.start_time), "yyyy-MM-dd'T'HH:mm"),
        endTime: format(new Date(event.end_time), "yyyy-MM-dd'T'HH:mm"),
        allDay: event.all_day, color: event.color || "#3B82F6", assignedTo: event.assigned_to || "",
        chatId: event.chat_id || "", calendarId: event.calendar_id || calendarId || "",
      });
      setGenerateMeetLink(event.location?.includes("meet") ?? false);
      setNotifyLead(true);
    } else {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      setFormData({
        title: "", description: "", location: "",
        startTime: `${dateStr}T09:00`, endTime: `${dateStr}T10:00`,
        allDay: false, color: "#3B82F6", assignedTo: defaultAssignedTo || "",
        chatId: defaultChatId || "", calendarId: calendarId || "",
      });
      setGenerateMeetLink(true);
      setNotifyLead(true);
    }
  }, [open, event?.id, selectedDate?.getTime(), calendarId, isGeneralCalendar, defaultChatId, defaultAssignedTo]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/users'); // Assuming this route exists
      const json = await res.json();
      if (json.data) setUsers(json.data);
    } catch(e) {}
  };

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/v1/contacts'); // Assuming this route exists
      const json = await res.json();
      if (json.data) setLeads(json.data.map((c: any) => ({ id: c.id, wa_name: c.name, phone: c.phone })));
    } catch(e) {}
  };

  const handleStartTimeChange = (newStartTime: string) => {
    let durationMs = 60 * 60 * 1000;
    if (formData.startTime && formData.endTime) {
      const ms = new Date(formData.endTime).getTime() - new Date(formData.startTime).getTime();
      if (ms > 0) durationMs = ms;
    }
    const nextStart = new Date(newStartTime).getTime();
    if (isNaN(nextStart)) { setFormData({ ...formData, startTime: newStartTime }); return; }
    const nextEnd = new Date(nextStart + durationMs);
    setFormData({ ...formData, startTime: newStartTime, endTime: format(nextEnd, "yyyy-MM-dd'T'HH:mm") });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isRescheduling && !formData.title.trim()) { toast({ title: "O título é obrigatório", variant: "destructive" }); return; }
    if (isRescheduling && !formData.description.trim()) { toast({ title: "O motivo é obrigatório", variant: "destructive" }); return; }
    if (!formData.allDay && formData.endTime <= formData.startTime) { toast({ title: "Término inválido", variant: "destructive" }); return; }

    try {
      setLoading(true);

      const baseStart = formData.allDay ? format(selectedDate, 'yyyy-MM-dd') + 'T00:00:00' : formData.startTime + ':00';
      const baseEnd = formData.allDay ? format(selectedDate, 'yyyy-MM-dd') + 'T23:59:59' : formData.endTime + ':00';

      let targetCalendarId = formData.calendarId || calendarId || null;
      if (isGeneralCalendar && !targetCalendarId) {
        const nonGeneralCal = calendars.filter(c => !c.is_general);
        if (nonGeneralCal.length > 0) targetCalendarId = nonGeneralCal[0].id;
      }

      const eventData = {
        title: formData.title.trim(), 
        description: formData.description?.trim() || null,
        location: formData.location?.trim() || null, 
        startTime: baseStart, // Enviamo local time sem 'Z'
        endTime: baseEnd, // Enviamo local time sem 'Z'
        allDay: formData.allDay, 
        color: formData.color,
        assignedTo: formData.assignedTo || null, 
        contactId: formData.chatId || null,
        calendarId: targetCalendarId,
        createMeetLink: generateMeetLink,
      };

      let finalEvId = event?.id;
      let meetLinkFromApi = undefined;

      if (event) {
        const res = await fetch(`/api/v1/agenda/events/${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData)
        });
        if (!res.ok) throw new Error("Erro");
        const json = await res.json();
        meetLinkFromApi = json.data?.location || null;
        toast({ title: "Sincronizando...", description: "Atualizando dados da reunião..." });
      } else {
        const res = await fetch(`/api/v1/agenda/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData)
        });
        if (!res.ok) throw new Error("Erro");
        const json = await res.json();
        finalEvId = json.data?.id;
        meetLinkFromApi = json.data?.location || null;
        toast({ title: "Criando Evento", description: "Reservando e sincronizando calendário..." });
      }

      if (finalEvId) {
        // Automate WhatsApp Notification
        const hasLinkedLead = formData.chatId && formData.chatId !== "";
        if (notifyLead && hasLinkedLead) {
          const datePart = format(new Date(eventData.startTime), "dd/MM/yyyy");
          const timePart = format(new Date(eventData.startTime), "HH:mm");

          let msgContent = `*${eventData.title}*\n${datePart} - ${timePart}\n\n`;

          let meetLinkToUse = meetLinkFromApi;
          if (!meetLinkToUse && eventData.location && eventData.location.includes("meet.google.com")) {
             meetLinkToUse = eventData.location;
          }

          if (meetLinkToUse && generateMeetLink) {
            msgContent += `${meetLinkToUse}\n\n`;
          } else if (eventData.location) {
            msgContent += `${eventData.location}\n\n`;
          }

          if (eventData.description && !isRescheduling) {
            msgContent += `_${eventData.description}_\n\n`;
          }

          if (isRescheduling) {
            msgContent = `⚠️ *Atenção! Remarcação: ${eventData.title}*\n${datePart} - ${timePart}\n\n`;
            if (meetLinkToUse && generateMeetLink) msgContent += `${meetLinkToUse}\n\n`;
            msgContent += `_Motivo da remarcação:_\n_${eventData.description}_\n\nCompromisso reagendado! E te espero lá!`;
          } else {
            msgContent += `Compromisso agendado! e te espero lá!`;
          }

          const { data: insertedMsg, error: insertError } = await supabase.from('messages').insert({
            chat_id: formData.chatId,
            organization_id: currentOrganization.id,
            content: msgContent,
            message_type: 'text',
            is_from_user: true,
            sent_from_platform: true
          }).select('id').single();

          if (!insertError && insertedMsg) {
            await supabase.functions.invoke('trigger-sent-webhooks', {
              body: { messageId: insertedMsg.id }
            });
          }

          toast({ title: "Sucesso!", description: "Evento cadastrado e link/confirmação enviados ao WhatsApp do Lead!" });
        } else {
          toast({ title: "Sucesso!", description: "Evento salvo na Agenda com sucesso." });
        }
      }

      onEventSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({ title: "Erro", description: error.message || "Falha ao salvar evento", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val && !loading) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-[700px] p-0 border-0 shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-slate-950">

        {/* Banner/Header */}
        <div className="relative pt-8 pb-6 px-8 bg-gradient-to-br from-indigo-50/80 to-blue-50/50 dark:from-indigo-950/20 dark:to-slate-900/50 border-b border-slate-100 dark:border-white/5">
          <button onClick={() => onOpenChange(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <CalendarRange className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {isRescheduling ? "Remarcar Evento" : event ? "Editar Evento" : "Nova Reunião / Tarefa"}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-slate-500 mt-0.5">
                Preencha os detalhes para bloquear sua agenda e notificar os envolvidos.
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">

          <div className="space-y-6">

            {/* Sec. 1: Basic Info */}
            <div className="space-y-5">
              {!isRescheduling && (
                <div className="relative">
                  <div className="absolute top-3 left-4 text-slate-400"><Type className="w-5 h-5" /></div>
                  <Input
                    value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Título do evento (Ex: Apresentação Comercial)..."
                    required autoFocus
                    className="pl-12 h-14 text-lg font-medium border-slate-200 bg-slate-50/50 dark:bg-black/20 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 rounded-2xl hover:border-slate-300 transition-colors shadow-sm"
                  />
                </div>
              )}
              <div className="relative">
                <div className="absolute top-3.5 left-4 text-slate-400"><AlignLeft className="w-5 h-5" /></div>
                <Textarea
                  value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={isRescheduling ? "Motivo da remarcação (Será enviado ao lead)..." : "Detalhes da reunião, briefing longo, ou anotações internas..."}
                  rows={isRescheduling ? 4 : 3}
                  className="pl-12 py-3.5 min-h-14 font-medium border-slate-200 bg-slate-50/50 dark:bg-black/20 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 rounded-2xl hover:border-slate-300 transition-colors shadow-sm resize-none custom-scrollbar"
                />
              </div>
            </div>

            {/* Sec. 2: Auto-Actions (Meet + WhatsApp) Bento */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Meet Card */}
              <motion.div whileTap={{ scale: 0.98 }} onClick={() => setGenerateMeetLink(!generateMeetLink)} className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-start gap-4 ${generateMeetLink ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500 shadow-sm shadow-blue-500/10' : 'bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 hover:border-slate-300'}`}>
                <div className={`p-2 rounded-xl transition-colors ${generateMeetLink ? 'bg-blue-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                  <Video className="w-5 h-5" />
                </div>
                <div className="flex-1 mt-0.5">
                  <h4 className={`text-sm font-bold ${generateMeetLink ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>Vídeo do Meet</h4>
                  <p className="text-xs font-medium text-slate-500 mt-0.5 leading-tight">Gera e anexa o link automaticamente</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${generateMeetLink ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
                  {generateMeetLink && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                </div>
              </motion.div>

              {/* WhatsApp Send Card */}
              <motion.div whileTap={{ scale: 0.98 }} onClick={() => setNotifyLead(!notifyLead)} className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-start gap-4 ${notifyLead ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 shadow-sm shadow-emerald-500/10' : 'bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 hover:border-slate-300'}`}>
                <div className={`p-2 rounded-xl transition-colors ${notifyLead ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 mt-0.5">
                  <h4 className={`text-sm font-bold ${notifyLead ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-700 dark:text-slate-300'}`}>Avisar no WhatsApp</h4>
                  <p className="text-xs font-medium text-slate-500 mt-0.5 leading-tight">Dispara convite limpo para o Lead</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${notifyLead ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                  {notifyLead && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                </div>
              </motion.div>
            </div>

            {/* Sec. 3: Timing & Links (The Grid) */}
            <div className="p-5 bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-2xl space-y-5 shadow-sm">

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Início</label>
                  <div className="relative">
                    <div className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400"><Clock className="w-4 h-4" /></div>
                    <Input type="datetime-local" value={formData.startTime} onChange={(e) => handleStartTimeChange(e.target.value)} disabled={formData.allDay} required className="pl-10 h-11 bg-white dark:bg-black/50 border-slate-200 dark:border-white/10 rounded-xl shadow-sm text-sm font-medium" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center pr-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Término</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">O Dia Todo</span>
                      <Switch checked={formData.allDay} onCheckedChange={(v) => setFormData({ ...formData, allDay: v })} className="scale-75 origin-right" />
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400"><Clock className="w-4 h-4" /></div>
                    <Input type="datetime-local" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} disabled={formData.allDay} required className="pl-10 h-11 bg-white dark:bg-black/50 border-slate-200 dark:border-white/10 rounded-xl shadow-sm text-sm font-medium" />
                  </div>
                </div>
              </div>

              {!isRescheduling && !generateMeetLink && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Endereço Físico ou URL</label>
                  <div className="relative">
                    <div className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400"><MapPin className="w-4 h-4" /></div>
                    <Input
                      value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Ex: Avenida Paulista, 1000 ou link do Zoom..."
                      className="pl-10 h-11 bg-white dark:bg-black/50 border-slate-200 dark:border-white/10 rounded-xl shadow-sm font-medium"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sec. 4: Assignments */}
            {!isRescheduling && (
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5 px-1">
                <SearchableSelector label="Agente Responsável" placeholder="Buscar..." items={users.map(u => ({ id: u.id, name: u.full_name || u.email, subtitle: u.email }))} value={formData.assignedTo} onChange={(v) => setFormData({ ...formData, assignedTo: v })} emptyMessage="Vazio" />
                <SearchableSelector label="Lead Vinculado" placeholder="Buscar Lead..." items={leads.map(l => ({ id: l.id, name: l.wa_name || l.phone, subtitle: l.phone }))} value={formData.chatId} onChange={(v) => setFormData({ ...formData, chatId: v })} emptyMessage="Vazio" />

                {calendars.length > 1 && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 flex">Agenda Base</label>
                    <Select value={formData.calendarId || ""} onValueChange={(v) => setFormData({ ...formData, calendarId: v })}>
                      <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-black/20 shadow-sm border-slate-200 font-medium">
                        <SelectValue placeholder="Selecione a agenda" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {calendars.filter(c => !c.is_general).map(c => (
                          <SelectItem key={c.id} value={c.id} className="rounded-lg cursor-pointer">
                            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: c.color }} />{c.name}</div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Tag/Cor</label>
                  <Input type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="h-11 w-full rounded-xl cursor-pointer p-1.5 shadow-sm bg-white dark:bg-black/20 border-slate-200" />
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 pb-2 border-t border-slate-100 dark:border-white/5 flex gap-3 justify-end sticky bottom-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading} className="rounded-xl px-6 font-semibold hover:bg-slate-100 h-11"> Cancelar </Button>
            <Button type="submit" disabled={loading} className="rounded-xl px-8 shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white h-11 font-bold tracking-wide active:scale-95 transition-all w-1/2 sm:w-auto">
              {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Mágica Acontecendo...</> : (isRescheduling ? "Confirmar Remarcação" : event ? "Atualizar Evento" : "Salvar na Agenda!")}
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}
