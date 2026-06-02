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

  useEffect(() => {
    // Polling a cada 5 segundos para sincronizar o calendario e eventos
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-transparent relative z-[1]">


      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* HEADER PRINCIPAL */}
        <div className="px-8 py-5 border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 backdrop-blur-xl flex justify-between items-center sticky top-0 z-10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground drop-shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              {selectedCalendar ? selectedCalendar.name : 'Visão Geral da Agenda'}
            </h1>
            <p className="text-sm font-medium text-muted-foreground mt-1">Gerencie seus compromissos e tarefas</p>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" className="h-11 rounded-2xl font-semibold border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:border-black/20 dark:hover:border-white/20 text-zinc-600 dark:text-zinc-300 hover:text-foreground dark:hover:text-white transition-all shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" onClick={() => { setEditingTask(undefined); setTaskDialogOpen(true); }}>
              <ListTodo className="mr-2 h-4 w-4" /> Nova Tarefa
            </Button>
            <Button className="h-11 rounded-2xl px-6 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 font-bold tracking-wide transition-all active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_25px_rgba(16,185,129,0.2)]" onClick={() => { setEditingEvent(undefined); setEventDialogOpen(true); }}>
              <Plus className="mr-2 h-5 w-5 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> Agendar Horário
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 relative z-0">
          <div className="max-w-[1600px] mx-auto space-y-8">
            
            {/* ROW 1: MINHAS AGENDAS */}
            <Card className="glass-card rounded-[2rem] overflow-hidden">
              <div className="p-6 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-xl font-bold tracking-tight text-foreground dark:text-white">Minhas Agendas</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <div 
                      onClick={() => setBookingConfigOpen(true)}
                      className={`cursor-pointer rounded-xl px-3 py-2 border shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all flex items-center gap-2 ${googleConnected ? 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/20 text-emerald-400' : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-foreground dark:hover:text-white'}`}
                      title={googleConnected ? 'Google Calendar Sincronizado' : 'Conectar Google Calendar'}
                    >
                      <CalendarIcon className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">{googleConnected ? 'Sincronizado' : 'Google Calendar'}</span>
                      {googleConnected && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    </div>

                    {googleConnected && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-9 px-3 font-medium text-zinc-600 dark:text-zinc-400 border border-black/5 dark:border-white/5 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:text-foreground dark:hover:text-white rounded-xl" 
                        onClick={() => setRefreshTrigger(prev => prev + 1)}
                        title="Sincronizar Manualmente"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}

                    <Button variant="ghost" size="sm" className="h-9 px-3 text-zinc-600 dark:text-zinc-400 font-medium border border-black/5 dark:border-white/5 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:text-foreground dark:hover:text-white rounded-xl" onClick={() => setBookingConfigOpen(true)}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configurações
                    </Button>
                    {selectedCalendarId && (
                      <Button variant="ghost" size="sm" className="h-9 px-3 text-zinc-600 dark:text-zinc-400 font-medium border border-black/5 dark:border-white/5 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:text-foreground dark:hover:text-white rounded-xl" onClick={() => setBookingShareOpen(true)}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Compartilhar
                      </Button>
                    )}
                    {selectedCalendarId && (
                      <Button variant="ghost" size="sm" className="h-9 px-3 text-zinc-600 dark:text-zinc-400 font-medium border border-black/5 dark:border-white/5 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:text-foreground dark:hover:text-white rounded-xl" onClick={handleShareCalendar}>
                        <Link2 className="mr-2 h-4 w-4" />
                        Copiar Link
                      </Button>
                    )}
                  </div>
                </div>
                <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                  <CalendarTabs 
                    calendars={calendars}
                    selectedCalendarId={selectedCalendarId}
                    onSelectCalendar={setSelectedCalendarId}
                    onChange={handleCalendarsChange}
                  />
                </div>
              </div>
            </Card>

            {/* ROW 2: CALENDAR AND MEETINGS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card className="glass-card rounded-[2rem] overflow-hidden">
                  <CardHeader className="bg-black/5 dark:bg-black/20 border-b border-black/5 dark:border-white/5 pb-4 px-6 pt-6">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                      <CalendarIcon className="w-5 h-5 text-emerald-400 saturate-200 drop-shadow-[0_0_10px_rgba(16,185,129,0.6)]" /> Grade de Horários
                    </CardTitle>
                    <CardDescription className="font-medium text-zinc-400">
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

              <div className="lg:col-span-1">
                <Card className="glass-card rounded-[2rem] overflow-hidden h-full flex flex-col">
                  <CardHeader className="bg-black/5 dark:bg-black/20 border-b border-black/5 dark:border-white/5 pb-4 px-6 pt-6 shrink-0">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                      <ListTodo className="w-5 h-5 text-emerald-400 saturate-200 drop-shadow-[0_0_10px_rgba(16,185,129,0.6)]" /> Reuniões de Hoje
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-hidden min-h-[400px]">
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
              </div>
            </div>

            {/* ROW 3: MINHAS TAREFAS */}
            <div className="w-full">
              <Card className="glass-card rounded-[2rem] overflow-hidden">
                <CardHeader className="bg-black/5 dark:bg-black/20 border-b border-black/5 dark:border-white/5 pb-4 px-6 pt-6">
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="w-5 h-5 text-indigo-400 saturate-200 drop-shadow-[0_0_10px_rgba(129,140,248,0.6)]" /> Minhas Tarefas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 p-6">
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
