import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileJson, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface KommoStep {
  question: Array<{
    params: any;
    handler: string;
  }>;
  block_uuid: string;
}

interface KommoData {
  type_functionality: number;
  model: {
    text: string;
  };
}

interface CrmReference {
  nodeIndex: number;
  kommo_pipeline_id: any;
  kommo_status_id: any;
  stepKey: string;
}

interface ParsedNode {
  tempId: string;
  type: string;
  label: string;
  config: any;
  posY: number;
  nextSteps: Array<{ targetStep: number; handleId?: string; label?: string }>;
}

interface ImportPreview {
  name: string;
  nodes: ParsedNode[];
  warnings: string[];
  stepKeyToIndex: Record<number, number>;
  crmReferences: CrmReference[];
}

function parseKommoJson(raw: KommoData): ImportPreview {
  const warnings: string[] = [];
  const steps: Record<string, KommoStep> = JSON.parse(raw.model.text);
  const sortedKeys = Object.keys(steps).sort((a, b) => Number(a) - Number(b));
  const nodes: ParsedNode[] = [];
  const crmReferences: CrmReference[] = [];

  const stepKeyToIndex: Record<number, number> = {};
  sortedKeys.forEach((key, i) => {
    stepKeyToIndex[Number(key)] = i;
  });

  sortedKeys.forEach((key, index) => {
    const step = steps[key];
    const rawHandlers = (step as any).question || step;
    const handlers: any[] = Array.isArray(rawHandlers) ? rawHandlers : [rawHandlers];
    const tempId = `import-${index}-${Date.now()}`;
    const posY = (index + 1) * 180;

    let nodeType = "action";
    let label = `Etapa ${key}`;
    let config: any = {};
    const nextSteps: ParsedNode["nextSteps"] = [];

    for (const h of handlers) {
      if (h.handler === "send_message") {
        nodeType = "send_message";
        label = "Enviar Mensagem";
        config = { message: h.params.text || "" };
      } else if (h.handler === "goto") {
        const targetStep = h.params.step;
        const targetType = h.params.type;
        if (targetType !== "finish") {
          nextSteps.push({ targetStep });
        }
      } else if (h.handler === "waits") {
        const conditions = h.params.conditions || [];
        if (conditions.length === 1 && conditions[0].event?.source === "timer") {
          nodeType = "delay";
          const delaySec = conditions[0].event.delay || 0;
          let delayValue = delaySec;
          let delayUnit = "seconds";
          if (delaySec >= 86400 && delaySec % 86400 === 0) {
            delayValue = delaySec / 86400;
            delayUnit = "days";
          } else if (delaySec >= 3600 && delaySec % 3600 === 0) {
            delayValue = delaySec / 3600;
            delayUnit = "hours";
          } else if (delaySec >= 60 && delaySec % 60 === 0) {
            delayValue = delaySec / 60;
            delayUnit = "minutes";
          }
          label = "Aguardar";
          config = { amount: String(delayValue), unit: delayUnit };
          const action = conditions[0].action;
          if (action) nextSteps.push({ targetStep: action.step });
        } else {
          nodeType = "wait_response";
          label = "Aguardar Resposta";
          const timeoutCond = conditions.find((c: any) => c.event?.source === "timer");
          const responseCond = conditions.find((c: any) => c.event?.source === "message");

          if (timeoutCond) {
            const delaySec = timeoutCond.event.delay || 0;
            let timeoutValue = delaySec;
            let timeoutUnit = "seconds";
            if (delaySec >= 86400 && delaySec % 86400 === 0) {
              timeoutValue = delaySec / 86400;
              timeoutUnit = "days";
            } else if (delaySec >= 3600 && delaySec % 3600 === 0) {
              timeoutValue = delaySec / 3600;
              timeoutUnit = "hours";
            } else if (delaySec >= 60 && delaySec % 60 === 0) {
              timeoutValue = delaySec / 60;
              timeoutUnit = "minutes";
            }
            config = { ...config, timeout_amount: String(timeoutValue), timeout_unit: timeoutUnit };
            if (timeoutCond.action) {
              nextSteps.push({ targetStep: timeoutCond.action.step, handleId: "timeout", label: "Timeout" });
            }
          }
          if (responseCond?.action) {
            nextSteps.push({ targetStep: responseCond.action.step, handleId: "responded", label: "Resposta" });
          }
        }
      } else if (h.handler === "action") {
        if (h.params.name === "change_status") {
          nodeType = "crm_move";
          label = "Mover no CRM";
          config = {
            kommo_pipeline_id: h.params.params?.pipeline_id,
            kommo_status_id: h.params.params?.value,
          };
          crmReferences.push({
            nodeIndex: index,
            kommo_pipeline_id: h.params.params?.pipeline_id,
            kommo_status_id: h.params.params?.value,
            stepKey: key,
          });
        } else {
          label = `Ação: ${h.params.name}`;
          config = { kommo_action: h.params };
          warnings.push(`Etapa ${key}: Ação "${h.params.name}" não tem equivalente direto — importada como nó de Ação genérico.`);
        }
      }
    }

    nodes.push({ tempId, type: nodeType, label, config, posY, nextSteps });
  });

  return { name: "Automação Importada (Kommo)", nodes, warnings, stepKeyToIndex, crmReferences };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface FunnelData {
  id: string;
  name: string;
  stages: { id: string; name: string; order_position: number }[];
}

export function KommoImportDialog({ open, onOpenChange, onImported }: Props) {
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [automationName, setAutomationName] = useState("");
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [step, setStep] = useState<"upload" | "crm_mapping" | "confirm">("upload");

  // CRM mapping state
  const [funnels, setFunnels] = useState<FunnelData[]>([]);
  const [crmMappings, setCrmMappings] = useState<Record<number, { funnel_id: string; stage_id: string }>>({});

  useEffect(() => {
    if (!open || !currentOrganization?.id) return;
    (async () => {
      const [funnelsRes, stagesRes] = await Promise.all([
        (supabase as any).from("funnels").select("id, name").eq("organization_id", currentOrganization.id),
        (supabase as any).from("funnel_stages").select("id, name, funnel_id, order_position").eq("organization_id", currentOrganization.id).order("order_position"),
      ]);
      const funnelList = (funnelsRes.data || []).map((f: any) => ({
        ...f,
        stages: (stagesRes.data || []).filter((s: any) => s.funnel_id === f.id),
      }));
      setFunnels(funnelList);
    })();
  }, [open, currentOrganization?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as KommoData;
        const result = parseKommoJson(data);
        setPreview(result);
        setAutomationName(result.name);
        if (result.crmReferences.length > 0) {
          setStep("crm_mapping");
        } else {
          setStep("confirm");
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Erro ao ler arquivo", description: err.message });
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!preview || !currentOrganization?.id || !automationName.trim()) return;
    setImporting(true);

    try {
      // Apply CRM mappings to nodes
      for (const ref of preview.crmReferences) {
        const mapping = crmMappings[ref.nodeIndex];
        if (mapping) {
          preview.nodes[ref.nodeIndex].config = {
            ...preview.nodes[ref.nodeIndex].config,
            funnel_id: mapping.funnel_id,
            stage_id: mapping.stage_id,
          };
        }
      }

      const { data: userData } = await supabase.auth.getUser();
      const { data: automation, error: autoErr } = await (supabase as any)
        .from("automations")
        .insert({
          name: automationName.trim(),
          description: `Importada do Kommo (${fileName})`,
          trigger_type: "manual",
          organization_id: currentOrganization.id,
          created_by: userData.user?.id,
        })
        .select("id")
        .single();

      if (autoErr) throw autoErr;
      const automationId = automation.id;

      const triggerNodeId = crypto.randomUUID();
      const nodeIdMap: Record<string, string> = {};

      const allNodes = [
        {
          id: triggerNodeId,
          automation_id: automationId,
          organization_id: currentOrganization.id,
          node_type: "trigger",
          position_x: 400,
          position_y: 50,
          config: {},
          label: "Gatilho",
        },
      ];

      preview.nodes.forEach((n) => {
        const nodeId = crypto.randomUUID();
        nodeIdMap[n.tempId] = nodeId;
        allNodes.push({
          id: nodeId,
          automation_id: automationId,
          organization_id: currentOrganization.id,
          node_type: n.type,
          position_x: 400,
          position_y: n.posY + 50,
          config: n.config,
          label: n.label,
        });
      });

      const { error: nodesErr } = await (supabase as any).from("automation_nodes").insert(allNodes);
      if (nodesErr) throw nodesErr;

      const allEdges: any[] = [];

      if (preview.nodes.length > 0) {
        allEdges.push({
          id: crypto.randomUUID(),
          automation_id: automationId,
          organization_id: currentOrganization.id,
          source_node_id: triggerNodeId,
          target_node_id: nodeIdMap[preview.nodes[0].tempId],
          source_handle_id: null,
          condition_label: null,
          condition_value: null,
        });
      }

      preview.nodes.forEach((node) => {
        if (node.nextSteps.length > 0) {
          node.nextSteps.forEach((next) => {
            const targetNodeIndex = preview.stepKeyToIndex?.[next.targetStep];
            const targetParsedNode = targetNodeIndex !== undefined ? preview.nodes[targetNodeIndex] : undefined;
            if (targetParsedNode && nodeIdMap[targetParsedNode.tempId]) {
              allEdges.push({
                id: crypto.randomUUID(),
                automation_id: automationId,
                organization_id: currentOrganization.id,
                source_node_id: nodeIdMap[node.tempId],
                target_node_id: nodeIdMap[targetParsedNode.tempId],
                source_handle_id: next.handleId || null,
                condition_label: next.label || null,
                condition_value: null,
              });
            }
          });
        } else {
          // If no explicit nextSteps, connect sequentially to the next node
          const currentIndex = preview.nodes.indexOf(node);
          const nextNode = preview.nodes[currentIndex + 1];
          if (nextNode && nodeIdMap[nextNode.tempId] && node.type !== "wait_response") {
            // Don't auto-connect if already has edges from nextSteps
            const alreadyHasEdge = allEdges.some(e => e.source_node_id === nodeIdMap[node.tempId]);
            if (!alreadyHasEdge) {
              allEdges.push({
                id: crypto.randomUUID(),
                automation_id: automationId,
                organization_id: currentOrganization.id,
                source_node_id: nodeIdMap[node.tempId],
                target_node_id: nodeIdMap[nextNode.tempId],
                source_handle_id: null,
                condition_label: null,
                condition_value: null,
              });
            }
          }
        }
      });

      if (allEdges.length > 0) {
        const { error: edgesErr } = await (supabase as any).from("automation_edges").insert(allEdges);
        if (edgesErr) throw edgesErr;
      }

      toast({ title: "Automação importada com sucesso!" });
      onImported();
      onOpenChange(false);
      navigate(`/automations/${automationId}`);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao importar", description: err.message });
    } finally {
      setImporting(false);
    }
  };

  const resetState = () => {
    setPreview(null);
    setFileName("");
    setAutomationName("");
    setStep("upload");
    setCrmMappings({});
  };

  const allCrmMapped = preview?.crmReferences.every((ref) => {
    const m = crmMappings[ref.nodeIndex];
    return m?.funnel_id && m?.stage_id;
  }) ?? true;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Automação (Kommo)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-2">
              <Label>Arquivo JSON do Kommo</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {fileName ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileJson className="h-5 w-5 text-primary" />
                    <span className="font-medium">{fileName}</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Clique para selecionar o arquivo JSON
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: CRM Mapping */}
          {step === "crm_mapping" && preview && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da automação</Label>
                <Input
                  value={automationName}
                  onChange={(e) => setAutomationName(e.target.value)}
                  placeholder="Nome da automação importada"
                />
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Nós de CRM detectados — vincule ao funil correto
                </p>
                <p className="text-[10px] text-muted-foreground">
                  A automação do Kommo contém ações de "Mover no CRM". Selecione o funil e etapa correspondente para cada uma.
                </p>
              </div>

              <ScrollArea className="max-h-60">
                <div className="space-y-4">
                  {preview.crmReferences.map((ref) => {
                    const mapping = crmMappings[ref.nodeIndex] || { funnel_id: "", stage_id: "" };
                    const selectedFunnel = funnels.find(f => f.id === mapping.funnel_id);

                    return (
                      <div key={ref.nodeIndex} className="p-3 rounded-lg border border-border space-y-2">
                        <p className="text-xs font-medium">
                          Etapa {ref.stepKey} — Mover no CRM
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Kommo pipeline: {ref.kommo_pipeline_id}, status: {ref.kommo_status_id}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Funil</Label>
                            <Select
                              value={mapping.funnel_id}
                              onValueChange={(v) =>
                                setCrmMappings((prev) => ({
                                  ...prev,
                                  [ref.nodeIndex]: { funnel_id: v, stage_id: "" },
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {funnels.map((f) => (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px]">Etapa</Label>
                            <Select
                              value={mapping.stage_id}
                              onValueChange={(v) =>
                                setCrmMappings((prev) => ({
                                  ...prev,
                                  [ref.nodeIndex]: { ...prev[ref.nodeIndex], stage_id: v },
                                }))
                              }
                              disabled={!mapping.funnel_id}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {(selectedFunnel?.stages || []).map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {preview.nodes.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {preview.nodes.length} nós detectados
                  </Label>
                  <ScrollArea className="h-32 border border-border rounded-lg p-3">
                    <div className="space-y-1.5">
                      {preview.nodes.map((n, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm px-2 py-1 rounded-md bg-muted/50">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                          <span className="text-xs font-medium">{n.label}</span>
                          <span className="text-muted-foreground text-[10px]">({n.type})</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {preview.warnings.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Avisos ({preview.warnings.length})
                  </Label>
                  <ScrollArea className="h-20 border border-amber-500/20 bg-amber-500/5 rounded-lg p-3">
                    <div className="space-y-1">
                      {preview.warnings.map((w, i) => (
                        <p key={i} className="text-[10px] text-amber-600 dark:text-amber-400">• {w}</p>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm (no CRM refs) */}
          {step === "confirm" && preview && (
            <>
              <div className="space-y-2">
                <Label>Nome da automação</Label>
                <Input
                  value={automationName}
                  onChange={(e) => setAutomationName(e.target.value)}
                  placeholder="Nome da automação importada"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {preview.nodes.length} nós detectados
                </Label>
                <ScrollArea className="h-40 border border-border rounded-lg p-3">
                  <div className="space-y-2">
                    {preview.nodes.map((n, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md bg-muted/50">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span className="font-medium">{n.label}</span>
                        <span className="text-muted-foreground text-xs">({n.type})</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {preview.warnings.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Avisos ({preview.warnings.length})
                  </Label>
                  <ScrollArea className="h-28 border border-amber-500/20 bg-amber-500/5 rounded-lg p-3">
                    <div className="space-y-1.5">
                      {preview.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-600 dark:text-amber-400">• {w}</p>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetState(); onOpenChange(false); }}>
            Cancelar
          </Button>
          {step === "crm_mapping" && (
            <Button
              onClick={handleImport}
              disabled={!allCrmMapped || !automationName.trim() || importing}
              className="gap-1.5"
            >
              {importing ? "Importando..." : "Importar"}
              {!importing && <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          )}
          {step === "confirm" && (
            <Button
              onClick={handleImport}
              disabled={!preview || !automationName.trim() || importing}
            >
              {importing ? "Importando..." : "Importar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
