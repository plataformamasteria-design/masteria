import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Send, Brain } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

export const AI_SPLIT_DELIMITER = "⌁⌁⌁";

function SendAIResponseNodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const onChange = (data as any)?.onChange;
  const customLabel = (data as any)?.label || "";
  const allNodes: any[] = (data as any)?.allNodes || [];

  const sourceNodeId = config.source_ai_node_id || "";
  const splitEnabled = config.split_enabled ?? true;
  const delaySeconds = config.delay_seconds ?? 2;

  const updateConfig = (patch: Record<string, any>) => {
    if (!onChange) return;
    onChange(id, { config: { ...config, ...patch } });
  };

  const aiAgentNodes = allNodes.filter((n: any) => n.type === "ai_agent");

  // Find selected agent info
  const selectedAgent = aiAgentNodes.find((n: any) => n.id === sourceNodeId);
  const agentHasFormatting = selectedAgent?.data?.config?.format_for_send === true;

  // Simulate output preview
  const nodeOutput = (data as any)?.nodeOutput;
  const renderOutputPreview = () => {
    if (!nodeOutput?.messages) return null;
    return (
      <div className="px-3 pb-2 space-y-1">
        <Label className="text-[9px] font-semibold text-muted-foreground uppercase">Preview de Envio</Label>
        {nodeOutput.messages.map((msg: any, i: number) => (
          <div key={i} className="flex items-start gap-2 text-[10px]">
            <span className="text-muted-foreground shrink-0 w-12">
              {i === 0 ? "0s" : `+${(i * delaySeconds).toFixed(1)}s`}
            </span>
            <div className="flex-1 bg-muted/40 rounded px-2 py-1 border border-border/50">
              <p className="text-foreground break-words">{msg.text}</p>
            </div>
            <span className={`shrink-0 text-[9px] ${msg.delivered ? "text-emerald-500" : "text-amber-500"}`}>
              {msg.delivered ? "✓ Enviado" : "⏳ Pendente"}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-card border-2 border-emerald-500/60 rounded-xl shadow-lg min-w-[280px] max-w-[380px] overflow-hidden">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-card" />
      <NodeHeader
        nodeId={id}
        icon={<Send className="h-4 w-4 text-white" />}
        defaultLabel="Enviar Resposta I.A"
        customLabel={customLabel}
        colorClass="bg-emerald-600"
        textColorClass="text-white"
        solidHeader
        showOnHover={false}
        onExecute={() => (data as any)?.onExecute?.(id)}
        isExecuting={(data as any)?.isExecuting}
        onDuplicate={() => (data as any)?.onDuplicate?.(id)}
        onDelete={() => (data as any)?.onDelete?.(id)}
        onRename={(label) => (data as any)?.onRename?.(id, label)}
      />

      <div className="px-3 py-3 space-y-3 nodrag nowheel">
        {/* AI Agent Node Selection */}
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <Brain className="h-3 w-3" /> Nó de Agente I.A
          </Label>
          {aiAgentNodes.length === 0 ? (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1.5">
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                Nenhum nó "Agente I.A" encontrado no fluxo. Adicione um primeiro.
              </p>
            </div>
          ) : (
            <Select value={sourceNodeId} onValueChange={(v) => updateConfig({ source_ai_node_id: v })}>
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue placeholder="Selecione o agente..." />
              </SelectTrigger>
              <SelectContent>
                {aiAgentNodes.map((n: any) => (
                  <SelectItem key={n.id} value={n.id} className="text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <Brain className="h-3 w-3 text-violet-500" />
                      {n.data?.label || "Agente I.A"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {sourceNodeId && !agentHasFormatting && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 mt-1">
              <p className="text-[9px] text-amber-600 dark:text-amber-400">
                ⚠ O agente selecionado não tem "Formatar para envio" ativado. Ative no nó do agente para dividir automaticamente.
              </p>
            </div>
          )}
        </div>

        {/* Split Toggle */}
        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2 border border-border/50">
          <div>
            <p className="text-[11px] font-medium">Dividir resposta</p>
            <p className="text-[9px] text-muted-foreground">Enviar em partes separadas pelo delimitador <span className="font-mono text-emerald-500">⌁⌁⌁</span></p>
          </div>
          <Switch
            checked={splitEnabled}
            onCheckedChange={(v) => updateConfig({ split_enabled: v })}
          />
        </div>

        {splitEnabled && (
          <div className="space-y-2 pl-1 border-l-2 border-emerald-500/30 ml-1">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Delay entre mensagens (seg)</Label>
              <Input
                type="number"
                min={0}
                max={60}
                step={0.5}
                value={delaySeconds}
                onChange={(e) => updateConfig({ delay_seconds: parseFloat(e.target.value) || 0 })}
                className="h-7 text-[11px]"
              />
            </div>
          </div>
        )}

        {/* Info */}
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5">
          <p className="text-[9px] text-emerald-700 dark:text-emerald-400">
            A mensagem será enviada automaticamente para o lead que ativou o gatilho da automação.
          </p>
        </div>
      </div>

      {renderOutputPreview()}

      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel
        nodeId={id}
        nodeLabel={customLabel || "Enviar Resposta I.A"}
        nodeType="send_ai_response"
        output={(data as any)?.nodeOutput}
        error={(data as any)?.nodeError}
        isPinned={(data as any)?.isPinned || false}
        isExecuting={(data as any)?.isExecuting || false}
        onExecute={(testLead) => (data as any)?.onExecute?.(id, testLead)}
        onPin={() => (data as any)?.onPinOutput?.(id)}
        onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
      />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-card" />
    </div>
  );
}

export const SendAIResponseNode = memo(SendAIResponseNodeComponent);
