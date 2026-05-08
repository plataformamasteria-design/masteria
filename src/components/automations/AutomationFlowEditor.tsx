import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Plus, MessageSquare, GitBranch, Clock, HelpCircle, ArrowRightLeft, Zap, MessageCircle, X, Image, Mic, FileText, CalendarPlus, Bot, ShieldOff, DollarSign, UserPlus, Globe, Code2, PenLine, Filter, Signpost, Video, Brain, Send, Lock, History, RefreshCw, MessageSquareHeart, LayoutGrid } from "lucide-react";
import Dagre from "@dagrejs/dagre";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { TriggerNode } from "./nodes/TriggerNode";
import { SendMessageNode } from "./nodes/SendMessageNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { DelayNode } from "./nodes/DelayNode";
import { AskQuestionNode } from "./nodes/AskQuestionNode";
import { CrmMoveNode } from "./nodes/CrmMoveNode";
import { ActionNode } from "./nodes/ActionNode";
import { WaitResponseNode } from "./nodes/WaitResponseNode";
import { SendImageNode, SendAudioNode, SendDocumentNode, SendVideoNode } from "./nodes/SendMediaNode";
import { AgendaNode } from "./nodes/AgendaNode";
import { BotToggleNode } from "./nodes/BotToggleNode";
import { FinanceiroNode } from "./nodes/FinanceiroNode";
import { LoopNode } from "./nodes/LoopNode";
import { StopBotNode } from "./nodes/StopBotNode";
import { CaptureInfoNode } from "./nodes/CaptureInfoNode";
import { HttpRequestNode } from "./nodes/HttpRequestNode";
import { CodeNode } from "./nodes/CodeNode";
import { EditFieldsNode } from "./nodes/EditFieldsNode";
import { FilterNode } from "./nodes/FilterNode";
import { RouterNode } from "./nodes/RouterNode";
import { AIAgentNode } from "./nodes/AIAgentNode";
import { SendAIResponseNode } from "./nodes/SendAIResponseNode";
import { FollowUpAINode } from "./nodes/FollowUpAINode";
import { IntentRouterNode } from "./nodes/IntentRouterNode";
import { NodeToolbar } from "./NodeToolbar";
import { DeletableEdge } from "./edges/DeletableEdge";
import { ExecutionHistoryPanel } from "./ExecutionHistoryPanel";
import { AssignUserNode } from "./nodes/assign-user-node";
import { AddNoteNode } from "./nodes/add-note-node";
import { LookupLeadNode } from "./nodes/lookup-lead-node";
import { SendTemplateNode } from "./nodes/send-template-node";

const nodeTypes = {
  trigger: TriggerNode,
  send_message: SendMessageNode,
  condition: ConditionNode,
  delay: DelayNode,
  ask_question: AskQuestionNode,
  crm_move: CrmMoveNode,
  action: ActionNode,
  wait_response: WaitResponseNode,
  send_image: SendImageNode,
  send_audio: SendAudioNode,
  send_document: SendDocumentNode,
  send_video: SendVideoNode,
  agenda: AgendaNode,
  bot_toggle: BotToggleNode,
  financeiro: FinanceiroNode,
  loop_restart: LoopNode,
  stop_bot: StopBotNode,
  capture_info: CaptureInfoNode,
  http_request: HttpRequestNode,
  code: CodeNode,
  edit_fields: EditFieldsNode,
  filter: FilterNode,
  router: RouterNode,
  ai_agent: AIAgentNode,
  follow_up_ai: FollowUpAINode,
  intent_router: IntentRouterNode,
  send_ai_response: SendAIResponseNode,
  assign_user: AssignUserNode,
  add_note: AddNoteNode,
  lookup_lead: LookupLeadNode,
  send_template: SendTemplateNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

const defaultEdgeOptions = {
  type: "deletable",
  animated: true,
  style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
  interactionWidth: 20,
};

const getAutoLayout = (nodes: Node[], edges: Edge[], direction: "TB" | "LR" = "TB") => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 80, ranksep: 120, edgesep: 40 });

  nodes.forEach((node) => {
    const width = node.type === "ai_agent" || node.type === "follow_up_ai" ? 340 : 280;
    const height = 150;
    g.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  Dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const width = node.type === "ai_agent" || node.type === "follow_up_ai" ? 340 : 280;
    return {
      ...node,
      position: { x: pos.x - width / 2, y: pos.y - 75 },
    };
  });
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);

