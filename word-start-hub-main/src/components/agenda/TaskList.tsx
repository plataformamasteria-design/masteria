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
      
      if (!currentOrganization?.id) return;

      // Fetch tasks for current organization
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      // Fetch profiles and chats separately
      const userIds = [...new Set(data?.map(t => t.assigned_to).filter(Boolean))];
      const chatIds = [...new Set(data?.map(t => t.chat_id).filter(Boolean))];

      const profiles: Record<string, { full_name: string | null }> = {};
      const chats: Record<string, { wa_name: string | null; phone: string }> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        profilesData?.forEach(p => profiles[p.id] = { full_name: p.full_name });
      }

      if (chatIds.length > 0) {
        const { data: chatsData } = await supabase
          .from('chats')
          .select('id, wa_name, phone')
          .in('id', chatIds);
        chatsData?.forEach(c => chats[c.id] = { wa_name: c.wa_name, phone: c.phone });
      }

      // Map profiles and chats to tasks
      const enrichedTasks = data?.map(t => ({
        ...t,
        profiles: t.assigned_to ? profiles[t.assigned_to] : null,
        chats: t.chat_id ? chats[t.chat_id] : null,
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
      const { error } = await supabase
        .from('tasks')
        .update({ completed: !completed })
        .eq('id', taskId);

      if (error) throw error;

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
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

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
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            Todas ({tasks.length})
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
          >
            Pendentes ({tasks.filter(t => !t.completed).length})
          </Button>
          <Button
            variant={filter === "completed" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("completed")}
          >
            Concluídas ({tasks.filter(t => t.completed).length})
          </Button>
        </div>

        {/* Toggle de visualização */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-2" />
            Lista
          </Button>
          <Button
            variant={viewMode === "byUser" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("byUser")}
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
              className={`p-4 rounded-lg border ${
                overdue ? 'border-destructive bg-destructive/5' : 'border-border'
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
                        className={`font-medium ${
                          task.completed ? 'line-through text-muted-foreground' : ''
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
                      <p className="text-sm text-muted-foreground">{task.description}</p>
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
