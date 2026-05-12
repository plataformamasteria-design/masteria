'use client';

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarView } from "@/components/agenda/CalendarView";
import { EventList } from "@/components/agenda/EventList";
import { EventDialog } from "@/components/agenda/EventDialog";
import { TaskList } from "@/components/agenda/TaskList";
import { TaskDialog } from "@/components/agenda/TaskDialog";
import { BookingConfigDialog } from "@/components/agenda/BookingConfigDialog";
import { BookingShareDialog } from "@/components/agenda/BookingShareDialog";
import { CalendarTabs, Calendar } from "@/components/agenda/CalendarTabs";
import { Plus, ListTodo, Settings, Link2, Share2, Pencil, Trash2, RefreshCw, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import { CalendarDialog } from "@/components/agenda/CalendarDialog";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Event {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  allDay: boolean;
  color: string | null;
  assignedTo: string | null;
  contactId: string | null;
  calendarId?: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: string | null;
  completed: boolean | null;
  assignedTo: string | null;
  contactId: string | null;
}

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | undefined>();
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [bookingConfigOpen, setBookingConfigOpen] = useState(false);
  const [bookingShareOpen, setBookingShareOpen] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  
  const [googleConnected, setGoogleConnected] = useState(false);

  const { toast } = useToast();
  
  const { data: calendarsData, mutate: mutateCalendars } = useSWR('/api/v1/agenda/calendars', fetcher);
  const calendars: Calendar[] = calendarsData?.data || [];

  useEffect(() => {
    const fetchGoogleIntegration = async () => {
      try {
        const res = await fetch('/api/v1/integrations/google/calendars');
        const data = await res.json();
        setGoogleConnected(data.connected === true);
      } catch (e) {}
    };
    fetchGoogleIntegration();
  }, [bookingConfigOpen]); // refetch when config dialog closes

  const selectedCalendar = calendars.find(c => c.id === selectedCalendarId);
  const isGeneralCalendar = selectedCalendar?.isGeneral ?? true;

  const handleEventSaved = () => {
    setEventDialogOpen(false);
    setEditingEvent(undefined);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleTaskSaved = () => {
    setTaskDialogOpen(false);
    setEditingTask(undefined);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setEventDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const handleOpenLead = (contactId: string) => {
    setSelectedLeadId(contactId);
  };

  const handleCalendarsChange = () => {
    mutateCalendars();
    setRefreshTrigger(prev => prev + 1);
  };

  const handleShareCalendar = async () => {
    if (!selectedCalendar) return;
    // Pega o slug da organizacao ou usa o id
    const url = `${window.location.origin}/a/booking?c=${selectedCalendar.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: "O link de agendamento foi copiado" });
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* SIDEBAR DA AGENDA */}
      <div className="w-72 border-r border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 flex flex-col h-full overflow-y-auto hidden md:flex">
        <div className="p-6 pb-4 flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Minhas Agendas</h2>
          <p className="text-xs text-slate-500 font-medium">Controle de atendimentos</p>
        </div>
        
        <div className="px-3 mb-4">
          <CalendarTabs 
            calendars={calendars}
            selectedCalendarId={selectedCalendarId}
            onSelectCalendar={setSelectedCalendarId}
            onChange={handleCalendarsChange}
          />
        </div>

        <div className="p-4 mt-auto border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 space-y-3">
          {/* Integração Google em Destaque */}
          <div className="mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Integrações</h3>
            <div 
              onClick={() => setBookingConfigOpen(true)}
              className={`cursor-pointer rounded-xl p-3 border shadow-sm transition-all flex items-center justify-between ${googleConnected ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-white/10'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${googleConnected ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${googleConnected ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-700 dark:text-slate-300'}`}>Google Calendar</p>
                  <p className={`text-[10px] font-medium uppercase tracking-wider ${googleConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {googleConnected ? 'Sincronizado' : 'Não conectado'}
                  </p>
                </div>
              </div>
              {googleConnected && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            </div>
          </div>

          <Button variant="ghost" className="w-full justify-start text-slate-600 font-medium hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => setBookingConfigOpen(true)}>
            <Settings className="mr-3 h-4 w-4" />
            Configurações
          </Button>
          {selectedCalendarId && (
            <Button variant="ghost" className="w-full justify-start text-slate-600 font-medium hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => setBookingShareOpen(true)}>
              <Share2 className="mr-3 h-4 w-4" />
              Compartilhar Página
            </Button>
          )}
          {selectedCalendarId && (
            <Button variant="ghost" className="w-full justify-start text-slate-600 font-medium hover:bg-slate-100 dark:hover:bg-white/5" onClick={handleShareCalendar}>
              <Link2 className="mr-3 h-4 w-4" />
              Copiar Link Direto
            </Button>
          )}
        </div>
      </div>

      {/* AREA PRINCIPAL */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-200 dark:border-white/5 bg-white/50 backdrop-blur-md dark:bg-slate-900/50 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {selectedCalendar ? selectedCalendar.name : 'Visão Geral da Agenda'}
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Gerencie seus compromissos e tarefas</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="h-11 rounded-xl font-semibold border-slate-200 shadow-sm hover:bg-slate-50 text-slate-700" onClick={() => { setEditingTask(undefined); setTaskDialogOpen(true); }}>
              <ListTodo className="mr-2 h-4 w-4" /> Nova Tarefa
            </Button>
            <Button className="h-11 rounded-xl px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-wide shadow-lg shadow-blue-500/20 transition-all active:scale-95" onClick={() => { setEditingEvent(undefined); setEventDialogOpen(true); }}>
              <Plus className="mr-2 h-5 w-5" /> Agendar Horário
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-[1600px] mx-auto">
            {/* Main Calendar View */}
            <div className="lg:col-span-2 space-y-8">
              <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden ring-1 ring-slate-100 dark:ring-white/5">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-white/5 pb-4 px-6 pt-6">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-blue-500" /> Grade de Horários
                  </CardTitle>
                  <CardDescription className="font-medium text-slate-500">
                    Navegue pelas datas para visualizar seus agendamentos
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <CalendarView 
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                    refreshTrigger={refreshTrigger}
                    calendarId={selectedCalendarId}
                    isGeneralCalendar={isGeneralCalendar}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Side Panels (Events & Tasks) */}
            <div className="space-y-8">
              <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden ring-1 ring-slate-100 dark:ring-white/5">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-white/5 pb-4 px-6 pt-6">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <ListTodo className="w-5 h-5 text-emerald-500" /> Reuniões de Hoje
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <EventList 
                    selectedDate={selectedDate}
                    refreshTrigger={refreshTrigger}
                    calendarId={selectedCalendarId}
                    isGeneralCalendar={isGeneralCalendar}
                    onEditEvent={handleEditEvent as any}
                    onEditTask={handleEditTask as any}
                    onOpenLead={handleOpenLead}
                  />
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden ring-1 ring-slate-100 dark:ring-white/5">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-white/5 pb-4 px-6 pt-6">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-purple-500" /> Minhas Tarefas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <TaskList 
                    refreshTrigger={refreshTrigger}
                    onEditTask={handleEditTask as any}
                    onOpenLead={handleOpenLead}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <EventDialog 
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        event={editingEvent}
        selectedDate={selectedDate}
        calendars={calendars}
        calendarId={selectedCalendarId}
        onEventSaved={handleEventSaved}
        isGeneralCalendar={isGeneralCalendar}
      />

      <TaskDialog 
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask}
        onTaskSaved={handleTaskSaved}
      />

      <BookingConfigDialog
        open={bookingConfigOpen}
        onOpenChange={setBookingConfigOpen}
        selectedCalendarId={selectedCalendarId}
        calendars={calendars}
      />

      <BookingShareDialog
        open={bookingShareOpen}
        onOpenChange={setBookingShareOpen}
        selectedCalendarId={selectedCalendarId}
        calendars={calendars}
      />
    </div>
  );
}
