import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckSquare, User, MessageSquare, CheckCircle2, Clock } from "lucide-react";
import { EventDetailDialog } from "./EventDetailDialog";
import { useOrganization } from "@/contexts/OrganizationContext";

interface EventListProps {
  selectedDate: Date;
  refreshTrigger: number;
  onEditEvent: (event: Event) => void;
  onEditTask: (task: Task) => void;
  onOpenLead: (chatId: string) => void;
  calendarId?: string | null;
  isGeneralCalendar?: boolean;
}

interface CalendarInfo {
  id: string;
  name: string;
  color: string;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  all_day: boolean;
  color: string | null;
  synced_from_google: boolean;
  assigned_to: string | null;
  chat_id: string | null;
  calendar_id: string | null;
  calendar?: CalendarInfo | null;
  profiles?: {
    full_name: string | null;
  } | null;
  chats?: {
    wa_name: string | null;
    phone: string;
  } | null;
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
  profiles?: {
    full_name: string | null;
  } | null;
  chats?: {
    wa_name: string | null;
    phone: string;
  } | null;
}

export function EventList({ selectedDate, refreshTrigger, onEditEvent, onEditTask, onOpenLead, calendarId, isGeneralCalendar }: EventListProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Event | Task | null>(null);
  const [selectedType, setSelectedType] = useState<'event' | 'task'>('event');
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchDayData(true);
    }
  }, [selectedDate, currentOrganization?.id, calendarId, isGeneralCalendar]);

  useEffect(() => {
    if (currentOrganization?.id && refreshTrigger > 0) {
      // Mantido useEffect + fetch para evitar regressão na junção complexa de eventos, tarefas e calendários.
      // Refresh silencioso em background para nao piscar a tela
      fetchDayData(false);
    }
  }, [refreshTrigger, currentOrganization?.id]);

  const fetchDayData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);

      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch all calendars
      const calsRes = await fetch('/api/v1/agenda/calendars');
      const calsJson = await calsRes.json();
      const calendarsData = calsJson.data || [];

      const calendarsMap: Record<string, CalendarInfo> = {};
      calendarsData.forEach((cal: any) => {
        calendarsMap[cal.id] = { id: cal.id, name: cal.name, color: cal.color || '#3B82F6' };
      });

      // Fetch events
      let eventsUrl = `/api/v1/agenda/events?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}`;
      if (!isGeneralCalendar && calendarId) {
        eventsUrl += `&calendarId=${calendarId}`;
      }
      
      const eventsRes = await fetch(eventsUrl);
      const eventsJson = await eventsRes.json();
      const eventsData = eventsJson.data || [];

      // Fetch tasks for the selected day
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const tasksRes = await fetch(`/api/v1/agenda/tasks?date=${dateStr}`);
      const tasksJson = await tasksRes.json();
      const tasksData = tasksJson.data || [];

      // Map profiles, chats, and calendar info to events
      // (Mocking profiles/chats for now, they should be returned by API later)
      const enrichedEvents = eventsData.map((e: any) => ({
        ...e,
        start_time: e.startTime,
        end_time: e.endTime,
        all_day: e.allDay,
        chat_id: e.contactId,
        profiles: e.assignedToUser ? { full_name: e.assignedToUser.name } : null,
        chats: e.contact ? { wa_name: e.contact.name, phone: e.contact.phone } : null,
        calendar: e.calendarId ? calendarsMap[e.calendarId] : null,
      })) || [];

      const enrichedTasks = tasksData.map((t: any) => ({
        ...t,
        due_time: t.dueTime,
        due_date: t.dueDate,
        chat_id: t.contactId,
        profiles: t.assignedToUser ? { full_name: t.assignedToUser.name } : null,
        chats: t.contact ? { wa_name: t.contact.name, phone: t.contact.phone } : null,
      })) || [];

      setEvents(enrichedEvents);
      setTasks(enrichedTasks);
    } catch (error) {
      console.error('Error fetching day data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  const hasItems = events.length > 0 || tasks.length > 0;

  if (!hasItems) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum compromisso ou tarefa neste dia
      </div>
    );
  }

  const truncateText = (text: string | null, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  const handleOpenDetail = (item: Event | Task, type: 'event' | 'task') => {
    setSelectedItem(item);
    setSelectedType(type);
    setDetailDialogOpen(true);
  };

  const handleEditFromDetail = () => {
    setDetailDialogOpen(false);
    if (selectedType === 'event') {
      onEditEvent(selectedItem as Event);
    } else {
      onEditTask(selectedItem as Task);
    }
  };

  const handleDeleteFromDetail = () => {
    fetchDayData(); // Refresh the list
  };

  return (
    <>
      <ScrollArea className="h-full px-6">
        <div className="space-y-2 pb-2">
          {events.map((event) => {
            // Use calendar color instead of event color
            const displayColor = event.calendar?.color || event.color || '#3B82F6';

            return (
              <div
                key={event.id}
                onClick={() => handleOpenDetail(event, 'event')}
                className="group relative border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer bg-card hover:bg-accent/5"
                style={{ borderLeftWidth: '3px', borderLeftColor: displayColor }}
              >
                <div className="space-y-2">
                  {/* Header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Calendar className="h-3.5 w-3.5" style={{ color: displayColor }} />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: displayColor }}>
                      Compromisso
                    </span>
                    {event.all_day && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Dia inteiro</Badge>
                    )}
                    {/* Show calendar name in general view */}
                    {isGeneralCalendar && event.calendar && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1.5 border"
                        style={{ borderColor: displayColor, color: displayColor }}
                      >
                        {event.calendar.name}
                      </Badge>
                    )}
                  </div>

                  {/* Title */}
                  <h4 className="font-semibold text-sm leading-tight">{event.title}</h4>

                  {/* Time */}
                  {!event.all_day && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  {event.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {truncateText(event.description, 25)}
                    </p>
                  )}

                  {/* Assignments */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {event.profiles && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{truncateText(event.profiles.full_name, 15)}</span>
                      </div>
                    )}
                    {event.chats && (
                      <div className="flex items-center gap-1 text-primary">
                        <MessageSquare className="h-3 w-3" />
                        <span>{truncateText(event.chats.wa_name || event.chats.phone, 15)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => handleOpenDetail(task, 'task')}
              className="group relative border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer bg-orange-50/30 hover:bg-orange-50/50 border-l-orange-500"
              style={{ borderLeftWidth: '3px' }}
            >
              <div className="space-y-2">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Tarefa</span>
                  {task.completed && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  )}
                  {task.priority && (
                    <Badge
                      variant={
                        task.priority === 'high' ? 'destructive' :
                          task.priority === 'medium' ? 'default' :
                            'secondary'
                      }
                      className="text-[10px] h-4 px-1.5"
                    >
                      {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                    </Badge>
                  )}
                </div>

                {/* Title */}
                <h4 className={`font-semibold text-sm leading-tight ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </h4>

                {/* Due time */}
                {task.due_time && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{task.due_time}</span>
                  </div>
                )}

                {/* Description */}
                {task.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {truncateText(task.description, 25)}
                  </p>
                )}

                {/* Assignments */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {task.profiles && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{truncateText(task.profiles.full_name, 15)}</span>
                    </div>
                  )}
                  {task.chats && (
                    <div className="flex items-center gap-1 text-primary">
                      <MessageSquare className="h-3 w-3" />
                      <span>{truncateText(task.chats.wa_name || task.chats.phone, 15)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <EventDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        item={selectedItem}
        type={selectedType}
        onEdit={handleEditFromDetail}
        onDelete={handleDeleteFromDetail}
        onOpenLead={onOpenLead}
      />
    </>
  );
}
