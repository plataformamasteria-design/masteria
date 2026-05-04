import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MessageSquare,
  GitBranch,
  Clock,
  HelpCircle,
  ArrowRightLeft,
  Zap,
  MessageCircle,
  Image,
  Mic,
  FileText,
  UserPlus,
  Globe,
  Code2,
  PenLine,
  Brain,
  CalendarPlus,
  Bot,
  DollarSign,
  Filter,
  Signpost,
  Video,
  Send,
  Lock,
  MessageSquareHeart,
} from "lucide-react";

interface NodeToolbarProps {
  onAddNode: (type: string) => void;
  canUseAdvanced?: boolean;
  onLockedClick?: () => void;
}

const categories = [
  {
    label: "Mensagens",
    locked: false,
    items: [
      { type: "send_message", label: "Enviar Mensagem", icon: MessageSquare, description: "Enviar texto ao contato" },
      { type: "send_image", label: "Enviar Imagem", icon: Image, description: "Enviar imagem por URL" },
      { type: "send_audio", label: "Enviar Áudio", icon: Mic, description: "Enviar áudio por URL" },
      { type: "send_document", label: "Enviar Documento", icon: FileText, description: "Enviar PDF ou arquivo" },
      { type: "send_video", label: "Enviar Vídeo", icon: Video, description: "Enviar vídeo por URL" },
    ],
  },
  {
    label: "Interação",
    locked: false,
    items: [
      { type: "ask_question", label: "Fazer Pergunta", icon: HelpCircle, description: "Perguntar e aguardar resposta" },
      { type: "capture_info", label: "Capturar Informação", icon: UserPlus, description: "Captar dados do lead" },
      { type: "wait_response", label: "Aguardar Resposta", icon: MessageCircle, description: "Pausar até responder" },
    ],
  },
  {
    label: "Lógica",
    locked: false,
    items: [
      { type: "condition", label: "Condição", icon: GitBranch, description: "Dividir fluxo por condição" },
      { type: "filter", label: "Filtro", icon: Filter, description: "Filtrar por campo ou código" },
      { type: "router", label: "Caminho", icon: Signpost, description: "Direcionar por rotas" },
      { type: "delay", label: "Aguardar", icon: Clock, description: "Esperar antes de continuar" },
    ],
  },
  {
    label: "CRM & Ações",
    locked: false,
    items: [
      { type: "crm_move", label: "Mover no CRM", icon: ArrowRightLeft, description: "Mover lead no funil" },
      { type: "action", label: "Ação", icon: Zap, description: "Atribuir, taguear, notificar" },
      { type: "agenda", label: "Criar Evento", icon: CalendarPlus, description: "Agendar na agenda" },
      { type: "bot_toggle", label: "Robô I.A", icon: Bot, description: "Ativar/desativar bot" },
      { type: "financeiro", label: "Financeiro", icon: DollarSign, description: "Criar transação" },
    ],
  },
  {
    label: "Avançado",
    locked: true,
    items: [
      { type: "ai_agent", label: "Agente I.A", icon: Brain, description: "Agente com memória e tools" },
      { type: "follow_up_ai", label: "Follow Up I.A", icon: MessageSquareHeart, description: "Follow-up inteligente com timeout e saídas respondeu/não respondeu" },
      { type: "send_ai_response", label: "Enviar Resposta I.A", icon: Send, description: "Enviar resposta do agente ao lead" },
      { type: "http_request", label: "HTTP Request", icon: Globe, description: "Requisição HTTP externa" },
      { type: "code", label: "Código", icon: Code2, description: "Executar JavaScript ou Python" },
      { type: "edit_fields", label: "Edit Fields", icon: PenLine, description: "Mapear campos de dados" },
    ],
  },
];

export function NodeToolbar({ onAddNode, canUseAdvanced = false, onLockedClick }: NodeToolbarProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5 shadow-lg">
          <Plus className="h-4 w-4" />
          Adicionar Nó
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-[70vh] overflow-y-auto">
        {categories.map((cat, catIdx) => {
          const isLocked = cat.locked && !canUseAdvanced;
          return (
            <div key={cat.label}>
              {catIdx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                {cat.label}
                {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
              </DropdownMenuLabel>
              {isLocked ? (
                <DropdownMenuItem
                  onClick={() => onLockedClick?.()}
                  className="gap-3 py-3 cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium">Módulo Atendente de I.A</p>
                    <p className="text-[10px] text-muted-foreground">Contrate para desbloquear nós avançados</p>
                  </div>
                </DropdownMenuItem>
              ) : (
                cat.items.map((opt) => (
                  <DropdownMenuItem key={opt.type} onClick={() => onAddNode(opt.type)} className="gap-3 py-2">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <opt.icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[12px] font-medium">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
