import { useState, useEffect } from "react";
import { Plus, Trash2, Share2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { CalendarDialog } from "./CalendarDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export interface Calendar {
  id: string;
  name: string;
  is_general: boolean;
  color: string;
  order_position: number;
}

interface CalendarTabsProps {
  selectedCalendarId: string | null;
  onSelectCalendar: (calendarId: string | null) => void;
  onCalendarsChange: () => void;
  onCalendarsLoaded?: (calendars: Calendar[]) => void;
}

export function CalendarTabs({ selectedCalendarId, onSelectCalendar, onCalendarsChange, onCalendarsLoaded }: CalendarTabsProps) {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<Calendar | undefined>();
  const [deleteCalendar, setDeleteCalendar] = useState<Calendar | undefined>();
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchCalendars();
    }
  }, [currentOrganization?.id]);

  const fetchCalendars = async () => {
    if (!currentOrganization?.id) return;

    try {
      const { data, error } = await supabase
        .from('calendars')
        .select('id, name, is_general, color, order_position')
        .eq('organization_id', currentOrganization.id)
        .order('order_position')
        .order('created_at');

      if (error) throw error;

      // Se não há calendários, criar o geral automaticamente
      if (!data || data.length === 0) {
        await createGeneralCalendar();
        return;
      }

      setCalendars(data);
      onCalendarsLoaded?.(data);
      
      // Se nenhum selecionado, selecionar o geral
      if (!selectedCalendarId) {
        const general = data.find(c => c.is_general);
        if (general) {
          onSelectCalendar(general.id);
        }
      }
    } catch (error) {
      console.error('Error fetching calendars:', error);
    } finally {
      setLoading(false);
    }
  };

  const createGeneralCalendar = async () => {
    if (!currentOrganization?.id) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('calendars')
        .insert({
          organization_id: currentOrganization.id,
          name: 'Geral',
          is_general: true,
          color: '#3B82F6',
          order_position: 0,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      setCalendars([data]);
      onSelectCalendar(data.id);
    } catch (error) {
      console.error('Error creating general calendar:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar agenda geral",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditCalendar = (calendar: Calendar, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCalendar(calendar);
    setDialogOpen(true);
  };

  const handleCalendarSaved = () => {
    setDialogOpen(false);
    setEditingCalendar(undefined);
    fetchCalendars();
    onCalendarsChange();
  };

  const handleDeleteCalendar = async () => {
    if (!deleteCalendar) return;
    try {
      await supabase
        .from('calendar_events')
        .update({ calendar_id: null })
        .eq('calendar_id', deleteCalendar.id);

      const { error } = await supabase
        .from('calendars')
        .delete()
        .eq('id', deleteCalendar.id);

      if (error) throw error;

      toast({ title: "Agenda excluída", description: "A agenda foi excluída com sucesso" });
      
      if (selectedCalendarId === deleteCalendar.id) {
        const general = calendars.find(c => c.is_general);
        onSelectCalendar(general?.id || null);
      }
      setDeleteCalendar(undefined);
      fetchCalendars();
      onCalendarsChange();
    } catch (error) {
      console.error('Error deleting calendar:', error);
      toast({ title: "Erro", description: "Falha ao excluir agenda", variant: "destructive" });
    }
  };

  const handleShareCalendar = async (calendar: Calendar) => {
    if (!currentOrganization?.id) return;
    
    const { data } = await (supabase as any)
      .from('organizations')
      .select('slug')
      .eq('id', currentOrganization.id)
      .single();
    
    if (data?.slug) {
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/a/${data.slug}?c=${calendar.id}`;
      navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!", description: "O link de agendamento foi copiado para a área de transferência" });
    }
  };

  const canAddMore = calendars.length < 10;

  if (loading) {
    return (
      <div className="flex gap-2 animate-pulse">
        <div className="h-8 w-20 bg-muted rounded" />
        <div className="h-8 w-20 bg-muted rounded" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {calendars.map((calendar) => (
          <div key={calendar.id} className="relative flex items-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSelectCalendar(calendar.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                      "hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary/20",
                      selectedCalendarId === calendar.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: calendar.color }}
                    />
                    <span className="truncate max-w-[80px]">{calendar.name}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {calendar.is_general 
                    ? "Visualiza eventos de todas as agendas" 
                    : calendar.name}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ))}

        {canAddMore && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setEditingCalendar(undefined);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Nova agenda ({calendars.length}/10)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <CalendarDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        calendar={editingCalendar}
        onSaved={handleCalendarSaved}
      />

      <AlertDialog open={!!deleteCalendar} onOpenChange={(open) => !open && setDeleteCalendar(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agenda "{deleteCalendar?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os eventos desta agenda serão mantidos mas sem vínculo a uma agenda específica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCalendar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
