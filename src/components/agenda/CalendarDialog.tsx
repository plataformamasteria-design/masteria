import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Trash2, Link2 } from "lucide-react";
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

interface Calendar {
  id: string;
  name: string;
  is_general: boolean;
  color: string;
  googleCalendarId?: string | null;
}

interface CalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendar?: Calendar;
  onSaved: () => void;
}

export function CalendarDialog({ open, onOpenChange, calendar, onSaved }: CalendarDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [googleCalendarId, setGoogleCalendarId] = useState<string>("none");
  const [googleCalendars, setGoogleCalendars] = useState<any[]>([]);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    const fetchGoogleCals = async () => {
      try {
        const res = await fetch('/api/v1/integrations/google/calendars');
        const data = await res.json();
        if (data.connected && data.calendars) {
          setGoogleCalendars(data.calendars);
        }
      } catch (e) {}
    };
    if (open) fetchGoogleCals();
  }, [open]);

  useEffect(() => {
    if (calendar) {
      setName(calendar.name);
      setColor(calendar.color);
      setGoogleCalendarId(calendar.googleCalendarId || "none");
    } else {
      setName("");
      setColor("#3B82F6");
      setGoogleCalendarId("none");
    }
  }, [calendar, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "O nome da agenda é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (calendar) {
        // Update existing
        const res = await fetch(`/api/v1/agenda/calendars/${calendar.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), color, googleCalendarId: googleCalendarId === "none" ? null : googleCalendarId })
        });
        
        if (!res.ok) throw new Error("Erro ao atualizar");

        toast({
          title: "Agenda atualizada",
          description: "A agenda foi atualizada com sucesso",
        });
      } else {
        // Create new
        const res = await fetch(`/api/v1/agenda/calendars`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            color,
            isGeneral: false,
            googleCalendarId: googleCalendarId === "none" ? null : googleCalendarId,
          })
        });

        if (!res.ok) {
           const err = await res.json();
           if (err.error?.includes('10 agendas')) {
            toast({
              title: "Limite atingido",
              description: "Você atingiu o limite máximo de 10 agendas",
              variant: "destructive",
            });
            return;
          }
          throw new Error("Erro ao criar");
        }

        toast({
          title: "Agenda criada",
          description: "A nova agenda foi criada com sucesso",
        });
      }

      onSaved();
    } catch (error) {
      console.error('Error saving calendar:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar agenda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!calendar || calendar.is_general) return;

    try {
      setLoading(true);

      const res = await fetch(`/api/v1/agenda/calendars/${calendar.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error("Erro ao excluir");

      toast({
        title: "Agenda excluída",
        description: "A agenda foi excluída com sucesso",
      });

      setDeleteDialogOpen(false);
      onSaved();
    } catch (error) {
      console.error('Error deleting calendar:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir agenda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{calendar ? "Editar Agenda" : "Nova Agenda"}</DialogTitle>
            <DialogDescription>
              {calendar ? "Atualize as informações da agenda" : "Crie uma nova agenda para organizar eventos"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Ex: Deivid, Consultas, Reuniões..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={calendar?.is_general}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
            </div>

            {googleCalendars.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Link2 className="w-4 h-4 text-slate-500" /> Vincular ao Google Calendar</Label>
                <Select value={googleCalendarId} onValueChange={setGoogleCalendarId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um calendário (Opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (Apenas Local)</SelectItem>
                    {googleCalendars.map(cal => (
                      <SelectItem key={cal.id} value={cal.id}>{cal.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">Eventos desta agenda serão espelhados neste calendário do Google.</p>
              </div>
            )}

            <DialogFooter className="flex gap-2">
              {calendar && !calendar.is_general && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={loading}
                  className="mr-auto"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || calendar?.is_general}>
                {loading ? "Salvando..." : calendar ? "Atualizar" : "Criar Agenda"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agenda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os eventos desta agenda serão mantidos mas sem vínculo a uma agenda específica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
