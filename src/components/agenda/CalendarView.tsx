import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { isSameDay, parseISO, format, startOfMonth, endOfMonth, subDays, addDays } from "date-fns";
import { useOrganization } from "@/contexts/OrganizationContext";

interface CalendarViewProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  refreshTrigger: number;
  calendarId?: string | null;
  isGeneralCalendar?: boolean;
}

interface CalendarInfo {
  id: string;
  color: string;
}

interface CalendarEvent {
  id: string;
  start_time: string;
  end_time: string;
  title: string;
  calendar_id: string | null;
}

interface Task {
  id: string;
  due_date: string | null;
  due_time: string | null;
  title: string;
  completed: boolean | null;
}

export function CalendarView({ selectedDate, onSelectDate, refreshTrigger, calendarId, isGeneralCalendar }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarsMap, setCalendarsMap] = useState<Record<string, CalendarInfo>>({});
  const [selectedCalendarColor, setSelectedCalendarColor] = useState<string>('#3B82F6');
  const [loading, setLoading] = useState(false);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchData(true);
    }
  }, [currentOrganization?.id, calendarId, isGeneralCalendar, selectedDate]);

  useEffect(() => {
    if (currentOrganization?.id && refreshTrigger > 0) {
      // Mantido useEffect + fetch para evitar regressão na junção complexa de dados
      fetchData(false);
    }
  }, [refreshTrigger, currentOrganization?.id]);

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      
      const monthStart = subDays(startOfMonth(selectedDate), 7);
      const monthEnd = addDays(endOfMonth(selectedDate), 7);

      // Fetch all calendars
      const calsRes = await fetch('/api/v1/agenda/calendars');
      const calsJson = await calsRes.json();
      const calendarsData = calsJson.data || [];

      const calMap: Record<string, CalendarInfo> = {};
      calendarsData.forEach((cal: any) => {
        calMap[cal.id] = { id: cal.id, color: cal.color || '#3B82F6' };
      });
      setCalendarsMap(calMap);

      if (calendarId && calMap[calendarId]) {
        setSelectedCalendarColor(calMap[calendarId].color);
      }

      // Fetch events
      let eventsUrl = `/api/v1/agenda/events?start=${monthStart.toISOString()}&end=${monthEnd.toISOString()}`;
      if (!isGeneralCalendar && calendarId) {
        eventsUrl += `&calendarId=${calendarId}`;
      }

      const eventsRes = await fetch(eventsUrl);
      const eventsJson = await eventsRes.json();
      const eventsData = eventsJson.data || [];
      
      // Fetch tasks 
      const startStr = format(monthStart, 'yyyy-MM-dd');
      const endStr = format(monthEnd, 'yyyy-MM-dd');
      const tasksRes = await fetch(`/api/v1/agenda/tasks?start=${startStr}&end=${endStr}`);
      const tasksJson = await tasksRes.json();
      const tasksData = tasksJson.data || [];

      // map properties
      const mappedEvents = eventsData.map((e: any) => ({
         ...e,
         start_time: e.startTime,
         end_time: e.endTime,
         calendar_id: e.calendarId
      }));

      const mappedTasks = tasksData.map((t: any) => ({
         ...t,
         due_date: t.dueDate,
         due_time: t.dueTime
      }));

      setEvents(mappedEvents || []);
      setTasks(mappedTasks || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasEventsOnDay = (date: Date) => {
    return events.some((event) => isSameDay(parseISO(event.start_time), date));
  };

  const hasTasksOnDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.some((task) => task.due_date && task.due_date === dateStr);
  };

  const getEventCountForDay = (date: Date) => {
    return events.filter((event) => isSameDay(parseISO(event.start_time), date)).length;
  };

  const getPendingTaskCountForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter((task) => 
      task.due_date && 
      task.due_date === dateStr &&
      !task.completed
    ).length;
  };

  return (
    <div className="w-full max-w-full">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(date) => date && onSelectDate(date)}
        className="rounded-md border-0 pointer-events-auto w-full"
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-6 w-full p-2",
          caption: "flex justify-center pt-1 relative items-center mb-6",
          caption_label: "text-lg font-black tracking-wide text-zinc-900 dark:text-white uppercase",
          nav: "space-x-1 flex items-center",
          nav_button: "h-9 w-9 bg-zinc-100 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 p-0 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10 hover:border-zinc-300 dark:hover:border-white/20 rounded-xl transition-all flex items-center justify-center shadow-sm",
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse space-y-2",
          head_row: "flex w-full mb-4",
          head_cell: "text-zinc-500 rounded-md w-full font-bold text-[11px] h-9 flex items-center justify-center uppercase tracking-[0.2em]",
          row: "flex w-full mt-2 gap-2",
          cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 w-full aspect-square",
          day: "h-full w-full p-0 font-medium text-zinc-700 dark:text-zinc-300 aria-selected:opacity-100 hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:text-zinc-900 dark:hover:text-white rounded-[14px] transition-all duration-300 flex items-start justify-center pt-2.5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 hover:shadow-sm dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.02)]",
          day_selected: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15),inset_0_0_10px_rgba(16,185,129,0.1)] rounded-[14px]",
          day_today: "bg-zinc-100 dark:bg-white/5 text-zinc-900 dark:text-white font-bold rounded-[14px] border border-zinc-200 dark:border-white/20 shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.05)]",
          day_outside: "text-zinc-600 opacity-50 font-normal",
          day_disabled: "text-zinc-700 opacity-50",
          day_hidden: "invisible",
        }}
        modifiers={{
          hasEvents: (date) => hasEventsOnDay(date),
          hasTasks: (date) => hasTasksOnDay(date),
        }}
        modifiersClassNames={{
          hasEvents: "after:absolute after:bottom-1.5 after:w-full after:h-[2px] after:bg-emerald-500/50 after:shadow-[0_0_8px_rgba(16,185,129,0.5)] after:rounded-full after:left-0",
          hasTasks: "before:absolute before:top-1 before:right-1 before:w-[4px] before:h-[4px] before:bg-indigo-500 before:shadow-[0_0_8px_rgba(99,102,241,0.8)] before:rounded-full",
        }}
        components={{
          DayContent: ({ date }) => {
            const dayEvents = events.filter((event) => isSameDay(parseISO(event.start_time), date));
            const taskCount = getPendingTaskCountForDay(date);
            
            // Get unique calendar colors for events on this day
            const eventColors = isGeneralCalendar
              ? [...new Set(dayEvents.map(e => e.calendar_id ? calendarsMap[e.calendar_id]?.color : '#10b981').filter(Boolean))]
              : dayEvents.length > 0 ? [selectedCalendarColor] : [];
            
            return (
              <div className="relative w-full h-full flex flex-col items-center justify-start pt-1">
                <span className="text-sm">{date.getDate()}</span>
                {(eventColors.length > 0 || taskCount > 0) && (
                  <div className="flex gap-1 mt-1.5 flex-wrap justify-center px-1">
                    {eventColors.slice(0, 3).map((color, idx) => (
                      <div 
                        key={idx} 
                        className="h-1.5 w-1.5 rounded-full shadow-sm" 
                        style={{ backgroundColor: color || '#10b981', boxShadow: `0 0 8px ${color || '#10b981'}80` }}
                      />
                    ))}
                    {taskCount > 0 && (
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                    )}
                  </div>
                )}
              </div>
            );
          },
        }}
      />
      
      {loading && (
        <p className="text-sm text-muted-foreground text-center mt-4">
          Carregando...
        </p>
      )}
    </div>
  );
}
