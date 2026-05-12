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
      fetchData();
    }
  }, [refreshTrigger, currentOrganization?.id, calendarId, isGeneralCalendar, selectedDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
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
          month: "space-y-4 w-full",
          caption: "flex justify-center pt-1 relative items-center mb-4",
          caption_label: "text-base font-semibold",
          nav: "space-x-1 flex items-center",
          nav_button: "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-accent rounded-md transition-colors",
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse",
          head_row: "flex w-full mb-2",
          head_cell: "text-muted-foreground rounded-md w-full font-medium text-[13px] h-9 flex items-center justify-center uppercase",
          row: "flex w-full mt-1",
          cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 w-full aspect-square",
          day: "h-full w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors flex items-start justify-center pt-2",
          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold",
          day_today: "bg-accent text-accent-foreground font-semibold",
          day_outside: "text-muted-foreground opacity-30",
          day_disabled: "text-muted-foreground opacity-50",
          day_hidden: "invisible",
        }}
        modifiers={{
          hasEvents: (date) => hasEventsOnDay(date),
          hasTasks: (date) => hasTasksOnDay(date),
        }}
        modifiersClassNames={{
          hasEvents: "border-b-2 border-blue-500",
          hasTasks: "border-b-2 border-orange-500",
        }}
        components={{
          DayContent: ({ date }) => {
            const dayEvents = events.filter((event) => isSameDay(parseISO(event.start_time), date));
            const taskCount = getPendingTaskCountForDay(date);
            
            // Get unique calendar colors for events on this day
            const eventColors = isGeneralCalendar
              ? [...new Set(dayEvents.map(e => e.calendar_id ? calendarsMap[e.calendar_id]?.color : '#3B82F6').filter(Boolean))]
              : dayEvents.length > 0 ? [selectedCalendarColor] : [];
            
            return (
              <div className="relative w-full h-full flex flex-col items-center justify-start pt-1">
                <span className="text-sm">{date.getDate()}</span>
                {(eventColors.length > 0 || taskCount > 0) && (
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
                    {eventColors.slice(0, 3).map((color, idx) => (
                      <div 
                        key={idx} 
                        className="h-1.5 w-1.5 rounded-full" 
                        style={{ backgroundColor: color || '#3B82F6' }}
                      />
                    ))}
                    {taskCount > 0 && (
                      <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
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
