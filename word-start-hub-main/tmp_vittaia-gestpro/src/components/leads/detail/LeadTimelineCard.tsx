import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckSquare } from "lucide-react";
import { LeadAvatar } from "../LeadAvatar";

export function LeadTimelineCard({ calendarEvents, tasks }: { calendarEvents: any[], tasks: any[] }) {
    if (calendarEvents.length === 0 && tasks.length === 0) return null;

    return (
        <>
            {calendarEvents.length > 0 && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2 text-blue-600">
                        <Calendar className="h-5 w-5" />
                        Compromissos ({calendarEvents.length})
                    </h3>
                    <div className="space-y-2">
                        {calendarEvents.map((event) => (
                            <div key={event.id} className="p-3 bg-background/50 rounded-lg space-y-1">
                                <p className="font-medium">📅 {event.title}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(event.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                                {event.assigned_profile && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <LeadAvatar
                                            photoUrl={event.assigned_profile.avatar_url}
                                            name={event.assigned_profile.full_name}
                                            size="sm"
                                            showGroupIndicator={false}
                                        />
                                        <span>Responsável: {event.assigned_profile.full_name || 'Sem nome'}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tasks.length > 0 && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2 text-green-600">
                        <CheckSquare className="h-5 w-5" />
                        Tarefas ({tasks.length})
                    </h3>
                    <div className="space-y-2">
                        {tasks.map((task) => (
                            <div key={task.id} className="p-3 bg-background/50 rounded-lg space-y-1">
                                <div className="flex items-center gap-2">
                                    <span>{task.completed ? '✅' : '⏳'}</span>
                                    <span className="font-medium">{task.title}</span>
                                    {task.priority && (
                                        <Badge
                                            variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}
                                            className="text-xs"
                                        >
                                            {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                                        </Badge>
                                    )}
                                </div>
                                {task.due_date && (
                                    <p className="text-sm text-muted-foreground">
                                        Vence: {task.due_date ? format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR }) : ''}
                                        {task.due_time && ` às ${task.due_time}`}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
