import Dagre from "@dagrejs/dagre";
import { MarkerType, Node, Edge } from "@xyflow/react";
import { MessageSquare, Image, Filter, Signpost, Clock, ArrowRightLeft, Zap, Code2, PenLine, BarChart3, Mic, FileText, Video, MessageSquareShare, HelpCircle, UserPlus, MessageCircle, Users2, GitBranch, PhoneCall, CalendarPlus, Bot, ShieldOff, DollarSign, RefreshCw, Brain, MessageSquareHeart, Send, Globe, Shuffle, Heart, Mail, Bell, Clock3, Tag, Phone } from "lucide-react";
import { TriggerNode } from "../nodes/TriggerNode";
import { SendMessageNode } from "../nodes/SendMessageNode";
import { ConditionNode } from "../nodes/ConditionNode";
import { DelayNode } from "../nodes/DelayNode";
import { AskQuestionNode } from "../nodes/AskQuestionNode";
import { CrmMoveNode } from "../nodes/CrmMoveNode";
import { ActionNode } from "../nodes/ActionNode";
import { WaitResponseNode } from "../nodes/WaitResponseNode";
import { SendImageNode, SendAudioNode, SendDocumentNode, SendVideoNode } from "../nodes/SendMediaNode";
import { AgendaNode } from "../nodes/AgendaNode";
import { BotToggleNode } from "../nodes/BotToggleNode";
import { FinanceiroNode } from "../nodes/FinanceiroNode";
import { LoopNode } from "../nodes/LoopNode";
import { StopBotNode } from "../nodes/StopBotNode";
import { CaptureInfoNode } from "../nodes/CaptureInfoNode";
import { HttpRequestNode } from "../nodes/HttpRequestNode";
import { CodeNode } from "../nodes/CodeNode";
import { EditFieldsNode } from "../nodes/EditFieldsNode";
import { FilterNode } from "../nodes/FilterNode";
import { RouterNode } from "../nodes/RouterNode";
import { AIAgentNode } from "../nodes/AIAgentNode";
import { SendAIResponseNode } from "../nodes/SendAIResponseNode";
import { FollowUpAINode } from "../nodes/FollowUpAINode";
import { IntentRouterNode } from "../nodes/IntentRouterNode";
import { CheckSenderNode } from "../nodes/CheckSenderNode";
import { MarketingNode } from "../nodes/MarketingNode";
import { WhatsAppListsNode } from "../nodes/WhatsAppListsNode";
import { SendMetaTemplateNode } from "../nodes/SendMetaTemplateNode";
import { ABTestNode } from "../nodes/ABTestNode";
import { ReactMessageNode } from "../nodes/ReactMessageNode";
import { SendEmailNode } from "../nodes/SendEmailNode";
import { InternalNotificationNode } from "../nodes/InternalNotificationNode";
import { BusinessHoursNode } from "../nodes/BusinessHoursNode";
import { CheckTagNode } from "../nodes/CheckTagNode";
import { SendToNumberNode } from "../nodes/SendToNumberNode";
import { NodeToolbar } from "../NodeToolbar";
import { DeletableEdge } from "../edges/DeletableEdge";


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
  check_sender: CheckSenderNode,
  marketing_data: MarketingNode,
  wa_lists: WhatsAppListsNode,
  send_meta_template: SendMetaTemplateNode,
  ab_test: ABTestNode,
  react_message: ReactMessageNode,
  send_email: SendEmailNode,
  internal_notification: InternalNotificationNode,
  business_hours: BusinessHoursNode,
  check_tag: CheckTagNode,
  send_to_number: SendToNumberNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

const defaultEdgeOptions = {
  type: "deletable",
  animated: true,
  style: {
    stroke: "hsl(var(--primary))",
    strokeWidth: 2.5,
    filter: "drop-shadow(0 0 4px hsl(var(--primary) / 0.6))"
  },
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

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidUUID = (id: string) => UUID_REGEX.test(id);

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
  check_sender: "Checar Número Remetente",
  marketing_data: "Dados de Marketing (Meta)",
  wa_lists: "Listas (WhatsApp API)",
  send_meta_template: "Enviar Template (Meta)",
  ab_test: "Teste A/B",
  react_message: "Reagir à Mensagem",
  send_email: "Enviar E-mail",
  internal_notification: "Notificação Interna",
  business_hours: "Horário Comercial",
  check_tag: "Verificar Tag",
  send_to_number: "Enviar para Número",
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
      { type: "send_meta_template", label: "Enviar Template (Meta)", icon: MessageSquareShare },
      { type: "send_to_number", label: "Enviar para Número", icon: Phone },
    ],
  },
  {
    label: "Interação",
    locked: false,
    items: [
      { type: "ask_question", label: "Fazer Pergunta", icon: HelpCircle },
      { type: "capture_info", label: "Capturar Informação", icon: UserPlus },
      { type: "wait_response", label: "Aguardar Resposta", icon: MessageCircle },
      { type: "react_message", label: "Reagir à Mensagem", icon: Heart },
      { type: "wa_lists", label: "Listas (WhatsApp API)", icon: Users2 },
    ],
  },
  {
    label: "Lógica",
    locked: false,
    items: [
      { type: "condition", label: "Condição", icon: GitBranch },
      { type: "check_sender", label: "Checar Numero Remetente", icon: PhoneCall },
      { type: "filter", label: "Filtro", icon: Filter },
      { type: "router", label: "Caminho", icon: Signpost },
      { type: "ab_test", label: "Teste A/B", icon: Shuffle },
      { type: "business_hours", label: "Horário Comercial", icon: Clock3 },
      { type: "check_tag", label: "Verificar Tag", icon: Tag },
      { type: "delay", label: "Aguardar", icon: Clock },
    ],
  },
  {
    label: "CRM & Ações",
    locked: false,
    items: [
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
      { type: "marketing_data", label: "Dados de Marketing", icon: BarChart3 },
      { type: "send_email", label: "Enviar E-mail", icon: Mail },
      { type: "internal_notification", label: "Notificação Interna", icon: Bell },
    ],
  },
];

// Flat list for backward compat
const NODE_OPTIONS = NODE_CATEGORIES.flatMap((c) => c.items);

export { nodeTypes, edgeTypes, defaultEdgeOptions, NODE_LABELS, NODE_CATEGORIES, NODE_OPTIONS, getAutoLayout };
