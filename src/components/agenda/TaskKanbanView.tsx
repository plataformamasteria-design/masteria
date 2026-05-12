import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Trash2, MessageSquare, AlertCircle } from "lucide-react";
import { format, isPast, startOfDay, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  completed: boolean | null;
  priority: string | null;
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

interface TaskKanbanViewProps {
  tasks: Task[];
  onToggleComplete: (taskId: string, completed: boolean | null) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenLead: (chatId: string) => void;
}

export function TaskKanbanView({
  tasks,
  onToggleComplete,
  onEditTask,
  onDeleteTask,
  onOpenLead,
}: TaskKanbanViewProps) {
  // Group tasks by assigned user
  const tasksByUser: Record<string, { userName: string; tasks: Task[] }> = {};

  tasks.forEach((task) => {
    const userId = task.assigned_to || "unassigned";
    const userName = task.profiles?.full_name || "Sem atribuição";

    if (!tasksByUser[userId]) {
      tasksByUser[userId] = {
        userName,
        tasks: [],
      };
    }
    tasksByUser[userId].tasks.push(task);
  });

  const isTaskOverdue = (task: Task) => {
    if (!task.due_date) return false;
    if (task.completed) return false;
    
    const today = startOfDay(new Date());
    const dueDate = startOfDay(parse(task.due_date, 'yyyy-MM-dd', new Date()));
    
    return isPast(dueDate) && dueDate < today;
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getPriorityLabel = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Média';
      case 'low':
        return 'Baixa';
      default:
        return 'Não definida';
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Object.entries(tasksByUser).map(([userId, { userName, tasks: userTasks }]) => (
        <Card key={userId} className="min-w-[320px] max-w-[320px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="truncate">{userName}</span>
              <Badge variant="secondary" className="ml-2">
                {userTasks.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
            {userTasks.map((task) => {
              const overdue = isTaskOverdue(task);

              return (
                <div
                  key={task.id}
                  className={`p-3 rounded-lg border ${
                    overdue ? 'border-destructive bg-destructive/5' : 'border-border'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={task.completed || false}
                        onCheckedChange={() => onToggleComplete(task.id, task.completed)}
                        className="mt-0.5"
                      />
                      
                      <div className="flex-1 min-w-0 space-y-2">
                        <h4
                          className={`font-medium text-sm leading-tight ${
                            task.completed ? 'line-through text-muted-foreground' : ''
                          }`}
                        >
                          {task.title}
                        </h4>

                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                          {getPriorityLabel(task.priority)}
                        </Badge>

                        {task.due_date && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {overdue && (
                              <AlertCircle className="h-3 w-3 text-destructive" />
                            )}
                            <span>
                              {format(parse(task.due_date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: ptBR })}
                              {task.due_time && ` ${task.due_time}`}
                            </span>
                          </div>
                        )}

                        {task.chats && (
                          <button
                            onClick={() => onOpenLead(task.chat_id!)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <MessageSquare className="h-3 w-3" />
                            <span className="truncate">
                              {task.chats.wa_name || task.chats.phone}
                            </span>
                          </button>
                        )}

                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditTask(task)}
                            className="h-7 px-2"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteTask(task.id)}
                            className="h-7 px-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
