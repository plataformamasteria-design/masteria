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
  isGeneral: boolean;
  color: string;
  orderPosition: number;
}

interface CalendarTabsProps {
  calendars: Calendar[];
  selectedCalendarId: string | null;
  onSelectCalendar: (calendarId: string | null) => void;
  onChange: () => void;
}

export function CalendarTabs({ calendars, selectedCalendarId, onSelectCalendar, onChange }: CalendarTabsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<Calendar | undefined>();
  const [deleteCalendar, setDeleteCalendar] = useState<Calendar | undefined>();
  const { toast } = useToast();

  const handleEditCalendar = (calendar: Calendar, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCalendar(calendar);
    setDialogOpen(true);
  };

  const handleCalendarSaved = () => {
    setDialogOpen(false);
    setEditingCalendar(undefined);
    onChange();
  };

  const handleDeleteCalendar = async () => {
    if (!deleteCalendar) return;
    try {
      const res = await fetch(`/api/v1/agenda/calendars/${deleteCalendar.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Erro");

      toast({ title: "Agenda excluída", description: "A agenda foi excluída com sucesso" });
      
      if (selectedCalendarId === deleteCalendar.id) {
        const general = calendars.find(c => c.isGeneral);
        onSelectCalendar(general?.id || null);
      }
      setDeleteCalendar(undefined);
      onChange();
    } catch (error) {
      console.error('Error deleting calendar:', error);
      toast({ title: "Erro", description: "Falha ao excluir agenda", variant: "destructive" });
    }
  };

  const canAddMore = calendars.length < 10;

  return (
    <>
      <div className="flex flex-row flex-wrap gap-2 items-center">
        {calendars.map((calendar) => (
          <div key={calendar.id} className="relative flex items-center group">
            <button
              onClick={() => onSelectCalendar(calendar.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all text-left border shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]",
                selectedCalendarId === calendar.id
                  ? "bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white border-zinc-200 dark:border-white/20 shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                  : "bg-zinc-50 dark:bg-white/[0.02] text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/10"
              )}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: calendar.color }}
              />
              <span className="truncate">{calendar.name}</span>
            </button>
            
            {!calendar.isGeneral && (
              <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 flex gap-1 bg-zinc-900 rounded-lg p-1 shadow-lg border border-white/10 backdrop-blur-md">
                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/10 text-zinc-300" onClick={(e) => handleEditCalendar(calendar, e)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/20" onClick={(e) => { e.stopPropagation(); setDeleteCalendar(calendar); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}

        {canAddMore && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-start text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/[0.05] rounded-xl h-9 shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
            onClick={() => {
              setEditingCalendar(undefined);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova agenda ({calendars.length}/10)
          </Button>
        )}
      </div>

      <CalendarDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        calendar={editingCalendar as any}
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
