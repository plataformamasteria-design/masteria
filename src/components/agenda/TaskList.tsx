import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2, AlertCircle, Edit, User, MessageSquare, LayoutGrid, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, startOfDay, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TaskKanbanView } from "./TaskKanbanView";
import { useOrganization } from "@/contexts/OrganizationContext";

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

interface TaskListProps {
  refreshTrigger: number;
  onEditTask: (task: Task) => void;
  onOpenLead: (chatId: string) => void;
}

type FilterType = "all" | "pending" | "completed";
type ViewMode = "list" | "byUser";

export function TaskList({ refreshTrigger, onEditTask, onOpenLead }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchTasks();
    }
  }, [refreshTrigger, currentOrganization?.id]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      
      const res = await fetch('/api/v1/agenda/tasks');
      const json = await res.json();
      const tasksData = json.data || [];

      // Map profiles and chats to tasks
      const enrichedTasks = tasksData.map((t: any) => ({
        ...t,
        due_date: t.dueDate,
        due_time: t.dueTime,
        assigned_to: t.assignedTo,
        chat_id: t.contactId,
        profiles: t.assignedToUser ? { full_name: t.assignedToUser.name } : null,
        chats: t.contact ? { wa_name: t.contact.name, phone: t.contact.phone } : null,
      })) || [];

      setTasks(enrichedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (taskId: string, completed: boolean | null) => {
    try {
      const res = await fetch(`/api/v1/agenda/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed })
      });

      if (!res.ok) throw new Error("Erro");

      toast({
        title: "Status atualizado",
        description: !completed ? "Tarefa marcada como concluída" : "Tarefa marcada como pendente",
      });

      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar tarefa",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/v1/agenda/tasks/${taskId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error("Erro");

      toast({
        title: "Tarefa excluída",
        description: "A tarefa foi removida com sucesso",
      });

      fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir tarefa",
        variant: "destructive",
      });
    }
  };

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

  const filteredTasks = tasks.filter(task => {
    if (filter === "pending") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Filtros */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter("all")}
            className={filter === "all" ? "bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white border border-zinc-300 dark:border-white/20 hover:bg-zinc-300 dark:hover:bg-white/15 rounded-xl shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.05)]" : "bg-zinc-100 dark:bg-white/[0.02] text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-white/[0.05] hover:text-zinc-900 dark:hover:text-white rounded-xl"}
          >
            Todas ({tasks.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter("pending")}
            className={filter === "pending" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.15)]" : "bg-zinc-100 dark:bg-white/[0.02] text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-white/[0.05] hover:text-zinc-900 dark:hover:text-white rounded-xl"}
          >
            Pendentes ({tasks.filter(t => !t.completed).length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter("completed")}
            className={filter === "completed" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.15)]" : "bg-zinc-100 dark:bg-white/[0.02] text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-white/[0.05] hover:text-zinc-900 dark:hover:text-white rounded-xl"}
          >
            Concluídas ({tasks.filter(t => t.completed).length})
          </Button>
        </div>

        {/* Toggle de visualização */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("list")}
            className={viewMode === "list" ? "bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white border border-zinc-300 dark:border-white/20 hover:bg-zinc-300 dark:hover:bg-white/15 rounded-xl shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.05)]" : "bg-zinc-100 dark:bg-white/[0.02] text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-white/[0.05] hover:text-zinc-900 dark:hover:text-white rounded-xl"}
          >
            <List className="h-4 w-4 mr-2" />
            Lista
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("byUser")}
            className={viewMode === "byUser" ? "bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white border border-zinc-300 dark:border-white/20 hover:bg-zinc-300 dark:hover:bg-white/15 rounded-xl shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.05)]" : "bg-zinc-100 dark:bg-white/[0.02] text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-white/[0.05] hover:text-zinc-900 dark:hover:text-white rounded-xl"}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Por Usuário
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8 text-muted-foreground">
          Carregando tarefas...
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredTasks.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma tarefa encontrada
        </div>
      )}

      {/* Conteúdo - Visualizações */}
      {!loading && filteredTasks.length > 0 && (
        <>
          {viewMode === "byUser" ? (
            <TaskKanbanView
              tasks={filteredTasks}
              onToggleComplete={handleToggleComplete}
              onEditTask={onEditTask}
              onDeleteTask={handleDeleteTask}
              onOpenLead={onOpenLead}
            />
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
          const overdue = isTaskOverdue(task);

          return (
            <div
              key={task.id}
              className={`p-4 rounded-2xl border backdrop-blur-sm transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.03)] hover:bg-white/[0.04] ${
                overdue ? 'border-red-500/30 bg-red-500/5 shadow-[inset_0_1px_1px_rgba(239,68,68,0.05)]' : 'border-white/5 bg-white/[0.02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={task.completed || false}
                    onCheckedChange={() => handleToggleComplete(task.id, task.completed)}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className={`font-semibold tracking-tight ${
                          task.completed ? 'line-through text-zinc-600' : 'text-zinc-200'
                        }`}
                      >
                        {task.title}
                      </h4>
                      
                      <div className="flex gap-1">
                        <Badge variant={getPriorityColor(task.priority)}>
                          {getPriorityLabel(task.priority)}
                        </Badge>
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-sm text-zinc-400">{task.description}</p>
                    )}

                    {task.due_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {overdue && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span>
                          Entrega: {format(parse(task.due_date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          {task.due_time && ` às ${task.due_time}`}
                        </span>
                      </div>
                    )}

                    {task.profiles && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{task.profiles.full_name}</span>
                      </div>
                    )}

                    {task.chats && (
                      <button
                        onClick={() => onOpenLead(task.chat_id!)}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>Lead: {task.chats.wa_name || task.chats.phone}</span>
                      </button>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditTask(task)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
