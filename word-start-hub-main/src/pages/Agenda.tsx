import { useState, useEffect } from "react";
import PagePermissionGuard from "@/components/PagePermissionGuard";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarView } from "@/components/agenda/CalendarView";
import { EventList } from "@/components/agenda/EventList";
import { EventDialog } from "@/components/agenda/EventDialog";
import { TaskList } from "@/components/agenda/TaskList";
import { TaskDialog } from "@/components/agenda/TaskDialog";
import LeadDetailDialog from "@/components/leads/LeadDetailDialog";
import { BookingConfigDialog } from "@/components/agenda/BookingConfigDialog";
import { BookingShareDialog } from "@/components/agenda/BookingShareDialog";
import { CalendarTabs, Calendar } from "@/components/agenda/CalendarTabs";
import { Plus, ListTodo, Settings, Link2, Share2, Pencil, Trash2, RefreshCw } from "lucide-react";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { CalendarDialog } from "@/components/agenda/CalendarDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface Event {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  all_day: boolean;
  color: string | null;
  assigned_to: string | null;
  chat_id: string | null;
  calendar_id?: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: string | null;
  completed: boolean | null;
  assigned_to: string | null;
  chat_id: string | null;
}

export default function Agenda() {
  const { canUseAgendaWidget } = useModuleAccess();
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
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const [editCalendarDialogOpen, setEditCalendarDialogOpen] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<Calendar | undefined>();
  const [deleteCalendar, setDeleteCalendar] = useState<Calendar | undefined>();
  const [isSyncing, setIsSyncing] = useState(false);
  // Fetch calendars to determine if selected is general
  useEffect(() => {
    if (currentOrganization?.id) {
      fetchCalendars();
    }
  }, [currentOrganization?.id]);

  const fetchCalendars = async () => {
    if (!currentOrganization?.id) return;

    const { data } = await supabase
      .from('calendars')
      .select('id, name, is_general, color, order_position')
      .eq('organization_id', currentOrganization.id)
      .order('order_position');

    if (data) {
      setCalendars(data);
    }
  };

  const selectedCalendar = calendars.find(c => c.id === selectedCalendarId);
  const isGeneralCalendar = selectedCalendar?.is_general ?? true;

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

  const handleOpenLead = (chatId: string) => {
    setSelectedLeadId(chatId);
  };

  const handleCalendarsChange = () => {
    fetchCalendars();
    setRefreshTrigger(prev => prev + 1);
  };

  const handleShareCalendar = async () => {
    if (!selectedCalendar || !currentOrganization?.id) return;
    const { data } = await (supabase as any)
      .from('organizations')
      .select('slug')
      .eq('id', currentOrganization.id)
      .single();
    if (data?.slug) {
      const url = `${window.location.origin}/a/${data.slug}?c=${selectedCalendar.id}`;
      navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!", description: "O link de agendamento foi copiado" });
    }
  };

  const handleDeleteSelectedCalendar = async () => {
    if (!deleteCalendar) return;
    try {
      await supabase.from('calendar_events').update({ calendar_id: null }).eq('calendar_id', deleteCalendar.id);
      const { error } = await supabase.from('calendars').delete().eq('id', deleteCalendar.id);
      if (error) throw error;
      toast({ title: "Agenda excluída" });
      const general = calendars.find(c => c.is_general);
      setSelectedCalendarId(general?.id || null);
      setDeleteCalendar(undefined);
      handleCalendarsChange();
    } catch {
      toast({ title: "Erro", description: "Falha ao excluir agenda", variant: "destructive" });
    }
  };

  const handleSyncWithGoogle = async () => {
    if (!currentOrganization?.id) return;
    setIsSyncing(true);
    try {
      // Refresh session to ensure a valid JWT
      await supabase.auth.refreshSession();
      const sessionData = await supabase.auth.getSession();
      const session = sessionData.data.session;
      if (!session?.user) throw new Error("Usuário não autenticado.");

      let data: any = null;
      let fnError: any = null;

      // First attempt via SDK
      const result = await supabase.functions.invoke('google-calendar-api', {
        headers: { Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
        body: { action: 'sync_all', organization_id: currentOrganization.id, user_id: session.user.id }
      });
      fnError = result.error;
      data = result.data;

      // If SDK returns non-2xx (stale JWT), retry with direct fetch using anon key
      if (fnError) {
        console.warn('SDK invoke failed, retrying with direct fetch:', fnError);

        const authToken = SUPABASE_PUBLISHABLE_KEY;

        const res = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-api`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({ action: 'sync_all', organization_id: currentOrganization.id, user_id: session.user.id })
        });

        if (!res.ok) {
          throw new Error(`Erro HTTP ${res.status}: ${res.statusText}`);
        }
        data = await res.json();
        fnError = null;
      }

      if (fnError) throw fnError;

      // Parse data - could be string or object
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed?.error) throw new Error(parsed.error);

      const errors = parsed?.errors || 0;
      toast({
        title: errors > 0 ? "Sincronização com Erros" : "Sincronização Concluída",
        description: `${parsed?.pulled || 0} eventos puxados do Google — ${parsed?.inserted || 0} importados, ${parsed?.updated || 0} atualizados${errors > 0 ? `, ${errors} erros` : ''}`,
        variant: errors > 0 ? "destructive" : "default",
      });
      setRefreshTrigger(prev => prev + 1);
    } catch (e: any) {
      console.error("Sync error:", e);
      toast({
        title: "Erro na Sincronização",
        description: e.message || "Falha ao sincronizar com Google. Verifique se o Google Calendar foi conectado na tela de Ecossistema.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <PagePermissionGuard page="agenda">
      <AppShell>
        <div className="space-y-4 md:space-y-6">
          {/* Header responsivo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-3xl font-bold tracking-tight">
                {selectedCalendar && !selectedCalendar.is_general
                  ? `Agenda de ${selectedCalendar.name}`
                  : 'Agenda'}
              </h1>
              <p className="text-muted-foreground text-sm">
                Compromissos e tarefas
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Per-calendar actions - only for non-general */}
              {selectedCalendar && !selectedCalendar.is_general && (
                <>
                  {canUseAgendaWidget && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleShareCalendar}>
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copiar link de agendamento</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => {
                          setEditingCalendar(selectedCalendar);
                          setEditCalendarDialogOpen(true);
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Editar agenda</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => setDeleteCalendar(selectedCalendar)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Excluir agenda</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
              {canUseAgendaWidget && (
                <>
                  <Button variant="outline" onClick={() => setBookingShareOpen(true)} size="sm">
                    <Link2 className="h-4 w-4 mr-2" />
                    Link e Widget
                  </Button>
                  <Button variant="outline" onClick={() => setBookingConfigOpen(true)} size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar
                  </Button>
                </>
              )}
              <Button onClick={handleSyncWithGoogle} disabled={isSyncing} variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Buscando...' : 'Sincronizar'}
              </Button>
              <Button onClick={() => setEventDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo Evento
              </Button>
            </div>
          </div>

          {/* Calendar Tabs */}
          <CalendarTabs
            selectedCalendarId={selectedCalendarId}
            onSelectCalendar={setSelectedCalendarId}
            onCalendarsChange={handleCalendarsChange}
          />

          {/* Calendário e Lista de Eventos - responsivo */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:h-[600px]">
            {/* Visualização do Calendário */}
            <Card className="lg:col-span-2 flex flex-col">
              <CardHeader className="flex-shrink-0 p-4 md:p-6">
                <CardTitle className="text-lg md:text-xl">Calendário</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {isGeneralCalendar
                    ? "Visualizando eventos de todas as agendas"
                    : "Clique em um dia para ver os eventos"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-6 flex-1 overflow-auto">
                <CalendarView
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  refreshTrigger={refreshTrigger}
                  calendarId={selectedCalendarId}
                  isGeneralCalendar={isGeneralCalendar}
                />
              </CardContent>
            </Card>

            {/* Lista de Eventos do Dia */}
            <Card className="flex flex-col min-h-[300px] lg:min-h-0">
              <CardHeader className="flex-shrink-0 p-4 md:p-6">
                <CardTitle className="text-base md:text-lg">
                  {selectedDate.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </CardTitle>
                <CardDescription className="text-xs">Eventos do dia</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0 pt-2">
                <EventList
                  selectedDate={selectedDate}
                  refreshTrigger={refreshTrigger}
                  onEditEvent={handleEditEvent}
                  onEditTask={handleEditTask}
                  onOpenLead={handleOpenLead}
                  calendarId={selectedCalendarId}
                  isGeneralCalendar={isGeneralCalendar}
                />
              </CardContent>
            </Card>
          </div>

          {/* Seção de Tarefas */}
          <Card>
            <CardHeader className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg md:text-xl">Tarefas</CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Gerencie tarefas e prazos
                  </CardDescription>
                </div>
                <Button onClick={() => setTaskDialogOpen(true)} size="sm" className="w-fit">
                  <ListTodo className="h-4 w-4 mr-2" />
                  Nova Tarefa
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <TaskList
                refreshTrigger={refreshTrigger}
                onEditTask={handleEditTask}
                onOpenLead={handleOpenLead}
              />
            </CardContent>
          </Card>
        </div>

        {/* Dialogs */}
        <EventDialog
          open={eventDialogOpen}
          onOpenChange={(open) => {
            setEventDialogOpen(open);
            if (!open) setEditingEvent(undefined);
          }}
          selectedDate={selectedDate}
          event={editingEvent}
          onEventSaved={handleEventSaved}
          calendarId={selectedCalendarId}
          isGeneralCalendar={isGeneralCalendar}
          calendars={calendars}
        />

        <TaskDialog
          open={taskDialogOpen}
          onOpenChange={(open) => {
            setTaskDialogOpen(open);
            if (!open) setEditingTask(undefined);
          }}
          task={editingTask}
          onTaskSaved={handleTaskSaved}
        />

        {selectedLeadId && (
          <LeadDetailDialog
            chatId={selectedLeadId}
            open={!!selectedLeadId}
            onOpenChange={(open) => !open && setSelectedLeadId(undefined)}
          />
        )}

        <BookingConfigDialog
          open={bookingConfigOpen}
          onOpenChange={setBookingConfigOpen}
        />

        <BookingShareDialog
          open={bookingShareOpen}
          onOpenChange={setBookingShareOpen}
          calendars={calendars}
          selectedCalendarId={selectedCalendarId}
        />

        <CalendarDialog
          open={editCalendarDialogOpen}
          onOpenChange={setEditCalendarDialogOpen}
          calendar={editingCalendar}
          onSaved={() => {
            setEditCalendarDialogOpen(false);
            setEditingCalendar(undefined);
            handleCalendarsChange();
          }}
        />

        <AlertDialog open={!!deleteCalendar} onOpenChange={(open) => !open && setDeleteCalendar(undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir agenda "{deleteCalendar?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Os eventos desta agenda serão mantidos mas sem vínculo a uma agenda específica.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSelectedCalendar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AppShell>
    </PagePermissionGuard>
  );
}
