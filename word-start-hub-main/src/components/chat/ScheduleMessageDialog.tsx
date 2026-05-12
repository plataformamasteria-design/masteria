import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { format, addHours, setHours, setMinutes } from "date-fns";
import { Calendar, Clock, Trash2 } from "lucide-react";

interface ScheduledMessage {
  id: string;
  content: string;
  scheduled_for: string;
}

interface ScheduleMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  message?: ScheduledMessage;
  initialContent?: string;
  onSaved?: () => void;
}

export function ScheduleMessageDialog({
  open,
  onOpenChange,
  chatId,
  message,
  initialContent = "",
  onSaved = () => { }
}: ScheduleMessageDialogProps) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (open) {
      if (message) {
        // Editing existing
        setContent(message.content);
        const date = new Date(message.scheduled_for);
        setScheduledDate(format(date, 'yyyy-MM-dd'));
        setScheduledTime(format(date, 'HH:mm'));
      } else {
        // New message
        setContent(initialContent);
        // Default to 1 hour from now
        const defaultDate = addHours(new Date(), 1);
        setScheduledDate(format(defaultDate, 'yyyy-MM-dd'));
        setScheduledTime(format(defaultDate, 'HH:mm'));
      }
    }
  }, [open, message, initialContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast({
        title: "Erro",
        description: "O conteúdo da mensagem é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      toast({
        title: "Erro",
        description: "Selecione a data e hora do agendamento",
        variant: "destructive",
      });
      return;
    }

    const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);

    if (scheduledFor <= new Date()) {
      toast({
        title: "Erro",
        description: "A data/hora deve ser no futuro",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (message) {
        // Update existing
        const { error } = await supabase
          .from('scheduled_messages')
          .update({
            content: content.trim(),
            scheduled_for: scheduledFor.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', message.id);

        if (error) throw error;

        toast({
          title: "Agendamento atualizado",
          description: "A mensagem agendada foi atualizada",
        });
      } else {
        // Create new
        if (!currentOrganization?.id) {
          throw new Error("Organização não selecionada");
        }

        const { error } = await supabase
          .from('scheduled_messages')
          .insert({
            organization_id: currentOrganization.id,
            chat_id: chatId,
            content: content.trim(),
            message_type: 'text',
            scheduled_for: scheduledFor.toISOString(),
            created_by: user?.id,
          });

        if (error) throw error;

        toast({
          title: "Mensagem agendada",
          description: `Será enviada em ${format(scheduledFor, "dd/MM 'às' HH:mm")}`,
        });
      }

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving scheduled message:', error);
      toast({
        title: "Erro",
        description: "Falha ao agendar mensagem",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!message) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from('scheduled_messages')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', message.id);

      if (error) throw error;

      toast({
        title: "Agendamento cancelado",
        description: "A mensagem agendada foi cancelada",
      });

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error cancelling scheduled message:', error);
      toast({
        title: "Erro",
        description: "Falha ao cancelar agendamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40 border-white/10 shadow-2xl !rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl tracking-tight">
            <Clock className="h-5 w-5 text-primary" />
            {message ? "Editar Agendamento" : "Agendar Mensagem"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {message
              ? "Atualize o conteúdo ou horário do envio automático."
              : "Defina quando esta mensagem será disparada."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="space-y-2">
            <Textarea
              id="content"
              placeholder="Digite a mensagem que será enviada..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              required
              className="resize-none bg-black/5 dark:bg-white/5 border-transparent focus-visible:ring-1 focus-visible:ring-primary/50 !rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-white/5">
            <div className="space-y-1.5 focus-within:text-primary transition-colors">
              <Label htmlFor="date" className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground ml-1">
                <Calendar className="h-3 w-3" />
                Data
              </Label>
              <Input
                id="date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                required
                className="h-8 bg-transparent border-none shadow-none px-1 text-sm focus-visible:ring-0 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5 focus-within:text-primary transition-colors pl-3 border-l border-border/50">
              <Label htmlFor="time" className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground ml-1">
                <Clock className="h-3 w-3" />
                Hora
              </Label>
              <Input
                id="time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
                className="h-8 bg-transparent border-none shadow-none px-1 text-sm focus-visible:ring-0 cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-2">
            {message ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={loading}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 px-2 h-9"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="h-9 px-4 !rounded-full text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="h-9 px-6 !rounded-full font-medium shadow-md transition-transform active:scale-95">
                {loading ? "Salvando..." : message ? "Atualizar" : "Agendar"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
