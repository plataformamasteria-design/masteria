import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Zap, Globe, Timer, Copy, Check, Clock } from "lucide-react";
import { NodeStatsBar } from "./NodeStatsBar";
import { Button } from "@/components/ui/button";

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

const TRIGGER_LABELS: Record<string, { label: string; icon: any; description: string }> = {
  stage_entry: { label: "Entrada em Etapa", icon: Zap, description: "Dispara quando um lead entra em uma etapa do CRM" },
  message_received: { label: "Mensagem Recebida", icon: Zap, description: "Dispara ao receber uma mensagem na etapa" },
  tag_added: { label: "Tag Adicionada", icon: Zap, description: "Dispara quando uma tag é adicionada" },
  manual: { label: "Manual", icon: Zap, description: "Disparo manual pelo usuário" },
  webhook: { label: "Webhook", icon: Globe, description: "Recebe dados externos via HTTP POST" },
  scheduled: { label: "Timer Automático", icon: Timer, description: "Executa automaticamente em intervalos" },
};

const UNIT_LABELS: Record<string, string> = {
  seconds: "segundo(s)",
  minutes: "minuto(s)",
  hours: "hora(s)",
  days: "dia(s)",
};

function TriggerNodeComponent({ data }: NodeProps) {
  const [copied, setCopied] = useState(false);
  const config = (data as any)?.config || {};
  const triggerType = config.trigger_type || "stage_entry";
  const webhookToken = config.webhook_token;
  const scheduleConfig = config.schedule_config;

  const info = TRIGGER_LABELS[triggerType] || TRIGGER_LABELS.stage_entry;
  const Icon = info?.icon || Zap;

  const webhookUrl = webhookToken
    ? `${BASE_URL}/api/v1/webhooks/automation?token=${webhookToken}`
    : null;

  const copyUrl = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-950 border-2 border-primary rounded-xl shadow-lg min-w-[260px] max-w-[320px] overflow-visible">
      <div className="bg-primary px-4 py-2.5 flex items-center gap-2 drag-handle-area cursor-grab active:cursor-grabbing">
        <Icon className="h-4 w-4 text-primary-foreground" />
        <span className="text-sm font-semibold text-primary-foreground">Gatilho</span>
        <span className="ml-auto text-[10px] font-medium text-primary-foreground/70 bg-primary-foreground/15 px-2 py-0.5 rounded-full">
          {info?.label || "Gatilho"}
        </span>
      </div>

      <div className="px-4 py-3 space-y-2">
        <p className="text-xs text-muted-foreground">{info?.description || ""}</p>

        {/* Webhook URL display */}
        {triggerType === "webhook" && webhookUrl && (
          <div className="space-y-1.5 p-2 rounded-lg bg-muted/50 border border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold text-foreground">URL do Webhook</span>
            </div>
            <div className="flex items-center gap-1">
              <code className="text-[9px] font-mono bg-background px-1.5 py-1 rounded border border-slate-200 dark:border-zinc-800 truncate flex-1 block overflow-visible">
                {webhookUrl}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => { e.stopPropagation(); copyUrl(); }}
              >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground">
              Envie POST com JSON. Os dados ficam disponíveis como variáveis no fluxo via <code className="text-primary">{"{{ $webhook.campo }}"}</code>
            </p>
          </div>
        )}

        {triggerType === "webhook" && !webhookUrl && (
          <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-[10px] text-muted-foreground">
              Salve a automação para gerar a URL do webhook.
            </p>
          </div>
        )}

        {/* Schedule config display */}
        {triggerType === "scheduled" && scheduleConfig && (
          <div className="space-y-1 p-2 rounded-lg bg-muted/50 border border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold text-foreground">Intervalo</span>
            </div>
            <p className="text-xs font-medium text-foreground">
              A cada {scheduleConfig.interval} {UNIT_LABELS[scheduleConfig.unit] || scheduleConfig.unit}
            </p>
            <p className="text-[9px] text-muted-foreground">
              Executa automaticamente enquanto a automação estiver ativa.
            </p>
          </div>
        )}

        {triggerType === "scheduled" && !scheduleConfig && (
          <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-[10px] text-muted-foreground">
              Configure o intervalo de execução nas configurações da automação.
            </p>
          </div>
        )}
      </div>

      <NodeStatsBar stats={(data as any)?.stats} />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-primary !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 "
      />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
