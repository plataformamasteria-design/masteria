import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckSquare, User, MessageSquare, CheckCircle2, Clock } from "lucide-react";
import { EventDetailDialog } from "./EventDetailDialog";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useGhlMappings } from "@/hooks/use-ghl-mappings";
import { GhlBadge } from "@/components/ui/ghl-badge";

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
  const { getGhlId } = useGhlMappings();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchDayData();
    }
  }, [selectedDate, refreshTrigger, currentOrganization?.id, calendarId, isGeneralCalendar]);

  const fetchDayData = async () => {
    try {
      setLoading(true);

      if (!currentOrganization?.id) return;

      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch all calendars to get their colors and names
      const { data: calendarsData } = await supabase
        .from('calendars')
        .select('id, name, color')
        .eq('organization_id', currentOrganization.id);

      const calendarsMap: Record<string, CalendarInfo> = {};
      calendarsData?.forEach(cal => {
        calendarsMap[cal.id] = { id: cal.id, name: cal.name, color: cal.color || '#3B82F6' };
      });

      // Fetch events - filter by calendar if not general
      let eventsQuery = supabase
        .from('calendar_events')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      // If not general calendar, filter by specific calendar
      if (!isGeneralCalendar && calendarId) {
        eventsQuery = eventsQuery.eq('calendar_id', calendarId);
      }

      const { data: eventsData, error: eventsError } = await eventsQuery;

      if (eventsError) throw eventsError;

      // Fetch profiles and chats separately for events
      const eventUserIds = [...new Set(eventsData?.map(e => e.assigned_to).filter(Boolean))];
      const eventChatIds = [...new Set(eventsData?.map(e => e.chat_id).filter(Boolean))];

      const profiles: Record<string, { full_name: string | null }> = {};
      const chats: Record<string, { wa_name: string | null; phone: string }> = {};

      if (eventUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', eventUserIds);
        profilesData?.forEach(p => profiles[p.id] = { full_name: p.full_name });
      }

      if (eventChatIds.length > 0) {
        const { data: chatsData } = await supabase
          .from('chats')
          .select('id, wa_name, phone')
          .in('id', eventChatIds);
        chatsData?.forEach(c => chats[c.id] = { wa_name: c.wa_name, phone: c.phone });
      }

      // Fetch tasks for the selected day
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('due_date', dateStr)
        .order('due_time', { ascending: true, nullsFirst: false });

      if (tasksError) throw tasksError;

      // Fetch profiles and chats for tasks
      const taskUserIds = [...new Set(tasksData?.map(t => t.assigned_to).filter(Boolean))];
      const taskChatIds = [...new Set(tasksData?.map(t => t.chat_id).filter(Boolean))];

      if (taskUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', taskUserIds);
        profilesData?.forEach(p => profiles[p.id] = { full_name: p.full_name });
      }

      if (taskChatIds.length > 0) {
        const { data: chatsData } = await supabase
          .from('chats')
          .select('id, wa_name, phone')
          .in('id', taskChatIds);
        chatsData?.forEach(c => chats[c.id] = { wa_name: c.wa_name, phone: c.phone });
      }

      // Map profiles, chats, and calendar info to events
      const enrichedEvents = eventsData?.map(e => ({
        ...e,
        profiles: e.assigned_to ? profiles[e.assigned_to] : null,
        chats: e.chat_id ? chats[e.chat_id] : null,
        calendar: e.calendar_id ? calendarsMap[e.calendar_id] : null,
      })) || [];

      const enrichedTasks = tasksData?.map(t => ({
        ...t,
        profiles: t.assigned_to ? profiles[t.assigned_to] : null,
        chats: t.chat_id ? chats[t.chat_id] : null,
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
                    {event.chat_id && getGhlId(event.chat_id, "contact") && (
                      <GhlBadge ghlId={getGhlId(event.chat_id, "contact")} showText={false} className="h-4" />
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
                  {task.chat_id && getGhlId(task.chat_id, "contact") && (
                    <GhlBadge ghlId={getGhlId(task.chat_id, "contact")} showText={false} className="h-4" />
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