const NODE_LABELS: Record<string, string> = {
  send_message: "Enviar Mensagem",
  condition: "Condição",
  delay: "Aguardar",
  ask_question: "Fazer Pergunta",
  crm_move: "Mover no CRM",
  action: "Ação",
  wait_response: "Aguardar Resposta",
  send_image: "Enviar Imagem",
  send_audio: "Enviar Áudio",
  send_document: "Enviar Documento",
  send_video: "Enviar Vídeo",
  agenda: "Criar Evento",
  bot_toggle: "Robô I.A",
  financeiro: "Financeiro",
  loop_restart: "Loop (Reiniciar)",
  stop_bot: "Parar Automação",
  capture_info: "Capturar Informação",
  http_request: "HTTP Request",
  code: "Código",
  edit_fields: "Edit Fields",
  filter: "Filtro",
  router: "Caminho",
  ai_agent: "Agente I.A",
  follow_up_ai: "Follow Up I.A",
  intent_router: "Classificador de Intenções",
  send_ai_response: "Enviar Resposta I.A",
  assign_user: "Atribuição",
  add_note: "Adicionar Nota",
  lookup_lead: "Consultar Lead",
  send_template: "Template WhatsApp",
};

const NODE_CATEGORIES = [
  {
    label: "Mensagens",
    locked: false,
    items: [
      { type: "send_message", label: "Enviar Mensagem", icon: MessageSquare },
      { type: "send_image", label: "Enviar Imagem", icon: Image },
      { type: "send_audio", label: "Enviar Áudio", icon: Mic },
      { type: "send_document", label: "Enviar Documento", icon: FileText },
      { type: "send_video", label: "Enviar Vídeo", icon: Video },
      { type: "send_template", label: "Template WhatsApp", icon: MessageSquare },
    ],
  },
  {
    label: "Interação",
    locked: false,
    items: [
      { type: "ask_question", label: "Fazer Pergunta", icon: HelpCircle },
      { type: "capture_info", label: "Capturar Informação", icon: UserPlus },
      { type: "wait_response", label: "Aguardar Resposta", icon: MessageCircle },
      { type: "lookup_lead", label: "Consultar Lead", icon: UserPlus },
    ],
  },
  {
    label: "Lógica",
    locked: false,
    items: [
      { type: "condition", label: "Condição", icon: GitBranch },
      { type: "filter", label: "Filtro", icon: Filter },
      { type: "router", label: "Caminho", icon: Signpost },
      { type: "delay", label: "Aguardar", icon: Clock },
    ],
  },
  {
    label: "CRM & Ações",
    locked: false,
    items: [
      { type: "assign_user", label: "Atribuição", icon: UserPlus },
      { type: "add_note", label: "Adicionar Nota", icon: FileText },
      { type: "crm_move", label: "Mover no CRM", icon: ArrowRightLeft },
      { type: "action", label: "Ação", icon: Zap },
      { type: "agenda", label: "Criar Evento", icon: CalendarPlus },
      { type: "bot_toggle", label: "Robô I.A", icon: Bot },
      { type: "stop_bot", label: "Parar Automação", icon: ShieldOff },
      { type: "financeiro", label: "Financeiro", icon: DollarSign },
      { type: "loop_restart", label: "Loop (Reiniciar)", icon: RefreshCw },
    ],
  },
  {
    label: "Inteligência I.A",
    locked: true,
    items: [
      { type: "ai_agent", label: "Agente I.A", icon: Brain },
      { type: "intent_router", label: "Classificador de Intenções", icon: Signpost },
      { type: "follow_up_ai", label: "Follow Up I.A", icon: MessageSquareHeart },
      { type: "send_ai_response", label: "Enviar Resposta I.A", icon: Send },
    ],
  },
  {
    label: "Avançado",
    locked: true, // requires atendente_ia module
    items: [
      { type: "http_request", label: "HTTP Request", icon: Globe },
      { type: "code", label: "Código", icon: Code2 },
      { type: "edit_fields", label: "Edit Fields", icon: PenLine },
    ],
  },
];

// Flat list for backward compat
const NODE_OPTIONS = NODE_CATEGORIES.flatMap((c) => c.items);

