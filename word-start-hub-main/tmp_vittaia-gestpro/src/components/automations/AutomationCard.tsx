import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Automation, Funnel, FunnelStage } from "@/pages/Automations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Play,
  Pause,
  Pencil,
  Trash2,
  GitBranch,
  Users,
  Zap,
  Workflow,
  History,
  Download,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExecutionHistoryDialog } from "./ExecutionHistoryDialog";
import { TriggerAutomationDialog } from "./TriggerAutomationDialog";
import { exportAutomation, downloadJson } from "@/lib/automation-export-import";
import { toast } from "@/hooks/use-toast";

interface AutomationCardProps {
  automation: Automation;
  funnels: Funnel[];
  stages: FunnelStage[];
  executionCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  active: { label: "Ativa", variant: "default" },
  paused: { label: "Pausada", variant: "outline" },
};

const triggerLabels: Record<string, string> = {
  stage_entry: "Entrada em etapa",
  message_received: "Mensagem recebida",
  tag_added: "Tag adicionada",
  manual: "Manual",
  webhook: "Webhook",
  scheduled: "Agendado (Timer)",
  broadcast_campaign: "Disparo Lote",
};

export function AutomationCard({
  automation,
  funnels,
  stages,
  executionCount,
  onEdit,
  onDelete,
  onToggleStatus,
}: AutomationCardProps) {
  const navigate = useNavigate();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const funnel = funnels.find((f) => f.id === automation.funnel_id);
  const stage = stages.find((s) => s.id === automation.trigger_stage_id);
  const status = statusConfig[automation.status] || statusConfig.draft;

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{automation.name}</h3>
                {automation.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {automation.description}
                  </p>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleStatus}>
                  {automation.status === "active" ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Ativar
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                  <History className="h-4 w-4 mr-2" />
                  Histórico
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTriggerOpen(true)}>
                  <Play className="h-4 w-4 mr-2" />
                  Acionar para Lead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  const data = await exportAutomation(automation.id);
                  if (data) {
                    const safeName = automation.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
                    downloadJson(data, `automacao-${safeName}.json`);
                    toast({ title: "Automação exportada!" });
                  } else {
                    toast({ variant: "destructive", title: "Erro ao exportar" });
                  }
                }}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Status + Trigger */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge variant={status.variant} className="text-[10px]">
              {status.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {triggerLabels[automation.trigger_type] || automation.trigger_type}
            </span>
          </div>

          {/* Funnel + Stage */}
          {funnel && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 bg-muted/30 rounded-md px-2.5 py-1.5">
              <GitBranch className="h-3 w-3 shrink-0" />
              <span className="truncate">{funnel.name}</span>
              {stage && (
                <>
                  <span className="opacity-40">→</span>
                  <span className="inline-flex items-center gap-1 truncate">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.name}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Edit Flow Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs gap-1.5 mb-3"
            onClick={() => navigate(`/automations/${automation.id}`)}
          >
            <Workflow className="h-3.5 w-3.5" />
            Editar Fluxo
          </Button>

          {/* Footer */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/30">
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Users className="h-3 w-3" />
              <span>{executionCount} execuções</span>
            </button>
            <span>
              {formatDistanceToNow(new Date(automation.updated_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>
        </CardContent>
      </Card>

      <ExecutionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        automationId={automation.id}
        automationName={automation.name}
      />

      <TriggerAutomationDialog
        open={triggerOpen}
        onOpenChange={setTriggerOpen}
        automationId={automation.id}
        automationName={automation.name}
      />
    </>
  );
}
