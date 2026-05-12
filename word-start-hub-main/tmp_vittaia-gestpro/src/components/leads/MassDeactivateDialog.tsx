import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { CalendarIcon, PowerOff, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MassDeactivateDialogProps {
  onComplete?: () => void;
}

const MassDeactivateDialog = ({ onComplete }: MassDeactivateDialogProps) => {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  const handleDeactivate = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Selecione o período",
        description: "Por favor, selecione a data inicial e final.",
        variant: "destructive",
      });
      return;
    }

    if (!currentOrganization?.id) return;

    setLoading(true);

    try {
      // Set start date to beginning of day and end date to end of day
      const startISO = new Date(startDate);
      startISO.setHours(0, 0, 0, 0);
      
      const endISO = new Date(endDate);
      endISO.setHours(23, 59, 59, 999);

      // Find all chats with last_message_at within the period
      const { data: chats, error: fetchError } = await (supabase as any)
        .from("chats")
        .select("id")
        .eq("organization_id", currentOrganization.id)
        .gte("last_message_at", startISO.toISOString())
        .lte("last_message_at", endISO.toISOString())
        .eq("agent_off", false);

      if (fetchError) throw fetchError;

      if (!chats || chats.length === 0) {
        toast({
          title: "Nenhum lead encontrado",
          description: "Não há leads com mensagens no período selecionado que estejam com o robô ativo.",
        });
        setLoading(false);
        return;
      }

      const chatIds = chats.map((chat: { id: string }) => chat.id);

      // Update all chats to deactivate bot
      const { error: updateError } = await (supabase as any)
        .from("chats")
        .update({ agent_off: true })
        .in("id", chatIds);

      if (updateError) throw updateError;

      toast({
        title: "Robôs desativados!",
        description: `${chats.length} lead(s) tiveram o robô desativado.`,
      });

      setOpen(false);
      setStartDate(undefined);
      setEndDate(undefined);
      onComplete?.();
    } catch (error: any) {
      console.error("Error deactivating bots:", error);
      toast({
        title: "Erro ao desativar",
        description: error.message || "Não foi possível desativar os robôs.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PowerOff className="h-4 w-4 mr-2" />
          Desativar em Massa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desativar Robô em Massa</DialogTitle>
          <DialogDescription>
            Selecione o período para desativar o robô de todos os leads que enviaram mensagem nesse intervalo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                    disabled={(date) => startDate ? date < startDate : false}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {startDate && endDate && (
            <p className="text-sm text-muted-foreground">
              Serão desativados os robôs de leads que enviaram mensagem entre{" "}
              <strong>{format(startDate, "dd/MM/yyyy", { locale: ptBR })}</strong> e{" "}
              <strong>{format(endDate, "dd/MM/yyyy", { locale: ptBR })}</strong>.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleDeactivate} 
            disabled={loading || !startDate || !endDate}
            variant="destructive"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Desativando...
              </>
            ) : (
              <>
                <PowerOff className="h-4 w-4 mr-2" />
                Desativar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MassDeactivateDialog;