function AutomationFlowEditorInner() {
  const params = useParams();
  const automationId = params?.id as string;
  const router = useRouter();
  const navigate = router.push;
  const { currentOrganization } = useOrganization();
  const { canUseAIAutomation } = useModuleAccess();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [automationName, setAutomationName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nodeStats, setNodeStats] = useState<Record<string, { total_reached: number; total_responded: number; responses: any }>>({});
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, any>>({});
  const [pinnedOutputs, setPinnedOutputs] = useState<Set<string>>(new Set());
  const [executingNodes, setExecutingNodes] = useState<Set<string>>(new Set());
  const [nodeErrors, setNodeErrors] = useState<Record<string, string | null>>({});
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const connectingFrom = useRef<{ nodeId: string; handleId?: string | null } | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{
    x: number;
    y: number;
    sourceNodeId: string;
    sourceHandleId?: string | null;
  } | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  const hasLoadedFlowRef = useRef(false);

  const fetchNodeStats = useCallback(async () => {
    // Disabled stats temporarily for App transposition
    setNodeStats({});
  }, [automationId, currentOrganization?.id]);

  useEffect(() => {
    if (!automationId || !currentOrganization?.id || hasLoadedFlowRef.current) return;
    hasLoadedFlowRef.current = true;
    loadFlow();
  }, [automationId, currentOrganization?.id]);

  useEffect(() => {
    if (!automationId || !currentOrganization?.id || !hasLoadedFlowRef.current) return;
    const interval = setInterval(fetchNodeStats, 10000);
    return () => clearInterval(interval);
  }, [automationId, currentOrganization?.id, fetchNodeStats]);

  const loadFlow = async () => {
    if (!automationId || !currentOrganization?.id) return;

    try {
      const { loadAutomationGraph } = await import("@/app/actions/automations-builder");
      const { automation, nodes: dbNodes, edges: dbEdges } = await loadAutomationGraph(automationId);

      if (automation) setAutomationName(automation.name);

      const triggerConfig = {
        trigger_type: automation?.triggerType || "stage_entry",
        webhook_token: automation?.webhookToken || null,
        schedule_config: automation?.scheduleConfig || null,
      };

      if (dbNodes.length === 0) {
        setNodes([{
          id: "trigger-1",
          type: "trigger",
          position: { x: 400, y: 80 },
          data: { label: "Gatilho", config: triggerConfig },
        }]);
      } else {
        setNodes(dbNodes.map((n: any) => ({
          id: n.id,
          type: n.nodeType,
          position: { x: n.positionX, y: n.positionY },
          data: {
            label: n.label || "",
            config: n.nodeType === "trigger"
              ? { ...(n.config || {}), ...triggerConfig }
              : (n.config || {})
          },
        })));
      }

      setEdges(dbEdges.map((e: any) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        sourceHandle: e.sourceHandleId || undefined,
        label: e.conditionLabel || undefined,
        type: "deletable",
        data: { conditionValue: e.conditionValue },
      })));

      await fetchNodeStats();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, type: "deletable" }, eds));
  }, [setEdges]);

  const onConnectStart = useCallback((_: any, params: any) => {
    connectingFrom.current = { nodeId: params.nodeId, handleId: params.handleId };
  }, []);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    if (!connectingFrom.current) return;
    const target = event.target as HTMLElement;
    if (target.closest('.react-flow__handle')) return;

    const clientX = 'changedTouches' in event ? event.changedTouches[0].clientX : (event as MouseEvent).clientX;
    const clientY = 'changedTouches' in event ? event.changedTouches[0].clientY : (event as MouseEvent).clientY;

    setPendingConnection({
      x: clientX,
      y: clientY,
      sourceNodeId: connectingFrom.current.nodeId,
      sourceHandleId: connectingFrom.current.handleId,
    });
    connectingFrom.current = null;
  }, [screenToFlowPosition]);

  const addNodeAtPosition = useCallback(
    (type: string, screenX?: number, screenY?: number, sourceNodeId?: string, sourceHandleId?: string | null) => {
      const id = `${type}-${Date.now()}`;
      let position: { x: number; y: number };
      if (screenX !== undefined && screenY !== undefined) {
        position = screenToFlowPosition({ x: screenX, y: screenY });
      } else {
        position = { x: 400, y: (nodes.length + 1) * 160 };
      }

      const newNode: Node = {
        id,
        type,
        position,
        data: { label: NODE_LABELS[type] || type, config: {} },
      };
      setNodes((nds) => [...nds, newNode]);

      if (sourceNodeId) {
        setEdges((eds) => [...eds, {
          id: `edge-${Date.now()}`,
          source: sourceNodeId,
          sourceHandle: sourceHandleId || undefined,
          target: id,
          type: "deletable",
        }]);
      }
    },
    [nodes.length, setNodes, setEdges, screenToFlowPosition]
  );

  const addNode = useCallback((type: string) => { addNodeAtPosition(type); }, [addNodeAtPosition]);

  const onDeleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [setEdges]);

  const onNodeDataChange = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n));
  }, [setNodes]);

  const onAutoLayout = useCallback(() => {
    setNodes((nds) => {
      const layouted = getAutoLayout([...nds], edges);
      return layouted;
    });
    toast({ title: "Layout organizado automaticamente!" });
  }, [setNodes, edges]);

  const onRenameNode = useCallback((nodeId: string, newLabel: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n));
  }, [setNodes]);

  const onDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  const onDuplicateNode = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const original = nds.find((n) => n.id === nodeId);
      if (!original) return nds;
      const newId = `${original.type}-${Date.now()}`;
      const newNode: Node = {
        id: newId,
        type: original.type,
        position: { x: (original.position?.x || 0) + 50, y: (original.position?.y || 0) + 80 },
        data: { ...JSON.parse(JSON.stringify(original.data)) },
      };
      return [...nds, newNode];
    });
  }, [setNodes]);

  const onExecuteNode = useCallback(async (nodeId: string, testLead?: any) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setExecutingNodes((prev) => new Set(prev).add(nodeId));
    setNodeErrors((prev) => ({ ...prev, [nodeId]: null }));
    setNodeOutputs((prev) => { const next = { ...prev }; delete next[nodeId]; return next; });

    try {
      const config = (node.data as any)?.config || {};
      const nodeType = node.type;
      let result: any = null;

      // === Nodes that send real messages to lead via Evolution API ===
      const SEND_NODES = new Set(["send_message", "send_image", "send_audio", "send_document", "send_video", "send_ai_response", "ask_question"]);

      if (SEND_NODES.has(nodeType || "") && testLead) {
        const orgId = currentOrganization?.id;
        if (!orgId) throw new Error("Organização não encontrada");

        // Fetch custom field values for variable interpolation
        const variableData: Record<string, string> = {
          nome: testLead.name || "",
          telefone: testLead.phone || "",
        };

        try {
          const { data: fieldValues } = await (supabase as any)
            .from("chat_custom_field_values")
            .select("field_id, value, chat_custom_fields!inner(field_key)")
            .eq("chat_id", testLead.id)
            .eq("organization_id", orgId);

          if (fieldValues) {
            for (const fv of fieldValues) {
              const key = fv.chat_custom_fields?.field_key;
              if (key && fv.value) variableData[key] = fv.value;
            }
          }
        } catch (e) {
          console.log("Could not fetch custom fields for interpolation:", e);
        }

        // Variable interpolation function
        const interpolate = (text: string): string => {
          return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
            const trimmedKey = key.trim();
            return variableData[trimmedKey] ?? match;
          });
        };

        let messagesToSend: { content: string; message_type: string; file_url?: string; file_name?: string }[] = [];

        if (nodeType === "send_message") {
          const msg = interpolate(config.message || "");
          if (!msg) throw new Error("Mensagem não configurada");
          messagesToSend = [{ content: msg, message_type: "text" }];
        } else if (nodeType === "ask_question") {
          const question = interpolate(config.question || "");
          if (!question) throw new Error("Pergunta não configurada");
          const options = (config.options || []).filter((o: any) => o?.text);
          const fullMsg = options.length > 0
            ? `${question}\n\n${options.map((o: any, i: number) => `${i + 1}. ${interpolate(o.text)}`).join("\n")}`
            : question;
          messagesToSend = [{ content: fullMsg, message_type: "text" }];
        } else if (["send_image", "send_audio", "send_document", "send_video"].includes(nodeType || "")) {
          const fileUrl = config.file_url || config.string_source || "";
          if (!fileUrl) throw new Error("Arquivo/URL não configurado");
          const typeMap: Record<string, string> = { send_image: "image", send_audio: "audio", send_document: "document", send_video: "video" };
          messagesToSend = [{ content: interpolate(config.caption || ""), message_type: typeMap[nodeType!] || "document", file_url: fileUrl, file_name: config.file_name || "" }];
        } else if (nodeType === "send_ai_response") {
          // Get the AI agent output from allNodeOutputs
          const sourceNodeId = config.source_ai_node_id;
          if (!sourceNodeId) throw new Error("Nó de Agente I.A não selecionado");
          const aiOutput = nodeOutputs[sourceNodeId];
          if (!aiOutput?.output) throw new Error("Execute o nó de Agente I.A primeiro para gerar o output");

          const rawText = typeof aiOutput.output === "string" ? aiOutput.output : (aiOutput.output?.toString?.() || JSON.stringify(aiOutput.output));
          const AI_SPLIT_DELIMITER = "⌁⌁⌁";
          const splitEnabled = config.split_enabled ?? true;

          if (splitEnabled) {
            if (rawText.includes(AI_SPLIT_DELIMITER)) {
              const parts = rawText.split(AI_SPLIT_DELIMITER).map((p: string) => p.trim()).filter(Boolean);
              messagesToSend = parts.map((p: string) => ({ content: p, message_type: "text" }));
            } else {
              // Fallback: split by line breaks when delimiter is missing
              const fallbackParts = rawText
                .split(/\n+/)
                .map((p: string) => p.replace(/\s+/g, " ").trim())
                .filter(Boolean);

              messagesToSend = (fallbackParts.length > 1 ? fallbackParts : [rawText.trim()])
                .map((p: string) => ({ content: p, message_type: "text" }));
            }
          } else {
            messagesToSend = [{ content: rawText, message_type: "text" }];
          }
        }

        if (messagesToSend.length === 0) throw new Error("Nenhuma mensagem para enviar");

        const delaySeconds = config.delay_seconds ?? 2;
        const sentMessages: any[] = [];

        for (let i = 0; i < messagesToSend.length; i++) {
          const msg = messagesToSend[i];

          // Add delay between split messages (not the first one)
          if (i > 0 && delaySeconds > 0) {
            await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
          }

          const sendBody: any = {
            organization_id: orgId,
            phone: testLead.phone,
            message: msg.content,
            message_type: msg.message_type,
          };
          if (msg.file_url) sendBody.file_url = msg.file_url;
          if (msg.file_name) sendBody.file_name = msg.file_name;

          const { data: sendData, error: sendError } = await supabase.functions.invoke("send-to-evolution", { body: sendBody });

          sentMessages.push({
            text: msg.content?.slice(0, 80) + (msg.content && msg.content.length > 80 ? "..." : ""),
            delivered: !sendError && !sendData?.error,
            delay: i > 0 ? `+${(i * delaySeconds).toFixed(1)}s` : "0s",
            error: sendError?.message || sendData?.error || null,
          });
        }

        const allDelivered = sentMessages.every((m) => m.delivered);
        result = {
          status: allDelivered ? "sent" : "partial",
          lead: { name: testLead.name, phone: testLead.phone },
          messages_sent: sentMessages.length,
          messages: sentMessages,
          message: allDelivered
            ? `✅ ${sentMessages.length} mensagem(ns) enviada(s) para ${testLead.name}`
            : `⚠ Algumas mensagens falharam`,
        };

      } else if (nodeType === "http_request") {
        // Execute HTTP request via edge function proxy to avoid CORS
        const method = config.method || "GET";
        const url = config.url || "";
        if (!url) throw new Error("URL não configurada");

        const proxyHeaders: Record<string, string> = {};
        if (config.send_headers) {
          if (config.headers_mode === "json") {
            try { Object.assign(proxyHeaders, JSON.parse(config.headers_json || "{}")); } catch { }
          } else {
            (config.headers || []).forEach((h: any) => { if (h.name) proxyHeaders[h.name] = h.value; });
          }
        }

        if (config.auth_type === "bearer" && config.auth_config?.token) {
          proxyHeaders["Authorization"] = `Bearer ${config.auth_config.token}`;
        } else if (config.auth_type === "basic" && config.auth_config?.username) {
          proxyHeaders["Authorization"] = `Basic ${btoa(`${config.auth_config.username}:${config.auth_config.password || ""}`)}`;
        } else if (config.auth_type === "api_key" && config.auth_config?.key) {
          const headerName = config.auth_config.header_name || "Authorization";
          const prefix = config.auth_config.prefix ? `${config.auth_config.prefix} ` : "";
          proxyHeaders[headerName] = `${prefix}${config.auth_config.key}`;
        }

        let finalUrl = url;
        if (config.send_query_params) {
          const params = new URLSearchParams();
          if (config.query_params_mode === "json") {
            try {
              const qp = JSON.parse(config.query_params_json || "{}");
              Object.entries(qp).forEach(([k, v]) => params.set(k, String(v)));
            } catch { }
          } else {
            (config.query_params || []).forEach((p: any) => { if (p.name) params.set(p.name, p.value); });
          }
          const qs = params.toString();
          if (qs) finalUrl += (finalUrl.includes("?") ? "&" : "?") + qs;
        }

        let body: string | undefined;
        if (config.send_body && !["GET", "HEAD"].includes(method)) {
          if (config.body_mode === "json" || config.body_content_type === "raw") {
            body = config.body_json || "{}";
          } else {
            const bodyObj: Record<string, string> = {};
            (config.body_fields || []).forEach((f: any) => { if (f.name) bodyObj[f.name] = f.value; });
            body = JSON.stringify(bodyObj);
          }
          if (!proxyHeaders["Content-Type"]) proxyHeaders["Content-Type"] = "application/json";
        }

        const { data: proxyData, error: proxyError } = await supabase.functions.invoke("http-proxy", {
          body: { url: finalUrl, method, headers: proxyHeaders, body },
        });

        if (proxyError) throw new Error(proxyError.message || "Erro ao chamar proxy HTTP");
        if (proxyData?.error) throw new Error(proxyData.message || proxyData.error);

        result = proxyData?.data ?? proxyData;
      } else if (nodeType === "code" && config.language === "javascript") {
        try {
          const fn = new Function("input", "context", config.code || "return {};");
          result = fn({}, { chatId: "test", phone: "test", leadName: "test" });
        } catch (e: any) {
          throw new Error(`Erro no código: ${e.message}`);
        }
      } else if (nodeType === "edit_fields") {
        if (config.mode === "json") {
          try { result = JSON.parse(config.json_value || "{}"); } catch { result = {}; }
        } else {
          result = {};
          (config.fields || []).forEach((f: any) => { if (f.name) result[f.name] = f.value; });
        }
      } else if (nodeType === "filter") {
        const conditions = config.conditions || [];
        const matchMode = config.match_mode || "all";
        if (!conditions.length || conditions.every((c: any) => !c.field)) {
          throw new Error("Nenhuma condição configurada");
        }
        result = { status: "ok", conditions_count: conditions.length, match_mode: matchMode, message: "Filtro configurado corretamente" };
      } else if (nodeType === "router") {
        const rules = config.rules || [];
        if (!rules.length || rules.every((r: any) => !r.field)) {
          throw new Error("Nenhuma rota configurada");
        }
        result = {
          status: "ok",
          routes_count: rules.length,
          routes: rules.map((r: any, i: number) => ({
            route: i,
            name: r.renameOutput && r.outputName ? r.outputName : `Rota ${i + 1}`,
            field: r.field,
            operator: r.operator,
            value: r.value,
          })),
          message: "Caminho configurado corretamente",
        };
      } else if (nodeType === "ai_agent") {
        if (!config.credential_id) throw new Error("Credencial não configurada");
        if (!config.prompt && !config.system_message) throw new Error("Prompt ou System Message obrigatório");

        const toolsParsed = (config.tools || []).map((t: any) => {
          let params = {};
          try { params = JSON.parse(t.parameters || "{}"); } catch { }
          return { name: t.name, description: t.description, parameters: params };
        });

        // Inject formatting instruction if format_for_send is enabled
        let systemMessage = config.system_message || "";
        if (config.format_for_send) {
          const formatInstruction = "\n\nIMPORTANTE: Você DEVE retornar a resposta segmentada usando EXATAMENTE o delimitador ⌁⌁⌁ entre cada mensagem (sem variações). Formato obrigatório: mensagem 1⌁⌁⌁mensagem 2⌁⌁⌁mensagem 3. Não use listas numeradas para separar, não use apenas quebra de linha, não coloque o delimitador no início/fim.";
          systemMessage = systemMessage + formatInstruction;
        }

        const { data: agentData, error: agentError } = await supabase.functions.invoke("ai-agent-execute", {
          body: {
            organization_id: currentOrganization?.id,
            credential_id: config.credential_id,
            model: config.model || "gpt-4o-mini",
            system_message: systemMessage,
            prompt: config.prompt || "",
            tools: toolsParsed.length > 0 ? toolsParsed : undefined,
            phone: testLead?.phone || "test",
            chat_id: testLead?.id,
          },
        });
        if (agentError) throw new Error(agentError.message);
        if (agentData?.error) throw new Error(agentData.error);
        result = agentData;
      } else if (nodeType === "intent_router") {
        if (!config.credential_id) throw new Error("Credencial não configurada");
        const intents = config.intents || [];
        if (intents.length === 0) throw new Error("Nenhuma intenção configurada");

        const orgId = currentOrganization?.id;
        const phone = testLead?.phone || "test";

        // Fetch last message for classification if no input provided
        let userMessage = "";
        if (testLead) {
          const { data: lastMsg } = await (supabase as any)
            .from("messages")
            .select("content")
            .eq("chat_id", testLead.id)
            .eq("is_from_user", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          userMessage = lastMsg?.content || "";
        }

        const systemPrompt = `Você é um classificador de intenções ultra-preciso.
Sua tarefa é analisar a mensagem do usuário e categorizá-la em UMA das seguintes intenções: [${intents.join(", ")}].
Se nenhuma das opções for claramente a correta, responda APENAS "fallback".

Instruções Adicionais: ${config.instruction || "Nenhuma"}

REGRAS CRÍTICAS:
- Responda APENAS o nome exato da intenção em MAIÚSCULAS.
- NÃO adicione justificativas, pontuação ou explicações.
- Se estiver em dúvida entre duas, escolha a mais provável.`;

        const { data: intentData, error: intentError } = await supabase.functions.invoke("ai-agent-execute", {
          body: {
            prompt: userMessage || "Olá, tudo bem?",
            system_message: systemPrompt,
            model: config.model || "gpt-4o-mini",
            provider: config.provider || "openai",
            credential_id: config.credential_id,
            organization_id: orgId,
            memory_key: "", // Classification doesn't need long memory
            context_window_length: 0,
            temperature: 0, // Deterministic
            max_iterations: 1,
            enforce_vitta_token_usage: true,
          },
        });

        if (intentError) throw new Error(intentError.message);
        if (intentData?.error) throw new Error(intentData.error);

        const classification = (intentData.output || "").trim().toUpperCase();
        const matchedIntent = intents.find((it: string) => it.toUpperCase() === classification);

        result = {
          classification: matchedIntent || "fallback",
          raw_output: intentData.output,
          usage: intentData.usage,
        };
      } else if (nodeType === "follow_up_ai") {
        if (!config.credential_id) throw new Error("Credencial não configurada");
        const followupPrompt = config.followup_prompt || config.prompt || "";
        if (!followupPrompt) throw new Error("Prompt de follow-up obrigatório");

        const orgId = currentOrganization?.id;
        if (!orgId) throw new Error("Organização não encontrada");

        // If test lead selected, fetch real chat history
        let historyText = "Lead: Oi, gostaria de saber valores\nAtendente: Claro, posso te ajudar\nLead: Vou ver e te retorno";
        if (testLead) {
          try {
            const historyCount = config.history_count || 20;
            const { data: msgs } = await (supabase as any)
              .from("messages")
              .select("content, is_from_user, message_type, created_at")
              .eq("chat_id", testLead.id)
              .eq("organization_id", orgId)
              .eq("private", false)
              .order("created_at", { ascending: false })
              .limit(historyCount);
            if (msgs && msgs.length > 0) {
              historyText = msgs.reverse().map((m: any) => {
                const role = m.is_from_user ? "Atendente" : "Lead";
                return `[${m.created_at}] ${role}: ${m.content || `[${m.message_type}]`}`;
              }).join("\n");
            }
          } catch (e) { console.log("Could not fetch history:", e); }
        }

        let systemMessage = followupPrompt;
        if (config.format_for_send !== false) {
          systemMessage += "\n\nIMPORTANTE: Separe cada parte da resposta usando EXATAMENTE o delimitador ⌁⌁⌁ entre as mensagens.";
        }

        const { data: followData, error: followError } = await supabase.functions.invoke("ai-agent-execute", {
          body: {
            prompt: `Histórico de conversa:\n${historyText}\n\nTarefa: Gere um follow-up curto e personalizado para reengajar esse lead.`,
            system_message: systemMessage,
            model: config.model || "gpt-4o-mini",
            provider: config.provider || "openai",
            credential_id: config.credential_id,
            organization_id: orgId,
            memory_key: "",
            context_window_length: 0,
            temperature: 0.7,
            max_iterations: 2,
            input_data: { mode: "follow_up_test" },
            enforce_vitta_token_usage: true,
          },
        });

        if (followError) throw new Error(followError.message);
        if (followData?.error) throw new Error(followData.error);

        // Send the generated follow-up via WhatsApp if test lead is selected
        const aiOutput = (followData?.output || "").trim();
        if (testLead && aiOutput) {
          const AI_SPLIT_DELIMITER = "⌁⌁⌁";
          const parts = aiOutput.includes(AI_SPLIT_DELIMITER)
            ? aiOutput.split(AI_SPLIT_DELIMITER).map((p: string) => p.trim()).filter(Boolean)
            : aiOutput.split(/\n+/).map((p: string) => p.trim()).filter(Boolean);
          const finalParts = parts.length > 0 ? parts : [aiOutput];

          const sentMessages: any[] = [];
          const delaySeconds = config.delay_seconds ?? 2;

          for (let i = 0; i < finalParts.length; i++) {
            if (i > 0 && delaySeconds > 0) {
              await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
            }

            const sendBody = {
              organization_id: orgId,
              phone: testLead.phone,
              message: finalParts[i],
              message_type: "text",
            };

            const { data: sendData, error: sendError } = await supabase.functions.invoke("send-to-evolution", { body: sendBody });

            sentMessages.push({
              text: finalParts[i].slice(0, 80) + (finalParts[i].length > 80 ? "..." : ""),
              delivered: !sendError && !sendData?.error,
              delay: i > 0 ? `+${(i * delaySeconds).toFixed(1)}s` : "0s",
              error: sendError?.message || sendData?.error || null,
            });
          }

          const allDelivered = sentMessages.every((m) => m.delivered);
          result = {
            ...followData,
            status: allDelivered ? "sent" : "partial",
            lead: { name: testLead.name, phone: testLead.phone },
            messages_sent: sentMessages.length,
            messages: sentMessages,
            message: allDelivered
              ? `✅ Follow-up enviado (${sentMessages.length} parte(s)) para ${testLead.name}`
              : `⚠ Algumas mensagens falharam`,
          };
        } else {
          result = followData;
        }
      } else {
        result = { status: "ok", node_type: nodeType, config_valid: true, message: "Configuração válida" };
      }

      setNodeOutputs((prev) => ({ ...prev, [nodeId]: result }));
    } catch (e: any) {
      setNodeErrors((prev) => ({ ...prev, [nodeId]: e.message || "Erro desconhecido" }));
    } finally {
      setExecutingNodes((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }
  }, [nodes, currentOrganization, nodeOutputs]);

  const onPinOutput = useCallback((nodeId: string) => {
    setPinnedOutputs((prev) => new Set(prev).add(nodeId));
  }, []);

  const onUnpinOutput = useCallback((nodeId: string) => {
    setPinnedOutputs((prev) => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!automationId || !currentOrganization?.id) return;
    setSaving(true);

    try {
      const { saveAutomationGraph } = await import("@/app/actions/automations-builder");

      const triggerNode = nodes.find(n => n.type === "trigger");
      const config = triggerNode?.data?.config as any || {};

      await saveAutomationGraph(
        automationId,
        {
          name: automationName || "Automação",
          triggerConfig: config,
          nodes: nodes,
          edges: edges
        }
      );

      toast({ title: "Fluxo salvo com sucesso!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Carregando fluxo...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background" ref={reactFlowWrapper}>
      <div className="shrink-0 h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 gap-3 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate("/automations")} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">{automationName}</h1>
          <p className="text-[11px] text-muted-foreground">Editor de Fluxo</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onAutoLayout} title="Organizar layout automaticamente">
          <LayoutGrid className="h-3.5 w-3.5" />
          Organizar
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowHistory((p) => !p)}>
          <History className="h-3.5 w-3.5" />
          Execuções
        </Button>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="flex-1 relative flex">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes.map((n) => ({
              ...n,
              dragHandle: ".drag-handle-area",
              data: {
                ...n.data,
                onChange: onNodeDataChange,
                onDelete: onDeleteNode,
                onDuplicate: onDuplicateNode,
                onRename: onRenameNode,
                stats: nodeStats[n.id] || null,
                onExecute: onExecuteNode,
                nodeOutput: nodeOutputs[n.id] || null,
                nodeError: nodeErrors[n.id] || null,
                isExecuting: executingNodes.has(n.id),
                isPinned: pinnedOutputs.has(n.id),
                onPinOutput: onPinOutput,
                onUnpinOutput: onUnpinOutput,
                allNodeOutputs: nodeOutputs,
                allNodes: nodes,
              },
            }))}
            edges={edges.map((e) => ({
              ...e,
              type: "deletable",
              data: { ...((e.data as any) || {}), onDeleteEdge },
            }))}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            deleteKeyCode="Delete"
            className="bg-background"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--muted-foreground) / 0.15)" />
            <Controls className="!bg-card !border-border !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground" />
            <MiniMap className="!bg-card !border-border" nodeColor="hsl(var(--primary))" maskColor="hsl(var(--background) / 0.8)" />
            <Panel position="top-left" className="!m-3">
              <NodeToolbar onAddNode={addNode} canUseAdvanced={canUseAIAutomation} onLockedClick={() => setShowUpgradeDialog(true)} />
            </Panel>
          </ReactFlow>

          {pendingConnection && (
            <div
              className="fixed z-50 bg-card border border-border rounded-xl shadow-2xl w-72 max-h-[70vh] overflow-y-auto"
              style={{
                left: Math.min(pendingConnection.x, window.innerWidth - 300),
                top: Math.min(pendingConnection.y, window.innerHeight - 400),
              }}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-card z-10">
                <span className="text-xs font-semibold text-muted-foreground">Adicionar Nó</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPendingConnection(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              {NODE_CATEGORIES.map((category) => {
                const isLocked = category.locked && !canUseAIAutomation;
                return (
                  <div key={category.label}>
                    <div className="px-3 py-1.5 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{category.label}</span>
                      {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    {isLocked ? (
                      <button
                        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-accent/50 transition-colors text-left"
                        onClick={() => {
                          setPendingConnection(null);
                          setShowUpgradeDialog(true);
                        }}
                      >
                        <div className="h-6 w-6 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Lock className="h-3 w-3 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-[11px] font-medium">Módulo Atendente de I.A</p>
                          <p className="text-[9px] text-muted-foreground">Contrate para desbloquear</p>
                        </div>
                      </button>
                    ) : (
                      category.items.map((opt) => (
                        <button
                          key={opt.type}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent/50 transition-colors text-left"
                          onClick={() => {
                            addNodeAtPosition(opt.type, pendingConnection.x, pendingConnection.y, pendingConnection.sourceNodeId, pendingConnection.sourceHandleId);
                            setPendingConnection(null);
                          }}
                        >
                          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <opt.icon className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-[12px] font-medium">{opt.label}</span>
                        </button>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showHistory && automationId && (
          <ExecutionHistoryPanel automationId={automationId} nodes={nodes} />
        )}
      </div>

      {/* Upgrade Dialog */}
      {showUpgradeDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowUpgradeDialog(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Nós Avançados</h3>
                <p className="text-sm text-muted-foreground">Módulo Atendente de I.A necessário</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Os nós avançados (Agente I.A, Enviar Resposta I.A, HTTP Request, Código e Edit Fields) fazem parte do módulo <strong>Atendente de I.A</strong>.
              Deseja fazer upgrade do seu plano e contratar este módulo?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={() => { setShowUpgradeDialog(false); navigate("/meu-plano"); }} className="gap-1.5">
                <Zap className="h-4 w-4" />
                Ver Meu Plano
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AutomationFlowEditor() {
  return (
    <ReactFlowProvider>
      <AutomationFlowEditorInner />
    </ReactFlowProvider>
  );
}
