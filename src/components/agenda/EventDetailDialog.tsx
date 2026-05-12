import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, CheckSquare, MapPin, User, MessageSquare, Clock, Trash2, Edit, CheckCircle2, XCircle, UserCheck } from "lucide-react";
import { format, parseISO, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface EventDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EventItem | TaskItem | null;
  type: 'event' | 'task';
  onEdit: () => void;
  onDelete: () => void;
  onOpenLead?: (chatId: string) => void;
}

interface EventItem {
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
  attendance_status?: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
  chats?: {
    wa_name: string | null;
    phone: string;
  } | null;
}

interface TaskItem {
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

export function EventDetailDialog({
  open,
  onOpenChange,
  item,
  type,
  onEdit,
  onDelete,
  onOpenLead
}: EventDetailDialogProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<string>("pending");
  const [updatingAttendance, setUpdatingAttendance] = useState(false);

  // Sync attendance status from item when dialog opens
  const eventItem = type === 'event' ? (item as EventItem) : null;
  if (eventItem && eventItem.attendance_status && attendanceStatus !== eventItem.attendance_status) {
    setAttendanceStatus(eventItem.attendance_status);
  }

  const handleAttendance = async (status: 'attended' | 'no_show') => {
    if (!item || type !== 'event') return;
    setUpdatingAttendance(true);
    try {
      const res = await fetch(`/api/v1/agenda/events/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceStatus: status })
      });
      if (!res.ok) throw new Error("Erro");
      
      setAttendanceStatus(status);
      toast.success(status === 'attended' ? 'Comparecimento confirmado!' : 'Marcado como No-Show');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdatingAttendance(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;

    setIsDeleting(true);
    try {
      const endpoint = type === 'event' ? `/api/v1/agenda/events/${item.id}` : `/api/v1/agenda/tasks/${item.id}`;
      const res = await fetch(endpoint, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error("Erro");

      toast.success(type === 'event' ? 'Compromisso excluído com sucesso!' : 'Tarefa excluída com sucesso!');
      setDeleteDialogOpen(false);
      onOpenChange(false);
      onDelete();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!item) return null;

  const isEvent = type === 'event';
  const event = isEvent ? (item as EventItem) : null;
  const task = !isEvent ? (item as TaskItem) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {isEvent ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <Calendar className="h-5 w-5" />
                  <DialogTitle>Compromisso</DialogTitle>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-orange-600">
                  <CheckSquare className="h-5 w-5" />
                  <DialogTitle>Tarefa</DialogTitle>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Título */}
            <div>
              <h3 className="text-2xl font-bold">{item.title}</h3>
            </div>

            <Separator />

            {/* Horário/Data */}
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                {isEvent && event ? (
                  event.all_day ? (
                    <p className="font-medium">Dia inteiro</p>
                  ) : (
                    <>
                      <p className="font-medium">
                        {format(parseISO(event.start_time), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}
                      </p>
                    </>
                  )
                ) : task ? (
                  <>
                    <p className="font-medium">
                      Prazo: {task.due_date ? format(parse(task.due_date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Sem prazo'}
                    </p>
                    {task.due_time && (
                      <p className="text-sm text-muted-foreground">Horário: {task.due_time}</p>
                    )}
                  </>
                ) : null}
              </div>
            </div>

            {/* Localização (apenas eventos) */}
            {isEvent && event?.location && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Localização</p>
                  <p className="text-sm text-muted-foreground">{event.location}</p>
                </div>
              </div>
            )}

            {/* Prioridade (apenas tarefas) */}
            {!isEvent && task?.priority && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Prioridade:</span>
                <Badge
                  variant={
                    task.priority === 'high' ? 'destructive' :
                      task.priority === 'medium' ? 'default' :
                        'secondary'
                  }
                >
                  {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                </Badge>
              </div>
            )}

            {/* Status (apenas tarefas) */}
            {!isEvent && task && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                {task.completed ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Concluída
                  </Badge>
                ) : (
                  <Badge variant="secondary">Pendente</Badge>
                )}
              </div>
            )}

            {/* Descrição */}
            {item.description && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Descrição</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>
                </div>
              </>
            )}

            {/* Atribuído a */}
            {item.profiles && (
              <>
                <Separator />
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Atribuído a</p>
                    <p className="text-sm text-muted-foreground">{item.profiles.full_name}</p>
                  </div>
                </div>
              </>
            )}

            {/* Lead vinculado */}
            {item.chats && (
              <>
                <Separator />
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Lead vinculado</p>
                    <button
                      onClick={() => onOpenLead?.(item.chat_id!)}
                      className="text-sm text-primary hover:underline"
                    >
                      {item.chats.wa_name || item.chats.phone}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Google Sync Badge */}
            {isEvent && event?.synced_from_google && (
              <>
                <Separator />
                <Badge variant="outline" className="w-fit">
                  Sincronizado com Google Calendar
                </Badge>
              </>
            )}
          </div>

          {/* Attendance Confirmation (only for events with linked leads) */}
          {isEvent && event?.chat_id && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  Comparecimento
                </p>
                {attendanceStatus === 'attended' ? (
                  <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30" variant="outline">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Compareceu
                  </Badge>
                ) : attendanceStatus === 'no_show' ? (
                  <Badge className="bg-rose-500/20 text-rose-600 border-rose-500/30" variant="outline">
                    <XCircle className="h-3.5 w-3.5 mr-1" /> No-Show
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Clock className="h-3.5 w-3.5 mr-1" /> Pendente
                  </Badge>
                )}
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant={attendanceStatus === 'attended' ? 'default' : 'outline'}
                    onClick={() => handleAttendance('attended')}
                    disabled={updatingAttendance}
                    className={attendanceStatus === 'attended' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Compareceu
                  </Button>
                  <Button
                    size="sm"
                    variant={attendanceStatus === 'no_show' ? 'default' : 'outline'}
                    onClick={() => handleAttendance('no_show')}
                    disabled={updatingAttendance}
                    className={attendanceStatus === 'no_show' ? 'bg-rose-600 hover:bg-rose-700' : ''}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    No-Show
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este {isEvent ? 'compromisso' : 'tarefa'}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
