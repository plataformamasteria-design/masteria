import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SearchableSelector } from "./SearchableSelector";
import { useOrganization } from "@/contexts/OrganizationContext";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    due_time: string | null;
    priority: string | null;
    assigned_to: string | null;
    chat_id: string | null;
  };
  onTaskSaved: () => void;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface Chat {
  id: string;
  wa_name: string | null;
  phone: string;
}

export function TaskDialog({ open, onOpenChange, task, onTaskSaved }: TaskDialogProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Chat[]>([]);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    dueTime: "",
    priority: "medium",
    assignedTo: "",
    chatId: "",
  });

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchUsers();
      fetchLeads();
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || "",
        dueDate: task.due_date || "",
        dueTime: task.due_time || "",
        priority: task.priority || "medium",
        assignedTo: task.assigned_to || "",
        chatId: task.chat_id || "",
      });
    } else {
      setFormData({
        title: "",
        description: "",
        dueDate: "",
        dueTime: "",
        priority: "medium",
        assignedTo: "",
        chatId: "",
      });
    }
  }, [task, open]);

  const fetchUsers = async () => {
    if (!currentOrganization?.id) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', currentOrganization.id)
      .order('full_name');
    
    if (data) setUsers(data);
  };

  const fetchLeads = async () => {
    if (!currentOrganization?.id) return;
    
    const { data } = await supabase
      .from('chats')
      .select('id, wa_name, phone')
      .eq('organization_id', currentOrganization.id)
      .order('wa_name');
    
    if (data) setLeads(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: "Erro",
        description: "O título da tarefa é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      if (!currentOrganization?.id) {
        throw new Error("Organização não selecionada");
      }

      const taskData = {
        user_id: user.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        due_date: formData.dueDate || null,
        due_time: formData.dueTime || null,
        priority: formData.priority,
        assigned_to: formData.assignedTo && formData.assignedTo !== "" ? formData.assignedTo : null,
        chat_id: formData.chatId && formData.chatId !== "" ? formData.chatId : null,
      };

      if (task) {
        // Update existing task
        const { error } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', task.id);

        if (error) throw error;

        toast({
          title: "Tarefa atualizada",
          description: "A tarefa foi atualizada com sucesso",
        });
      } else {
        // Create new task
        const { error } = await supabase.from('tasks').insert([{
          ...taskData,
          organization_id: currentOrganization.id,
          completed: false,
        }]);

        if (error) throw error;

        toast({
          title: "Tarefa criada",
          description: "A tarefa foi adicionada com sucesso",
        });
      }

      // Reset form
      setFormData({
        title: "",
        description: "",
        dueDate: "",
        dueTime: "",
        priority: "medium",
        assignedTo: "",
        chatId: "",
      });

      onTaskSaved();
    } catch (error) {
      console.error('Error saving task:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar tarefa",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          <DialogDescription>
            {task ? "Atualize as informações da tarefa" : "Crie uma nova tarefa com prazo de entrega"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Digite o título da tarefa"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Adicione detalhes sobre a tarefa"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Data de Entrega</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueTime">Horário (opcional)</Label>
              <Input
                id="dueTime"
                type="time"
                value={formData.dueTime}
                onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Prioridade</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SearchableSelector
            label="Atribuir para"
            placeholder="Buscar usuário..."
            items={users.map(u => ({
              id: u.id,
              name: u.full_name || u.email,
              subtitle: u.email,
            }))}
            value={formData.assignedTo}
            onChange={(value) => setFormData({ ...formData, assignedTo: value })}
            emptyMessage="Nenhum usuário encontrado"
          />

          <SearchableSelector
            label="Lead vinculado"
            placeholder="Buscar lead..."
            items={leads.map(l => ({
              id: l.id,
              name: l.wa_name || l.phone,
              subtitle: l.phone,
            }))}
            value={formData.chatId}
            onChange={(value) => setFormData({ ...formData, chatId: value })}
            emptyMessage="Nenhum lead encontrado"
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : task ? "Atualizar Tarefa" : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
