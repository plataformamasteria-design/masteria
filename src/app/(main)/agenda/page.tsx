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
import { Plus, ListTodo, Settings, Link2, Share2, Pencil, Trash2, RefreshCw } from "lucide-react";
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
  
  const { toast } = useToast();
  
  const { data: calendarsData, mutate: mutateCalendars } = useSWR('/api/v1/agenda/calendars', fetcher);
  const calendars: Calendar[] = calendarsData?.data || [];

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
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* SIDEBAR DA AGENDA */}
      <div className="w-64 border-r bg-white flex flex-col h-full overflow-y-auto hidden md:flex">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Agendas</h2>
        </div>
        
        <CalendarTabs 
          calendars={calendars}
          selectedCalendarId={selectedCalendarId}
          onSelectCalendar={setSelectedCalendarId}
          onChange={handleCalendarsChange}
        />

        <div className="p-4 border-t mt-auto space-y-2">
          <Button variant="outline" className="w-full justify-start" onClick={() => setBookingConfigOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Config. Agendamento
          </Button>
          {selectedCalendarId && (
            <Button variant="outline" className="w-full justify-start" onClick={() => setBookingShareOpen(true)}>
              <Share2 className="mr-2 h-4 w-4" />
              Compartilhar Agenda
            </Button>
          )}
          {selectedCalendarId && (
            <Button variant="outline" className="w-full justify-start" onClick={handleShareCalendar}>
              <Link2 className="mr-2 h-4 w-4" />
              Copiar Link
            </Button>
          )}
        </div>
      </div>

      {/* AREA PRINCIPAL */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-white">
          <div className="flex gap-2">
            <Button onClick={() => { setEditingEvent(undefined); setEventDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Novo Evento
            </Button>
            <Button variant="outline" onClick={() => { setEditingTask(undefined); setTaskDialogOpen(true); }}>
              <ListTodo className="mr-2 h-4 w-4" /> Nova Tarefa
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-4 bg-slate-50">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Calendário</CardTitle>
                  <CardDescription>
                    {selectedCalendar ? `Mostrando eventos de: ${selectedCalendar.name}` : 'Mostrando todos os eventos'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
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

            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Eventos do Dia</CardTitle>
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

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Tarefas</CardTitle>
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
