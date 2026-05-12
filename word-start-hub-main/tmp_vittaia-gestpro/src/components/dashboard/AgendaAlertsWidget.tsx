import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfDay, endOfDay, addDays, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UpcomingEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  color: string | null;
}

interface PendingTask {
  id: string;
  title: string;
  due_date: string | null;
  priority: string | null;
}

export default function AgendaAlertsWidget() {
  const { currentOrganization } = useOrganization();
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const now = new Date();
      const threeDaysLater = endOfDay(addDays(now, 3));

      const [eventsRes, tasksRes] = await Promise.all([
        (supabase as any)
          .from("calendar_events")
          .select("id, title, start_time, end_time, location, color")
          .eq("organization_id", currentOrganization.id)
          .gte("start_time", now.toISOString())
          .lte("start_time", threeDaysLater.toISOString())
          .order("start_time", { ascending: true })
          .limit(5),
        (supabase as any)
          .from("tasks")
          .select("id, title, due_date, priority")
          .eq("organization_id", currentOrganization.id)
          .eq("completed", false)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(5),
      ]);

      setEvents(eventsRes.data || []);
      setTasks(tasksRes.data || []);
    } catch (e) {
      console.error("Error fetching agenda alerts:", e);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || (events.length === 0 && tasks.length === 0)) return null;

  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return "Hoje";
    if (isTomorrow(d)) return "Amanhã";
    return format(d, "dd/MM", { locale: ptBR });
  };

  const priorityColors: Record<string, string> = {
    high: "text-red-500 bg-red-500/10",
    medium: "text-amber-500 bg-amber-500/10",
    low: "text-blue-500 bg-blue-500/10",
  };

  return (
    <div className="space-y-3">
      {events.length > 0 && (
        <Card className="border-l-4 border-l-primary bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">Próximos compromissos</h3>
                  <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary">
                    {events.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {events.map(event => {
                    const startDate = new Date(event.start_time);
                    return (
                      <div key={event.id} className="flex items-center gap-2 text-xs">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: event.color || "hsl(var(--primary))" }}
                        />
                        <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0 shrink-0">
                          {getDateLabel(event.start_time)}
                        </Badge>
                        <span className="text-muted-foreground shrink-0">
                          {format(startDate, "HH:mm")}
                        </span>
                        <span className="font-medium truncate">{event.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tasks.length > 0 && (
        <Card className="border-l-4 border-l-indigo-500 bg-indigo-500/5 border-indigo-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 shrink-0">
                <Clock className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">Tarefas pendentes</h3>
                  <Badge variant="outline" className="text-[10px] font-bold border-indigo-500/30 text-indigo-500">
                    {tasks.length}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {tasks.map(task => (
                    <div key={task.id} className="flex items-center gap-2 text-xs">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        task.priority === "high" ? "bg-red-500" :
                          task.priority === "medium" ? "bg-amber-500" : "bg-blue-500"
                      )} />
                      <span className="font-medium truncate flex-1">{task.title}</span>
                      {task.due_date && (
                        <span className="text-muted-foreground shrink-0">
                          {getDateLabel(task.due_date)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
