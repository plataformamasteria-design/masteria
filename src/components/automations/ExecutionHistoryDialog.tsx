import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock, Loader2, Square, StopCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ExecutionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automationId: string;
  automationName: string;
}

interface Execution {
  id: string;
  chat_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  context: any;
}

const statusIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  running: <Loader2 className="h-4 w-4 text-primary animate-spin" />,
  waiting: <Clock className="h-4 w-4 text-yellow-500" />,
  waiting_response: <Clock className="h-4 w-4 text-cyan-500" />,
  cancelled: <Square className="h-4 w-4 text-muted-foreground" />,
  loop_completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

const statusLabels: Record<string, string> = {
  completed: "Concluída",
  failed: "Falhou",
  running: "Executando",
  waiting: "Aguardando",
  waiting_response: "Aguardando Resposta",
  cancelled: "Cancelada",
  loop_completed: "Loop Concluído",
};

const ACTIVE_STATUSES = ["running", "waiting", "waiting_response"];

export function ExecutionHistoryDialog({
  open,
  onOpenChange,
  automationId,
  automationName,
}: ExecutionHistoryDialogProps) {
  const { currentOrganization } = useOrganization();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancellingAll, setCancellingAll] = useState(false);

  const fetchExecutions = () => {
    if (!currentOrganization?.id) return;
    setLoading(true);

    (supabase as any)
      .from("automation_executions")
      .select("*")
      .eq("automation_id", automationId)
      .eq("organization_id", currentOrganization.id)
      .order("started_at", { ascending: false })
      .limit(50)
      .then(({ data }: any) => {
        setExecutions((data || []) as Execution[]);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!open || !currentOrganization?.id) return;
    fetchExecutions();
  }, [open, automationId, currentOrganization?.id]);

  const cancelExecution = async (executionId: string) => {
    setCancellingId(executionId);
    try {
      const { error } = await (supabase as any)
        .from("automation_executions")
        .update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
        })
        .eq("id", executionId)
        .eq("organization_id", currentOrganization?.id);

      if (error) throw error;

      setExecutions((prev) =>
        prev.map((e) =>
          e.id === executionId
            ? { ...e, status: "cancelled", completed_at: new Date().toISOString() }
            : e
        )
      );
      toast({ title: "Execução interrompida" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao interromper execução" });
    } finally {
      setCancellingId(null);
    }
  };

  const cancelAllExecutions = async () => {
    setCancellingAll(true);
    try {
      const activeIds = executions
        .filter((e) => ACTIVE_STATUSES.includes(e.status))
        .map((e) => e.id);

      if (activeIds.length === 0) {
        toast({ title: "Nenhuma execução ativa para interromper" });
        setCancellingAll(false);
        return;
      }

      const { error } = await (supabase as any)
        .from("automation_executions")
        .update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
        })
        .in("id", activeIds)
        .eq("organization_id", currentOrganization?.id);

      if (error) throw error;

      setExecutions((prev) =>
        prev.map((e) =>
          activeIds.includes(e.id)
            ? { ...e, status: "cancelled", completed_at: new Date().toISOString() }
            : e
        )
      );
      toast({ title: `${activeIds.length} execução(ões) interrompida(s)` });
    } catch {
      toast({ variant: "destructive", title: "Erro ao interromper execuções" });
    } finally {
      setCancellingAll(false);
    }
  };

  const hasActiveExecutions = executions.some((e) => ACTIVE_STATUSES.includes(e.status));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base">Execuções — {automationName}</DialogTitle>
          </div>
        </DialogHeader>

        {/* Cancel all button */}
        {!loading && hasActiveExecutions && (
          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-2"
            onClick={cancelAllExecutions}
            disabled={cancellingAll}
          >
            {cancellingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <StopCircle className="h-4 w-4" />
            )}
            Interromper todas as execuções ativas
          </Button>
        )}

        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : executions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma execução registrada ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {executions.map((exec) => {
                const isActive = ACTIVE_STATUSES.includes(exec.status);
                return (
                  <div
                    key={exec.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20"
                  >
                    {statusIcons[exec.status] || statusIcons.running}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            exec.status === "completed" || exec.status === "loop_completed"
                              ? "default"
                              : exec.status === "failed" || exec.status === "cancelled"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {statusLabels[exec.status] || exec.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {exec.chat_id.substring(0, 8)}...
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(exec.started_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>

                    {isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => cancelExecution(exec.id)}
                        disabled={cancellingId === exec.id}
                        title="Interromper execução"
                      >
                        {cancellingId === exec.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
