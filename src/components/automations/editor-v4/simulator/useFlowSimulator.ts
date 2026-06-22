import { useState, useEffect, useRef, useCallback } from "react";
import { Node, Edge } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    X, Play, RotateCcw, Send, Bot, User, Clock, GitBranch,
    Zap, ArrowRightLeft, Image, Mic, FileText, Video,
    Brain, ChevronRight, Gauge, Smartphone, UserSearch,
    Paperclip, Timer, BarChart3, Target, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

// -- Types --
export interface SimMessage {
    id: string;
    type: "bot" | "user" | "system" | "typing" | "internal";
    content: string;
    nodeId?: string;
    nodeType?: string;
    timestamp: Date;
    media?: { type: string; url?: string; name?: string; caption?: string };
}

export interface RouteChoice {
    nodeId: string;
    label: string;
    options: { label: string; targetNodeId: string; handleId?: string }[];
}

export interface LeadOption {
    id: string;
    name: string;
    phone: string;
}

export interface FlowCorrection {
    nodeId: string | null;
    type: "update_node" | "add_node";
    field?: string;
    node_type?: string;
    suggestion: string;
    reason: string;
}

export interface FlowSimulatorUIProps {
    nodes: Node[];
    edges: Edge[];
    automationId?: string;
    onClose: () => void;
    onHighlightNode?: (nodeId: string | null) => void;
    onCorrectionsGenerated?: (corrections: FlowCorrection[]) => void;
    onMemoryUpdated?: (nodeId: string, notes: string) => void;
    standalone?: boolean;
    disableLearning?: boolean;
}

// -- Helpers --
export const NODE_TYPE_LABELS: Record<string, string> = {
    trigger: 'Gatilho Inicial',
    send_message: 'Enviar Mensagem',
    interactive_message: 'Mensagem Interativa',
    send_image: 'Enviar Imagem',
    send_audio: 'Enviar Áudio',
    send_document: 'Enviar Documento',
    send_video: 'Enviar Vídeo',
    send_template: 'Enviar Template',
    ask_question: 'Fazer Pergunta',
    capture_info: 'Capturar Dado',
    wait_response: 'Aguardar Resposta',
    condition: 'Condição (Se)',
    filter: 'Filtro',
    router: 'Roteador',
    delay: 'Atraso',
    crm_move: 'Mover Kanban',
    bot_toggle: 'Controlar Robô',
    stop_bot: 'Parar Robô',
    loop_restart: 'Reiniciar Loop',
    ai_agent: 'Agente IA',
    intent_router: 'Classificador IA',
    follow_up_ai: 'Follow-Up IA',
    send_ai_response: 'Resposta IA',
    http_request: 'HTTP Request',
    code: 'Executar Código',
    edit_fields: 'Editar Campos',
    lookup_lead: 'Buscar Lead',
    add_note: 'Adicionar Nota',
    internal_message: 'Mensagem Interna',
    add_task: 'Adicionar Tarefa',
    assign_user: 'Atribuir Lead',
    add_tag: 'Adicionar Tag',
    update_contact: 'Atualizar Contato',
    action: "Ação",
    check_sender: "Checar Remetente",
    financeiro: "Financeiro",
    agenda: "Agendar Evento",
    marketing_data: "Dados de Marketing",
    wa_lists: "Listas WhatsApp",
    ab_test: "Teste A/B",
    react_message: "Reagir Mensagem",
    send_email: "Enviar E-mail",
    internal_notification: "Notificação Interna",
    business_hours: "Horário Comercial",
    check_tag: "Verificar Tag",
    send_meta_template: "Template Meta",
};

export const MEDIA_ICONS: Record<string, React.ElementType> = {
    send_image: Image,
    send_video: Video,
    send_audio: Mic,
    send_document: FileText,
};

export const HANDLE_LABELS: Record<string, Record<string, string>> = {
    check_sender: { yes: "✅ Bateu o número", no: "❌ Outros números" },
    condition: { yes: "✅ Sim (condição verdadeira)", no: "❌ Não (condição falsa)" },
    ai_agent: { completed: "✅ Concluído", timeout: "⏱️ Tempo esgotado" },
    follow_up_ai: { responded: "✅ Respondeu", not_responded: "⏱️ Não respondeu" },
    wait_response: { responded: "✅ Respondeu", timeout: "⏱️ Tempo esgotado" },
    ab_test: { a: "🅰️ Variante A", b: "🅱️ Variante B", c: "🅲 Variante C" },
    business_hours: { inside: "✅ Dentro do horário", outside: "❌ Fora do horário" },
    check_tag: { has_tag: "✅ Possui tag", no_tag: "❌ Não possui tag" },
};

function getNextNodes(nodeId: string, edges: Edge[]): { targetId: string; handleId?: string; label?: string }[] {
    return edges
        .filter((e) => e.source === nodeId)
        .map((e) => ({
            targetId: e.target,
            handleId: e.sourceHandle || undefined,
            label: typeof e.label === "string" ? e.label : undefined,
        }));
}

function findTriggerNode(nodes: Node[], edges: Edge[]): Node | undefined {
    const trigger = nodes.find((n) => n.type === "trigger");
    if (trigger) return trigger;

    // Fallback: find node with no incoming edges
    const hasIncoming = new Set(edges.map(e => e.target));
    return nodes.find(n => !hasIncoming.has(n.id));
}

export function buildRouteLabel(
    nodeType: string,
    handleId: string | undefined,
    edgeLabel: string | undefined,
    targetNode: Node | undefined,
    index: number
): string {
    if (edgeLabel) return edgeLabel;
    if (nodeType && handleId && HANDLE_LABELS[nodeType]?.[handleId]) return HANDLE_LABELS[nodeType][handleId];
    if (nodeType === "intent_router" && handleId) {
        if (handleId === "fallback") return "🔀 OUTROS (fallback)";
        return `🎯 ${handleId}`;
    }
    if ((nodeType === "condition" || nodeType === "filter") && handleId) {
        if (handleId === "yes") return "✅ Sim";
        if (handleId === "no") return "❌ Não";
    }
    if (nodeType === "router" && handleId) return `Rota: ${handleId}`;
    const targetLabel = (targetNode?.data as Record<string, unknown>)?.label || NODE_TYPE_LABELS[targetNode?.type || ""];
    if (targetLabel) return `Rota ${index + 1}: ${targetLabel}`;
    return `Rota ${index + 1}`;
}

function comparePhones(phone1: string, phone2: string): boolean {
    const clean1 = phone1.replace(/\D/g, "");
    const clean2 = phone2.replace(/\D/g, "");
    if (clean1 === clean2) return true;
    if (clean1.slice(-9) === clean2.slice(-9)) return true;
    return false;
}

// -- Component --
export function useFlowSimulator({ nodes, edges, automationId, onClose, onHighlightNode, onCorrectionsGenerated, onMemoryUpdated, disableLearning }: FlowSimulatorUIProps) {
    const { currentOrganization } = useOrganization();
    const [messages, setMessages] = useState<SimMessage[]>([]);
    const [simulatorLogId, setSimulatorLogId] = useState<string | null>(null);
    

    // Sync simulator log to backend
    useEffect(() => {
        if (messages.length > 0) {
            const timer = setTimeout(async () => {
                try {
                    const res = await fetch('/api/v1/automations/simulator/log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            logId: simulatorLogId,
                            ruleId: automationId,
                            flowName: 'Simulador Virtual (Testes)',
                            messages
                        })
                    });
                    const data = await res.json();
                    if (data?.success && data?.logId && !simulatorLogId) {
                        setSimulatorLogId(data.logId);
                    }
                } catch (err) {
                    console.error('Failed to sync simulator log:', err);
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [messages, automationId, simulatorLogId]);

    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [waitingInput, setWaitingInput] = useState(false);
    const [routeChoice, setRouteChoice] = useState<RouteChoice | null>(null);
    const [userInput, setUserInput] = useState("");
    const [speed, setSpeed] = useState(1);
    const [simFinished, setSimFinished] = useState(false);
    const [analysisRunning, setAnalysisRunning] = useState<string | null>(null);

    // Lead selection (UI state)
    const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
    const [leadSearch, setLeadSearch] = useState("");
    const [leadResults, setLeadResults] = useState<LeadOption[]>([]);
    const [showLeadSelector, setShowLeadSelector] = useState(true);
    const [searchingLeads, setSearchingLeads] = useState(false);
    const [tokensUsed, setTokensUsed] = useState(0);
    const [learningDecision, setLearningDecision] = useState<'pending' | 'generating' | 'done' | 'skipped' | null>(null);
    const [useVirtualLead, setUseVirtualLead] = useState(false);
    const [timeoutCountdown, setTimeoutCountdown] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // REFS to avoid stale closures in the async simulation engine
    // These are the source of truth during simulation, NOT the state variables
    const selectedLeadRef = useRef<LeadOption | null>(null);
    const isVirtualRef = useRef(false);
    const virtualHistoryRef = useRef<{ role: string; content: string }[]>([]);
    const simulationContextRef = useRef<Record<string, unknown>>({});
    const speedRef = useRef(1);
    const lastUserImageRef = useRef<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef(false);
    const resolveInputRef = useRef<((value: string) => void) | null>(null);
    const resolveRouteRef = useRef<((targetNodeId: string) => void) | null>(null);

    // Keep refs in sync
    useEffect(() => { speedRef.current = speed; }, [speed]);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
    useEffect(() => { return () => { onHighlightNode?.(null); }; }, [onHighlightNode]);

    // Lead search
    useEffect(() => {
        if (!leadSearch.trim() || !currentOrganization?.id) { setLeadResults([]); return; }
        const timer = setTimeout(async () => {
            setSearchingLeads(true);
            const { data } = await supabase
                .from("chats")
                .select("id, lead_name, phone")
                .eq("organization_id", currentOrganization.id)
                .or(`lead_name.ilike.%${leadSearch}%,phone.ilike.%${leadSearch}%`)
                .limit(8);
            setLeadResults((data || []).map((c: { id: string; lead_name?: string; phone: string }) => ({ id: c.id, name: c.lead_name || c.phone, phone: c.phone })));
            setSearchingLeads(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [leadSearch, currentOrganization?.id]);

    const addMessage = useCallback((msg: Omit<SimMessage, "id" | "timestamp">) => {
        const newMsg: SimMessage = { ...msg, id: crypto.randomUUID(), timestamp: new Date() };
        setMessages((prev) => [...prev, newMsg]);
        return newMsg.id;
    }, []);

    const removeMessage = useCallback((id: string) => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
    }, []);

    const simDelay = useCallback((ms: number) => {
        if (speedRef.current === 0) return Promise.resolve();
        return new Promise<void>((resolve) => setTimeout(resolve, ms / speedRef.current));
    }, []);

    const waitForUserInput = useCallback((): Promise<string> => {
        return new Promise((resolve) => {
            setWaitingInput(true);
            resolveInputRef.current = resolve;
        });
    }, []);

    const waitForRouteChoice = useCallback((choice: RouteChoice): Promise<string> => {
        return new Promise((resolve) => {
            setRouteChoice(choice);
            resolveRouteRef.current = resolve;
        });
    }, []);

    const handleSendInput = useCallback(() => {
        if (!userInput.trim() || !resolveInputRef.current) return;
        const text = userInput.trim();
        
        if (text.toLowerCase() === "pular" || text.toLowerCase() === "timeout") {
            setUserInput("");
            setWaitingInput(false);
            setTimeoutCountdown(null);
            resolveInputRef.current("__TIMEOUT__");
            resolveInputRef.current = null;
            return;
        }

        addMessage({ type: "user", content: text });
        virtualHistoryRef.current.push({ role: "user", content: text });
        setUserInput("");
        setWaitingInput(false);
        setTimeoutCountdown(null);
        resolveInputRef.current(text);
        resolveInputRef.current = null;
    }, [userInput, addMessage]);

    const simulateUserInput = useCallback((text: string) => {
        if (!text.trim() || !resolveInputRef.current) return;
        
        if (text === "__TIMEOUT__") {
            setWaitingInput(false);
            setTimeoutCountdown(null);
            resolveInputRef.current("__TIMEOUT__");
            resolveInputRef.current = null;
            return;
        }

        addMessage({ type: "user", content: text });
        virtualHistoryRef.current.push({ role: "user", content: text });
        setWaitingInput(false);
        setTimeoutCountdown(null);
        resolveInputRef.current(text);
        resolveInputRef.current = null;
    }, [addMessage]);

    const handleMediaAttach = useCallback((mediaType: string) => {
        if (!resolveInputRef.current) return;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = mediaType === "image" ? "image/*" : mediaType === "audio" ? "audio/*" : "*/*";
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file || !resolveInputRef.current) return;
            
            const icon = mediaType === "image" ? "🖼️" : mediaType === "audio" ? "🎵" : "📎";
            const label = `${icon} ${file.name}`;
            // Convert to base64 so the simulation engine can send it to fal.ai
            const reader = new FileReader();
            reader.onload = async () => {
                const base64Url = reader.result as string;

                if (mediaType === "image") {
                    // ── IMAGE: skip transcription entirely ──────────────────
                    // Store the base64 URL directly for the simulation engine.
                    // The fal.ai model receives the raw image — no text extraction needed.
                    lastUserImageRef.current = base64Url;

                    addMessage({
                        type: "user",
                        content: "",
                        media: { type: "image", url: base64Url, name: file.name },
                    });

                    const historyContent = `[Enviou foto: ${file.name}]`;
                    virtualHistoryRef.current.push({ role: "user", content: historyContent });
                    setWaitingInput(false);
                    setTimeoutCountdown(null);
                    resolveInputRef.current?.(historyContent);
                    resolveInputRef.current = null;
                    return;
                }

                // ── NON-IMAGE MEDIA: transcribe as before ────────────────────
                addMessage({
                    type: "user",
                    content: "",
                    media: { type: mediaType, url: base64Url, name: file.name },
                });

                const sysTypingId = addMessage({ type: "typing", content: "Extraindo dados da mídia..." });

            let historyContent = `[Enviou ${mediaType}: ${file.name}]`;

            try {
                const formData = new FormData();
                formData.append("file", file);

                const res = await fetch("/api/v1/automations/simulator/transcribe", {
                    method: "POST",
                    body: formData,
                });

                let data;
                try {
                    data = await res.json();
                } catch (jsonErr) {
                    throw new Error(`Erro no servidor (A rota não retornou JSON válido). Status: ${res.status}`);
                }

                removeMessage(sysTypingId);

                if (data.success && data.transcription) {
                    historyContent += `\n[Conteúdo Extraído/Transcrição: ${data.transcription}]`;
                    addMessage({ type: "system", content: `✨ Arquivo lido (Transcrição extraída com sucesso).` });
                } else if (data.error) {
                    addMessage({ type: "system", content: `⚠️ Não foi possível ler o arquivo: ${data.error}` });
                }
            } catch (err: any) {
                removeMessage(sysTypingId);
                addMessage({ type: "system", content: `❌ Falha ao processar arquivo: ${err.message}` });
            }

                virtualHistoryRef.current.push({ role: "user", content: historyContent });
                setWaitingInput(false);
                setTimeoutCountdown(null);
                resolveInputRef.current?.(historyContent);
                resolveInputRef.current = null;
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }, [addMessage, removeMessage]);

    // Wait for user input with optional timeout (in seconds)
    const waitForUserInputWithTimeout = useCallback((timeoutSeconds: number): Promise<string> => {
        return new Promise((resolve) => {
            setWaitingInput(true);
            setTimeoutCountdown(timeoutSeconds);

            // Countdown interval
            const countdownInterval = setInterval(() => {
                setTimeoutCountdown((prev) => {
                    if (prev === null || prev <= 1) {
                        clearInterval(countdownInterval);
                        return null;
                    }
                    return prev - 1;
                });
            }, 1000);

            // Override resolveInputRef so that user input cancels the timeout
            const originalResolve = (value: string) => {
                clearTimeout(timeoutTimer);
                clearInterval(countdownInterval);
                setTimeoutCountdown(null);
                resolve(value);
            };
            resolveInputRef.current = originalResolve;

            // Timeout timer
            const timeoutTimer = setTimeout(() => {
                clearInterval(countdownInterval);
                setTimeoutCountdown(null);
                setWaitingInput(false);
                if (resolveInputRef.current === originalResolve) {
                    resolveInputRef.current = null;
                    resolve("__TIMEOUT__");
                }
            }, timeoutSeconds * 1000);
        });
    }, []);

    const handleRouteSelect = useCallback((targetNodeId: string) => {
        if (!resolveRouteRef.current) return;
        setRouteChoice(null);
        resolveRouteRef.current(targetNodeId);
        resolveRouteRef.current = null;
    }, []);

    const addBotToHistory = useCallback((content: string) => {
        virtualHistoryRef.current.push({ role: "assistant", content });
    }, []);

    // -- Interpolate template variables using simulation context --
    const interpolateWithContext = useCallback((text: string): string => {
        if (!text) return text;
        const ctx = simulationContextRef.current;
        return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match: string, key: string) => {
            const parts = key.trim().split(".");
            let val: unknown = ctx;
            for (const p of parts) { val = val?.[p]; }
            if (val && typeof val === "object") return JSON.stringify(val, null, 2);
            return val !== undefined ? String(val) : match;
        });
    }, []);

    // -- AI calls using refs (no stale closure) --
    // Builds the full system message from node config (system_message + prompt + head prompt info)
    const buildSystemPrompt = useCallback((config: Record<string, unknown>): string => {
        const parts: string[] = [];
        if (config.system_message) parts.push(config.system_message as string);
        
        if (config.learning_notes) {
            parts.push("\n\n#REGRAS ABSOLUTAS ACIMA DO PROMPT E DE TUDO, ESSAS INFORMAÇÕES ESTÃO CORRETAS E VALIDADAS E DEVEM SER SEGUIDAS A TODO CUSTO:\n" + config.learning_notes);
        }
        // In dialogue mode, prompt is part of the system instructions
        if (config.dialogue_mode && config.prompt) parts.push(config.prompt as string);
        if (config.followup_prompt) parts.push(config.followup_prompt as string);
        if (parts.length === 0) parts.push("Responda como assistente.");
        // Inject dialogue objective if in dialogue mode
        const objective = config.completion_condition || config.dialogue_objective;
        if (config.dialogue_mode && objective) {
            parts.push("\n\n🎯 OBJETIVO DO DIÁLOGO: " + objective);
            parts.push("Continue conversando naturalmente até atingir o objetivo.");
        }

        if (config.google_calendar_enabled) {
            parts.push("\n\n📅 INTEGRAÇÃO DE AGENDA ATIVA (MODO SIMULAÇÃO):");
            parts.push("Você possui capacidade de agendamento automático. Como este é um ambiente de testes, finja que você acessou a agenda e agendou o horário com sucesso. Na sua mensagem de confirmação do horário, GERE um link de Google Meet fictício (ex: https://meet.google.com/abc-defg-hij) e entregue ao lead.");
        }

        // === BIBLIOTECA DE ARQUIVOS ===
        const libraryFiles = config.media_library_enabled && Array.isArray(config.media_library_files) && (config.media_library_files as any[]).length > 0
            ? (config.media_library_files as any[])
            : null;
        if (libraryFiles) {
            parts.push("\n\n📂 CAPACIDADE DE ENVIO DE ARQUIVOS — LEIA COM ATENÇÃO:");
            parts.push("VOCÊ TEM TOTAL CAPACIDADE de enviar imagens e documentos para o cliente. NÃO diga que não pode enviar arquivos. Este sistema suporta envio de mídia.");
            parts.push("COMO FUNCIONA: Quando quiser enviar um arquivo, escreva sua mensagem normalmente e adicione ao FINAL exatamente esta tag: [ARQUIVO:nome-exato-do-arquivo.extensão]");
            parts.push("O sistema irá automaticamente converter essa tag no arquivo real enviado ao cliente.");
            parts.push("");
            parts.push("EXEMPLO CORRETO — se o cliente pede uma foto de mármore branco e você tem o arquivo 'marmore-branco.jpg':");
            parts.push('  Resposta: "Aqui está uma foto do mármore branco que temos disponível! Como pode ver, é um material muito elegante. [ARQUIVO:marmore-branco.jpg]"');
            parts.push("");
            parts.push("REGRAS OBRIGATÓRIAS:");
            parts.push("  1. SEMPRE escreva o texto ANTES da tag. NUNCA envie apenas a tag sem mensagem.");
            parts.push("  2. Use EXATAMENTE o nome do arquivo listado abaixo (incluindo extensão).");
            parts.push("  3. NUNCA diga ao cliente que não pode enviar arquivos. Se tiver um arquivo relevante, ENVIE.");
            parts.push("  4. Envie o arquivo quando o cliente pedir OU quando fizer sentido para a conversa.");
            parts.push("");
            parts.push("ARQUIVOS DISPONÍVEIS PARA ENVIO:");
            libraryFiles.forEach((f: any) => {
                const name = f.file_name || f.fileName;
                const desc = f.description ? ` (usar quando: ${f.description})` : ' (enviar quando o cliente pedir ou for relevante)';
                if (name) parts.push(`  → [ARQUIVO:${name}]${desc}`);
            });

            if (config.media_library_simulation_enabled) {
                // Build an explicit, numbered list of files for the AI to reason from
                const fileListForSim = libraryFiles
                    .map((f: any, i: number) => {
                        const name = f.file_name || f.fileName || '';
                        const desc = f.description || '';
                        return `  ${i + 1}. ARQUIVO: "${name}" — Descrição: ${desc || '(sem descrição)'}`;
                    })
                    .join('\n');

                parts.push('\n\n🎨 SIMULAÇÃO REALISTA — PROTOCOLO OBRIGATÓRIO:');
                parts.push('Se o cliente enviou uma FOTO do ambiente (cozinha, banheiro, etc.) e quer ver um produto simulado, você PODE gerar uma simulação usando fal.ai FLUX.');
                parts.push('');
                parts.push('LISTA COMPLETA DE PRODUTOS DISPONÍVEIS PARA SIMULAÇÃO:');
                parts.push(fileListForSim);
                parts.push('');
                parts.push('COMO ESCOLHER O PRODUTO CORRETO (SIGA EXATAMENTE ESTE RACIOCÍNIO):');
                parts.push('  PASSO 1 → Identifique o que o cliente pediu. Ex: "mármore preto" → cor = preto, material = mármore.');
                parts.push('  PASSO 2 → Leia TODOS os arquivos da lista acima e identifique qual contém as palavras-chave do pedido.');
                parts.push('  PASSO 3 → Se o cliente pediu COR ESPECÍFICA (preto, branco, bege, cinza, etc.), o arquivo escolhido DEVE conter essa cor no nome ou descrição. NUNCA escolha o arquivo oposto.');
                parts.push('  PASSO 4 → Use EXATAMENTE o nome do arquivo escolhido na tag, sem alterar nada.');
                parts.push('');
                parts.push('FORMATO OBRIGATÓRIO:');
                parts.push('  [SIMULAR:nome-exato-do-arquivo-da-lista-acima | o-que-vai-ser-trocado-na-foto]');
                parts.push('');
                parts.push('EXEMPLOS (use como referência de raciocínio):');
                parts.push('  Cliente pede "mármore PRETO" → escolha o arquivo que tem "preto" no nome → NÃO escolha arquivo com "branco"');
                parts.push('  Cliente pede "mármore BRANCO" → escolha o arquivo que tem "branco" no nome → NÃO escolha arquivo com "preto"');
                parts.push('');
                parts.push('REGRAS ABSOLUTAS:');
                parts.push('  1. SÓ use [SIMULAR:...] se o cliente EFETIVAMENTE tiver enviado uma FOTO do ambiente dele na conversa.');
                parts.push('  2. O nome do arquivo na tag DEVE ser copiado EXATAMENTE da lista acima. Não invente nomes.');
                parts.push('  3. O alvo (o que vai ser trocado) é OBRIGATÓRIO: ex: "bancada da pia", "chão", "parede".');
                parts.push('  4. Antes de escrever a tag, CONFIRME mentalmente: "Este arquivo tem a cor/material que o cliente pediu?"');
                parts.push('  5. REGRA DO PRODUTO ÚNICO: Se o cliente pediu apenas o tipo de material (ex: "granito", "mármore") SEM especificar cor, e houver apenas UM produto desse material na lista acima, selecione-o AUTOMATICAMENTE. Não pergunte a cor — faça a simulação e informe ao cliente qual produto foi usado.');
                parts.push('  6. NUNCA deixe de fazer a simulação por falta de produto exato — sempre use o produto mais próximo disponível na lista.');
            }
        }


        if (config.format_for_send) {
            parts.push("\nSepare cada parte da resposta com ⌁⌁⌁");
        }
        return parts.join("\n\n");
    }, []);

    // Helper: extract [ARQUIVO:name] and [SIMULAR:name | target] tags from AI response
    // Supports exact match, partial match, extensionless match, and fuzzy type-based match.
    // lastUserMessage: the last message typed by the lead — used to cross-validate the AI's file choice.
    const extractFileTag = useCallback((text: string, libraryFiles: any[], lastUserMessage?: string): { cleanText: string; file?: { name: string; url: string; type: string }, simulateFile?: { name: string; url: string; type: string }, simulateTarget?: string } => {
        let cleanText = text;
        
        // 1. Check for SIMULAR tag with optional target
        const simMatch = cleanText.match(/\[SIMULAR:([^|\]]+)(?:\|([^\]]+))?\]/i);
        let simulateFileName = null;
        let simulateTarget = undefined;
        if (simMatch) {
            simulateFileName = simMatch[1].trim().toLowerCase();
            if (simMatch[2]) {
                simulateTarget = simMatch[2].trim();
            }
            cleanText = cleanText.replace(/\[SIMULAR:[^\]]+\]/gi, '').trim();
        }

        // 2. Check for ARQUIVO tag
        const fileMatch = cleanText.match(/\[ARQUIVO:([^\]]+)\]/i);
        let sendFileName = null;
        if (fileMatch) {
            sendFileName = fileMatch[1].trim().toLowerCase();
            cleanText = cleanText.replace(/\[ARQUIVO:[^\]]+\]/gi, '').trim();
        }

        if (!sendFileName && !simulateFileName) return { cleanText };

        // ── Semantic scoring: score a library file against a query string ──────────
        const scoreFileAgainstQuery = (file: any, query: string): number => {
            const name = ((file.file_name || file.fileName) ?? '').toLowerCase().replace(/[_\-\.]/g, ' ');
            const desc = ((file.description) ?? '').toLowerCase();
            const combined = `${name} ${desc}`;
            // NOTE: Do NOT add material/color keywords here (marmore, azul, preto, etc.)
            // Those are the CORE matching terms. Only filter true noise words.
            const stopWords = new Set(['pia', 'comum', 'lado', 'png', 'jpg', 'jpeg', 'webp', 'de', 'da', 'do', 'em', 'para', 'com', 'uma', 'um', 'kp', '1000x1000', '180', '2']);
            const keywords = query
                .toLowerCase()
                .replace(/[_\-\.]/g, ' ')
                .split(/\s+/)
                .map(k => k.trim())
                .filter(k => k.length > 2 && !stopWords.has(k));
            return keywords.reduce((score, kw) => score + (combined.includes(kw) ? 1 : 0), 0);
        };

        // ── findFile: locate best matching library file by name tag ───────────────
        const findFile = (fileName: string) => {
            // 1. Exact match (case-insensitive)
            let found = libraryFiles.find((f: any) =>
                (f.file_name || f.fileName)?.toLowerCase() === fileName
            );
            // 2. Partial match (filename contains the tag text or vice-versa)
            if (!found) {
                found = libraryFiles.find((f: any) => {
                    const name = (f.file_name || f.fileName)?.toLowerCase() || '';
                    return name.includes(fileName) || fileName.includes(name.replace(/\.[^.]+$/, ''));
                });
            }
            // 3. Semantic keyword matching against tag text — same rule: material words must NOT be stopWords
            if (!found) {
                const stopWords = new Set(['pia', 'comum', 'lado', 'png', 'jpg', 'jpeg', 'webp', '1000x1000', '180', 'kp', '2']);

                const keywords = fileName
                    .replace(/[_\-\.]/g, ' ')
                    .split(' ')
                    .map(k => k.toLowerCase().trim())
                    .filter(k => k.length > 2 && !stopWords.has(k));

                if (keywords.length > 0) {
                    let bestScore = 0;
                    let bestFile: any = null;
                    libraryFiles.forEach((f: any) => {
                        const name = (f.file_name || f.fileName)?.toLowerCase().replace(/[_\-\.]/g, ' ') || '';
                        const score = keywords.reduce((s, kw) => s + (name.includes(kw) ? 1 : 0), 0);
                        if (score > bestScore) {
                            bestScore = score;
                            bestFile = f;
                        }
                    });
                    if (bestFile && bestScore > 0) found = bestFile;
                }
            }
            // 4. Type-based fallback
            if (!found) {
                const typeKeywords: Record<string, string> = {
                    'foto': 'image', 'imagem': 'image', 'image': 'image', 'img': 'image',
                    'doc': 'document', 'documento': 'document', 'pdf': 'document',
                    'audio': 'audio', 'video': 'video',
                };
                const targetType = typeKeywords[fileName] || Object.entries(typeKeywords).find(([k]) => fileName.includes(k))?.[1];
                if (targetType) {
                    found = libraryFiles.find((f: any) => (f.file_type || f.fileType) === targetType);
                }
            }
            // 5. Last resort: return first file (only if no other match found)
            if (!found && libraryFiles.length > 0) {
                found = libraryFiles[0];
            }
            return found;
        };

        // ── Cross-validation: does the AI's chosen file match the lead's intent? ──
        // Uses positive scoring (keyword match) + negative scoring (antonym penalty)
        // so that "preto" correctly beats "branco" even when both share other keywords.
        const crossValidateWithUserIntent = (chosenFile: any): any => {
            if (!lastUserMessage || libraryFiles.length <= 1) return chosenFile;

            // Antonym pairs — if user said word A, penalize files containing word B
            const antonymPairs: [string, string][] = [
                ['preto', 'branco'], ['branco', 'preto'],
                ['escuro', 'claro'], ['claro', 'escuro'],
                ['negro', 'branco'], ['branco', 'negro'],
                ['dark', 'light'], ['light', 'dark'],
                ['black', 'white'], ['white', 'black'],
                ['cinza', 'bege'], ['bege', 'cinza'],
                ['azul', 'vermelho'], ['vermelho', 'azul'],
                ['verde', 'amarelo'], ['amarelo', 'verde'],
            ];

            const userLower = lastUserMessage.toLowerCase();

            const scoreFile = (file: any): number => {
                // Positive score from keyword matching
                let score = scoreFileAgainstQuery(file, lastUserMessage);

                const nameAndDesc = [
                    ((file.file_name || file.fileName) ?? '').toLowerCase().replace(/[_\-\.]/g, ' '),
                    ((file.description) ?? '').toLowerCase(),
                ].join(' ');

                // Penalty: user said word X, but file contains antonym Y → subtract 3
                for (const [userWord, fileAnti] of antonymPairs) {
                    if (userLower.includes(userWord) && nameAndDesc.includes(fileAnti)) {
                        score -= 3;
                    }
                }

                // Bonus: file name/desc directly contains exact color word from user
                const colorWords = ['preto', 'branco', 'cinza', 'bege', 'verde', 'azul', 'vermelho', 'amarelo',
                    'escuro', 'claro', 'black', 'white', 'gray', 'beige', 'dark', 'light'];
                for (const cw of colorWords) {
                    if (userLower.includes(cw) && nameAndDesc.includes(cw)) {
                        score += 2; // Extra bonus for exact color match
                    }
                }

                return score;
            };

            let bestScore = scoreFile(chosenFile);
            let bestFile = chosenFile;

            libraryFiles.forEach((f: any) => {
                const score = scoreFile(f);
                if (score > bestScore) {
                    bestScore = score;
                    bestFile = f;
                }
            });

            if (bestFile !== chosenFile) {
                const chosenName = (chosenFile.file_name || chosenFile.fileName) ?? '';
                const overrideName = (bestFile.file_name || bestFile.fileName) ?? '';
                console.warn(
                    `[extractFileTag] ⚠️ Cross-validation override: AI chose "${chosenName}" (score ${scoreFile(chosenFile)}) but user intent better matches "${overrideName}" (score ${bestScore}). Correcting.`
                );
                return bestFile;
            }
            return chosenFile;
        };

        const result: any = { cleanText };
        
        if (sendFileName) {
            const found = findFile(sendFileName);
            if (found) result.file = { name: found.file_name || found.fileName, url: found.file_url || found.fileUrl, type: found.file_type || found.fileType };
        }
        
        if (simulateFileName) {
            const rawFound = findFile(simulateFileName);
            if (rawFound) {
                // Apply cross-validation against user's actual request before committing
                const validated = crossValidateWithUserIntent(rawFound);
                result.simulateFile = {
                    name: validated.file_name || validated.fileName,
                    url: validated.file_url || validated.fileUrl,
                    type: validated.file_type || validated.fileType,
                    // Include description so the API can build a visually accurate material prompt
                    description: validated.description || '',
                };
            }
            if (simulateTarget) result.simulateTarget = simulateTarget;
        }

        return result;

        // 1. Exact match (case-insensitive)
    }, []);

    const triggerSimulation = useCallback(async (simulateFile: any, simulateTarget: string | undefined, nodeId: string, nodeType: string) => {
        const leadImageUrl = lastUserImageRef.current;
        if (!leadImageUrl) {
            addMessage({ type: "system", content: "⚠️ A I.A tentou gerar uma simulação, mas o cliente não enviou nenhuma foto na conversa.", nodeId, nodeType });
            return;
        }

        // Show a clean, simple status — no filename, no model details
        addMessage({ type: "system", content: `🎨 Gerando simulação realista...`, nodeId, nodeType });
        const simTypingId = addMessage({ type: "typing", content: "Criando imagem fotorealista...", nodeId, nodeType });

        const node = nodes.find(n => n.id === nodeId);
        const promptOverride = node?.data?.media_library_simulation_prompt;
        const strengthOverride = node?.data?.media_library_simulation_strength;
        const modelOverride = node?.data?.media_library_simulation_model;

        try {
            const res = await fetch('/api/v1/agent-library/transform-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    libraryImageUrl: simulateFile.url,
                    libraryImageName: simulateFile.name,
                    libraryImageDescription: simulateFile.description || '',  // For visual material description in prompt
                    leadImageUrl,
                    promptOverride,
                    strengthOverride,
                    modelOverride,
                    simulateTarget,
                }),
            });
            const data = await res.json();
            removeMessage(simTypingId);

            if (!res.ok) throw new Error(data.error || 'Erro ao gerar imagem');

            // Extract a short readable model name for the watermark overlay
            // e.g. 'fal-ai/flux-pro/kontext/max' → 'FLUX Kontext Max'
            const rawModel: string = data.model || modelOverride?.split('|')[0] || 'FLUX';
            const watermarkLabel = rawModel
                .replace('fal-ai/', '')
                .replace('flux-pro/kontext/max', 'FLUX Kontext Max')
                .replace('flux-pro/kontext', 'FLUX Kontext Pro')
                .replace('flux/dev/image-to-image', 'FLUX Dev')
                .replace('flux-pro/v1.1', 'FLUX Pro');

            addMessage({
                type: "bot",
                content: "",   // No caption below the image
                nodeId,
                nodeType,
                media: {
                    type: "image",
                    url: data.resultUrl,
                    name: "simulacao.png",
                    caption: `Simulação • ${watermarkLabel}`,   // Used by UI as watermark overlay
                }
            });
            virtualHistoryRef.current.push({ role: "assistant", content: `[Enviou Simulação Realista do produto ${simulateFile.name}]` });
        } catch (err: any) {
            removeMessage(simTypingId);
            addMessage({ type: "system", content: `❌ Falha na simulação: ${err.message}`, nodeId, nodeType });
        }
    }, [addMessage, removeMessage, nodes]);

    const callAI = useCallback(async (config: Record<string, unknown>): Promise<{ response: string; tokens: number; error?: string } | null> => {
        try {
            console.log('[useFlowSimulator] callAI initiated with model:', config.model);
            const lead = selectedLeadRef.current;
            const isVirtual = isVirtualRef.current;
            const fullSystemMessage = buildSystemPrompt(config);

            const payload = {
                simulate_ai_virtual: isVirtual || !lead,
                simulate_ai_node: !!lead && !isVirtual,
                chat_id: lead?.id,
                organization_id: currentOrganization?.id,
                config: {
                    ...config,
                    system_message: fullSystemMessage,
                },
                virtual_history: virtualHistoryRef.current,
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

            console.log('[useFlowSimulator] Sending payload to simulator API...');
            const response = await fetch('/api/v1/automations/simulator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            console.log('[useFlowSimulator] Response received. Status:', response.status);
            const data = await response.json();
            
            if (!response.ok || data.error) {
                console.error('[useFlowSimulator] API Error:', data.error);
                const errMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
                return { response: "", tokens: 0, error: errMsg || `HTTP ${response.status}` };
            }
            return { response: data.response || "(sem resposta)", tokens: data.total_tokens || 0 };
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('[useFlowSimulator] Request to simulator API timed out after 30s');
                return { response: "", tokens: 0, error: "Tempo esgotado (timeout 30s). O servidor não respondeu." };
            }
            console.error('[useFlowSimulator] Fetch Exception:', error);
            return { response: "", tokens: 0, error: error.message || "Erro desconhecido na rede" };
        }
    }, [currentOrganization?.id, buildSystemPrompt]);

    const classifyIntent = useCallback(async (config: Record<string, unknown>): Promise<{ intent: string; tokens: number } | null> => {
        try {
            const lead = selectedLeadRef.current;
            const isVirtual = isVirtualRef.current;

            const payload = {
                classify_intent_virtual: isVirtual || !lead,
                classify_intent: !!lead && !isVirtual,
                chat_id: lead?.id,
                organization_id: currentOrganization?.id,
                config,
                virtual_history: virtualHistoryRef.current,
            };

            const response = await fetch('/api/v1/automations/simulator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            
            if (!response.ok || data.error) return null;
            return { intent: data.intent || "OUTROS", tokens: data.total_tokens || 0 };
        } catch {
            return null;
        }
    }, [currentOrganization?.id]);

    // -- Route choice helper --
    const showRouteChoices = useCallback(async (
        nodeId: string, nodeType: string, nodeLabel: string, nextNodes: ReturnType<typeof getNextNodes>
    ): Promise<string | null> => {
        if (nextNodes.length <= 1) {
            addMessage({ type: "system", content: `🔀 ${nodeLabel}`, nodeId, nodeType });
            return nextNodes[0]?.targetId || null;
        }
        const options = nextNodes.map((n, i) => ({
            label: buildRouteLabel(nodeType, n.handleId, n.label, nodes.find(nd => nd.id === n.targetId), i),
            targetNodeId: n.targetId,
            handleId: n.handleId,
        }));
        addMessage({ type: "system", content: `🔀 ${nodeLabel} — Escolha a rota:`, nodeId, nodeType });
        return waitForRouteChoice({ nodeId, label: nodeLabel, options });
    }, [nodes, addMessage, waitForRouteChoice]);

    // -- Simulation Engine --
    const processNode = useCallback(async (nodeId: string): Promise<string | null> => {
        if (abortRef.current) return null;

        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return null;

        setCurrentNodeId(nodeId);
        onHighlightNode?.(nodeId);

        const rawData = node.data as any;
        const config = { ...rawData, ...(rawData?.config || {}) };
        const nodeType = node.type || "";
        const nodeLabel = rawData?.label || NODE_TYPE_LABELS[nodeType] || nodeType;
        const nextNodes = getNextNodes(nodeId, edges);

        // Read from refs (NOT state) to avoid stale closures
        const isVirtual = isVirtualRef.current;
        const lead = selectedLeadRef.current;

        await simDelay(300);

        switch (nodeType) {
            case "trigger": {
                addMessage({ type: "system", content: "🚀 Automação iniciada", nodeId, nodeType });
                await simDelay(500);
                return nextNodes[0]?.targetId || null;
            }

            case "send_message": {
                const rawMsg = config.message || "(mensagem vazia)";
                const msg = interpolateWithContext(rawMsg);
                const typingId = addMessage({ type: "typing", content: "", nodeId, nodeType });
                await simDelay(Math.min(msg.length * 20, 2000));
                removeMessage(typingId);
                addMessage({ type: "bot", content: msg, nodeId, nodeType });
                addBotToHistory(msg);
                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            case "interactive_message": {
                const rawMsg = config.message || "(mensagem vazia)";
                const msg = interpolateWithContext(rawMsg);
                const buttons = config.buttons || [];
                const attachments = config.attachments || [];
                
                let displayMsg = msg;
                if (attachments.length > 0) {
                    displayMsg = `📎 [Anexo: ${attachments[0].type}] \n\n${displayMsg}`;
                }

                const typingId = addMessage({ type: "typing", content: "", nodeId, nodeType });
                await simDelay(Math.min(msg.length * 20, 2000));
                removeMessage(typingId);
                addMessage({ 
                    type: "bot", 
                    content: displayMsg, 
                    nodeId, 
                    nodeType,
                    buttons: buttons.map((b: { id?: string; text: string }) => ({ id: b.id || b.text, text: b.text }))
                });
                addBotToHistory(displayMsg);

                // No simulador, vamos aguardar até 60s (ou tempo padrão)
                const response = await waitForUserInputWithTimeout(60);
                
                if (response === "__TIMEOUT__") {
                    addMessage({ type: "system", content: `⏱️ Tempo esgotado (Sem resposta).`, nodeId, nodeType });
                    const timeoutEdge = nextNodes.find(n => n.handleId === "no_response");
                    return timeoutEdge ? timeoutEdge.targetId : null;
                }

                // Match simples com o texto do botão
                const normalize = (str: string) => str.toLowerCase().trim();
                const btnIdx = buttons.findIndex((b: { text: string }) => normalize(b.text) === normalize(response));
                
                if (btnIdx !== -1) {
                    const btnEdge = nextNodes.find(n => n.handleId === `btn_${btnIdx}`);
                    if (btnEdge) {
                        await simDelay(300);
                        return btnEdge.targetId;
                    }
                }
                
                // Se não bateu com nenhum botão, vai pro other_response
                const otherEdge = nextNodes.find(n => n.handleId === "other_response");
                if (otherEdge) {
                    await simDelay(300);
                    return otherEdge.targetId;
                }

                return null;
            }

            case "internal_message": {
                const rawMsg = config.message || config.note || "(mensagem vazia)";
                const msg = interpolateWithContext(rawMsg);
                addMessage({ type: "internal", content: msg, nodeId, nodeType });
                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            case "add_task": {
                const taskText = config.task_text || config.text || "Tarefa genérica";
                addMessage({ type: "system", content: `✅ Tarefa criada: ${taskText}`, nodeId, nodeType });
                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            case "send_to_number": {
                const targetPhone = config.target_phone || "(sem número configurado)";
                const rawMsg = config.message || "(mensagem vazia)";
                const msg = interpolateWithContext(rawMsg);
                const typingId = addMessage({ type: "typing", content: "", nodeId, nodeType });
                await simDelay(Math.min(msg.length * 20, 2000));
                removeMessage(typingId);
                addMessage({ type: "system", content: `📤 Envio Direto (WhatsApp) para ${targetPhone}:`, nodeId, nodeType });
                addMessage({ type: "bot", content: msg, nodeId, nodeType });
                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            case "send_image":
            case "send_audio":
            case "send_document":
            case "send_video": {
                const caption = config.caption || "";
                const typingId = addMessage({ type: "typing", content: "", nodeId, nodeType });
                await simDelay(1000);
                removeMessage(typingId);
                const mediaType = nodeType.replace("send_", "");
                
                addMessage({
                    type: "bot", content: caption, nodeId, nodeType,
                    media: { type: mediaType, url: config.file_url, name: config.file_name },
                });
                
                if (caption) {
                    addBotToHistory(caption);
                } else {
                    addBotToHistory(`[Enviou mídia: ${mediaType}]`);
                }
                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            case "delay": {
                const delayMinutes = config.delay_minutes || config.minutes || 1;
                const delayUnit = config.delay_unit || "minutes";
                let displayTime = delayUnit === "hours" || delayMinutes >= 60
                    ? `${Math.round(delayMinutes / 60)}h` : `${delayMinutes} min`;
                addMessage({ type: "system", content: `⏳ Aguardando ${displayTime} (simulado)`, nodeId, nodeType });
                await simDelay(Math.min(delayMinutes * 1000, 3000));
                return nextNodes[0]?.targetId || null;
            }

            case "ask_question": {
                const rawQuestion = config.question || "(pergunta vazia)";
                const question = interpolateWithContext(rawQuestion);
                const options = (config.options || []).filter((o: { text: string }) => o?.text);
                let fullMsg = question;
                if (options.length > 0) {
                    fullMsg += "\n\n" + options.map((o: any, i: number) => `${i + 1}. ${o.text}`).join("\n");
                }
                const typingId = addMessage({ type: "typing", content: "", nodeId, nodeType });
                await simDelay(800);
                removeMessage(typingId);
                addMessage({ type: "bot", content: fullMsg, nodeId, nodeType });
                addBotToHistory(fullMsg);

                const response = await waitForUserInput();
                if (options.length > 0 && nextNodes.length > 1) {
                    const responseNum = parseInt(response);
                    if (responseNum >= 1 && responseNum <= options.length) {
                        return nextNodes[responseNum - 1]?.targetId || nextNodes[0]?.targetId || null;
                    }
                }
                return nextNodes[0]?.targetId || null;
            }

            case "wait_response": {
                const immediate = config.immediate_response || false;

                const timeoutAmount = parseInt(config.timeout_amount || "24");
                const timeoutUnit = config.timeout_unit || "hours";
                let tSec = timeoutUnit === "hours" ? timeoutAmount * 3600 : timeoutUnit === "days" ? timeoutAmount * 86400 : timeoutUnit === "minutes" ? timeoutAmount * 60 : timeoutAmount;
                const simSec = Math.min(tSec, 60); // Cap simulation to max 60s
                const displayT = timeoutUnit === "hours" ? `${timeoutAmount}h` : timeoutUnit === "days" ? `${timeoutAmount}d` : timeoutUnit === "minutes" ? `${timeoutAmount}min` : `${timeoutAmount}s`;

                addMessage({ type: "system", content: `⏳ Aguardando resposta do lead (${displayT}, simulação antecipada pra ${simSec}s)${immediate ? ' [⚡ Resp. Imediata]' : ''}...`, nodeId, nodeType });

                const response = await waitForUserInputWithTimeout(simSec);
                if (response === "__TIMEOUT__") {
                    addMessage({ type: "system", content: `⏱️ Tempo de aguardo esgotado!`, nodeId, nodeType });
                    const timeoutEdge = nextNodes.find(n => n.handleId === "timeout");
                    if (timeoutEdge) return timeoutEdge.targetId;
                    const fallbackEdge = nextNodes.find(n => n.handleId === "fallback");
                    if (fallbackEdge) return fallbackEdge.targetId;
                    return showRouteChoices(nodeId, nodeType, nodeLabel, nextNodes);
                }

                const respEdge = nextNodes.find(n => n.handleId === "responded");
                if (respEdge) {
                    await simDelay(300);
                    return respEdge.targetId;
                }
                return showRouteChoices(nodeId, nodeType, nodeLabel, nextNodes);
            }

            // --- CHECK SENDER ---
            case "check_sender": {
                const configPhones = (config.phones || []).filter((p: string) => p.trim());

                if (isVirtual) {
                    // Virtual: let user choose the route manually
                    addMessage({
                        type: "system",
                        content: `📱 ${nodeLabel} — Telefone virtual (${configPhones.length} na lista). Escolha o resultado:`,
                        nodeId, nodeType,
                    });
                    return showRouteChoices(nodeId, nodeType, nodeLabel, nextNodes);
                }

                // Real lead: actual phone comparison
                const leadPhone = lead?.phone || "";
                addMessage({ type: "system", content: `📱 Verificando ${leadPhone} na lista de ${configPhones.length} telefones...`, nodeId, nodeType });
                await simDelay(600);

                const matched = configPhones.some((p: string) => comparePhones(p, leadPhone));
                if (matched) {
                    addMessage({ type: "system", content: `✅ Número encontrado na lista!`, nodeId, nodeType });
                    const edge = nextNodes.find((n) => n.handleId === "yes");
                    if (edge) { await simDelay(300); return edge.targetId; }
                } else {
                    addMessage({ type: "system", content: `❌ Número NÃO encontrado na lista`, nodeId, nodeType });
                    const edge = nextNodes.find((n) => n.handleId === "no");
                    if (edge) { await simDelay(300); return edge.targetId; }
                }
                return showRouteChoices(nodeId, nodeType, nodeLabel, nextNodes);
            }

            // --- INTENT ROUTER ---
            case "intent_router": {
                // If virtual and no history yet, ask for user input first
                if (isVirtual && virtualHistoryRef.current.filter(m => m.role === "user").length === 0) {
                    addMessage({ type: "system", content: `💬 Digite uma mensagem para classificar a intenção:`, nodeId, nodeType });
                    await waitForUserInput();
                }

                addMessage({ type: "system", content: `🧠 ${nodeLabel} — Classificando com I.A...`, nodeId, nodeType });
                const typingId = addMessage({ type: "typing", content: "", nodeId, nodeType });

                const result = await classifyIntent(config);
                removeMessage(typingId);

                if (result) {
                    setTokensUsed((prev) => prev + result.tokens);
                    addMessage({ type: "system", content: `🎯 Intenção: ${result.intent} | Tokens: ${result.tokens}`, nodeId, nodeType });

                    const rawIntents: Array<string | { id?: string; label?: string }> = config.intents || [];
                    const formattedIntents = rawIntents.map((item, i) =>
                        typeof item === 'string'
                            ? { id: `intent_${i}`, label: item }
                            : { id: item.id || `intent_${i}`, label: item.label || '' }
                    );
                    
                    const normalizeString = (str: string) => str
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
                        .replace(/[^a-zA-Z0-9]/g, "") // Remove espaços, underscores, hífens
                        .toLowerCase();

                    const normalizedResult = normalizeString(result.intent);
                    let matchedIntent = formattedIntents.find(i => normalizeString(i.label) === normalizedResult);
                    
                    if (!matchedIntent) {
                        // Busca flexível agressiva
                        matchedIntent = formattedIntents.find(i => {
                            const normLabel = normalizeString(i.label);
                            return normalizedResult.includes(normLabel) || normLabel.includes(normalizedResult);
                        });
                    }
                    
                    if (matchedIntent) {
                        const matchingEdge = nextNodes.find((n) => n.handleId === matchedIntent.id);
                        if (matchingEdge) { await simDelay(400); return matchingEdge.targetId; }
                    }

                    const fallbackEdge = nextNodes.find((n) => n.handleId === "fallback");
                    if (fallbackEdge) {
                        addMessage({ type: "system", content: `↪️ Seguindo rota OUTROS (fallback)`, nodeId, nodeType });
                        await simDelay(400);
                        return fallbackEdge.targetId;
                    }

                    addMessage({ type: "system", content: `⚠️ Nenhuma rota para "${result.intent}" — escolha:`, nodeId, nodeType });
                } else {
                    addMessage({ type: "system", content: "⚠️ Classificação falhou — escolha manualmente:", nodeId, nodeType });
                }

                return showRouteChoices(nodeId, nodeType, nodeLabel, nextNodes);
            }

            // --- AI AGENT (with dialogue mode support) ---
            case "ai_agent": {
                const dialogueMode = config.dialogue_mode || false;
                const maxTurns = parseInt(config.max_turns || config.max_dialogue_turns || "10");
                const modelName = config.model || "gpt-4o-mini";

                // ✅ Fetch library files from API when enabled — do NOT rely on node.data.media_library_files
                // (node.data may be stale if the user just added files without refreshing the flow)
                let libraryFiles: any[] = [];
                if (config.media_library_enabled) {
                    // Use cached node.data if available and non-empty
                    const cached = Array.isArray(config.media_library_files) ? (config.media_library_files as any[]) : [];
                    if (cached.length > 0) {
                        libraryFiles = cached;
                    } else {
                        // Fetch directly from API using the nodeId
                        try {
                            const libRes = await fetch(`/api/v1/agent-library?nodeId=${encodeURIComponent(nodeId)}`);
                            if (libRes.ok) {
                                const libData = await libRes.json();
                                libraryFiles = libData.files || [];
                            }
                        } catch {
                            // Non-blocking — continue without library if API unreachable
                        }
                    }
                }

                // ✅ Create enriched config with resolved library files so buildSystemPrompt picks them up
                const configWithLibrary = libraryFiles.length > 0
                    ? { ...config, media_library_files: libraryFiles, media_library_enabled: true }
                    : config;

                // Interpolate the PROMPT USER MESSAGE with simulation context
                const rawPrompt = config.prompt || "";
                const interpolatedPrompt = interpolateWithContext(rawPrompt as string);
                const hasPreFilledPrompt = interpolatedPrompt.trim().length > 0;

                // Show config info
                addMessage({ type: "system", content: `🤖 ${nodeLabel} | Modelo: ${modelName}${dialogueMode ? " | Modo Diálogo" : ""}${libraryFiles.length > 0 ? ` | 📂 ${libraryFiles.length} arquivo(s)` : ""}`, nodeId, nodeType });

                // If prompt has content (fixed text or interpolated), inject as user message in single-shot mode
                if (!dialogueMode && hasPreFilledPrompt && virtualHistoryRef.current.filter(m => m.role === "user").length === 0) {
                    virtualHistoryRef.current.push({ role: "user", content: interpolatedPrompt });
                    addMessage({ type: "system", content: `📋 Prompt pré-preenchido com dados do contexto`, nodeId, nodeType });
                }

                if (dialogueMode) {
                    // --- DIALOGUE MODE: loop conversation ---
                    const objective = config.completion_condition || config.dialogue_objective;
                    if (objective) {
                        addMessage({ type: "system", content: `🎯 Objetivo: ${objective}`, nodeId, nodeType });
                    }

                    let turn = 0;
                    let objectiveCompleted = false;
                    let timedOut = false;

                    // If no user messages yet (and no pre-filled prompt), prompt for the first
                    if (virtualHistoryRef.current.filter(m => m.role === "user").length === 0) {
                        addMessage({ type: "system", content: `💬 Digite sua primeira mensagem para iniciar o diálogo:`, nodeId, nodeType });
                        await waitForUserInput();
                    }

                    while (turn < maxTurns && !abortRef.current && !objectiveCompleted) {
                        turn++;
                        addMessage({ type: "system", content: `💬 Turno ${turn}/${maxTurns}`, nodeId, nodeType });

                        // AI responds
                        const aiTypingId = addMessage({ type: "typing", content: "", nodeId, nodeType });
                        const aiResult = await callAI(configWithLibrary);
                        removeMessage(aiTypingId);

                        if (aiResult && !aiResult.error) {
                            setTokensUsed((prev) => prev + aiResult.tokens);

                            const objectiveRegex = /\[OBJETIVO_CONCLU[IÍ]DO\]/gi;
                            let hasObjective = objectiveRegex.test(aiResult.response);

                            // Extract file tag before splitting
                            // Pass the last user message so cross-validation can catch AI's wrong file picks
                            const lastUserMsg = [...virtualHistoryRef.current].reverse().find(m => m.role === 'user')?.content ?? '';
                            const { cleanText: responseNoFile, file: fileToSend, simulateFile, simulateTarget } = extractFileTag(
                                aiResult.response.replace(objectiveRegex, "").trim(),
                                libraryFiles,
                                lastUserMsg
                            );

                            // Parse AI parts using delimiter
                            const parts = responseNoFile.includes("⌁⌁⌁")
                                ? responseNoFile.split("⌁⌁⌁").map(p => p.trim()).filter(Boolean)
                                : responseNoFile.split(/\n+/).map(p => p.trim()).filter(Boolean);
                            const finalParts = parts.length > 0 ? parts : [responseNoFile];

                            if (responseNoFile) {
                                for (const p of finalParts) {
                                    addMessage({ type: "bot", content: p, nodeId, nodeType });
                                    addBotToHistory(p);
                                    await simDelay(400);
                                }
                            }

                            // Render file alongside text if library returned one
                            if (fileToSend) {
                                addMessage({
                                    type: "bot", content: "", nodeId, nodeType,
                                    media: { type: fileToSend.type, url: fileToSend.url, name: fileToSend.name }
                                });
                                addBotToHistory(`[Arquivo enviado: ${fileToSend.name}]`);
                                await simDelay(400);
                            }

                            if (simulateFile) {
                                await triggerSimulation(simulateFile, simulateTarget, nodeId, nodeType);
                            }
                            
                            addMessage({ type: "system", content: `🪙 Tokens gastos neste turno: ${aiResult.tokens}`, nodeId, nodeType });

                            // Check if AI signaled objective completion

                            // Se a IA não gerou a tag, fazemos a mesma checagem de produção (flow-engine.ts) com o Evaluator
                            if (!hasObjective && objective) {
                                const evalPrompt = `Com base na conversa abaixo, a seguinte condição foi satisfeita?\n\nCondição: "${objective}"\n\nÚltima mensagem do lead: "${lastUserMsg}"\nResposta do agente: "${aiResult.response}"\n\nResponda APENAS com SIM ou NÃO.`;
                                
                                const evalRes = await callAI({
                                    model: "gpt-4o-mini",
                                    system_message: "Você é um avaliador rigoroso. Responda apenas com SIM ou NÃO.",
                                    prompt: evalPrompt,
                                    temperature: 0
                                }, { virtual_history: [] });

                                console.log('[SIMULATOR EVALUATOR] Prompt:', evalPrompt);
                                console.log('[SIMULATOR EVALUATOR] Response:', evalRes);
                                addMessage({ type: "system", content: `[DEBUG EVALUATOR] Resposta bruta: ${evalRes?.response}`, nodeId, nodeType });
                                
                                if (evalRes && !evalRes.error) {
                                    const rawStr = (evalRes.response || "").trim().toUpperCase();
                                    // Check if it strictly is "SIM" or starts with "SIM." or "SIM," to avoid false positives like "SIMULAÇÃO"
                                    if (rawStr === 'SIM' || rawStr.startsWith('SIM.') || rawStr.startsWith('SIM,') || rawStr.startsWith('SIM ')) {
                                        hasObjective = true;
                                    }
                                }
                            }

                            if (hasObjective) {
                                addMessage({ type: "system", content: `✅ Objetivo concluído! (${aiResult.tokens} tokens)`, nodeId, nodeType });
                                objectiveCompleted = true;
                                break;
                            }
                        } else {
                            const errorMsg = aiResult?.error || 'O servidor não respondeu ou limite excedido.';
                            addMessage({ type: "bot", content: `[Erro na chamada I.A]`, nodeId, nodeType });
                            addMessage({ type: "system", content: `Detalhes: ${errorMsg}`, nodeId, nodeType });
                            break;
                        }

                        // Wait for user response (unless last turn) with timeout
                        if (turn < maxTurns) {
                            const timeoutEnabled = config.timeout_enabled || config.response_timeout_enabled || false;
                            const timeoutAmount = parseInt(config.timeout_amount || config.response_timeout_minutes || "30");
                            const timeoutUnit = config.timeout_unit || "minutes";
                            let timeoutSec = timeoutUnit === "hours" ? timeoutAmount * 3600 : timeoutUnit === "days" ? timeoutAmount * 86400 : timeoutAmount * 60;
                            // Cap simulated timeout to a reasonable max (60 sec)
                            const simTimeoutSec = timeoutEnabled ? Math.min(timeoutSec, 60) : 0;

                            if (timeoutEnabled) {
                                const displayTime = timeoutUnit === "hours" ? `${timeoutAmount}h` : timeoutUnit === "days" ? `${timeoutAmount}d` : `${timeoutAmount}min`;
                                if (turn === 1) {
                                    addMessage({ type: "system", content: `💬 Responda em até ${displayTime} (simulação: ${simTimeoutSec}s) ou "sair":`, nodeId, nodeType });
                                }
                                const userResponse = await waitForUserInputWithTimeout(simTimeoutSec);
                                if (userResponse === "__TIMEOUT__") {
                                    addMessage({ type: "system", content: `⏱️ Tempo esgotado! Lead não respondeu`, nodeId, nodeType });
                                    timedOut = true;
                                    break;
                                }
                                if (userResponse.toLowerCase() === "sair") {
                                    addMessage({ type: "system", content: `⏹️ Diálogo encerrado pelo usuário`, nodeId, nodeType });
                                    break;
                                }
                            } else {
                                if (turn === 1) {
                                    addMessage({ type: "system", content: `💬 Sua vez de responder (ou "sair" para encerrar):`, nodeId, nodeType });
                                }
                                const userResponse = await waitForUserInput();
                                if (userResponse.toLowerCase() === "sair") {
                                    addMessage({ type: "system", content: `⏹️ Diálogo encerrado pelo usuário`, nodeId, nodeType });
                                    break;
                                }
                            }
                        }

                    }

                    if (!objectiveCompleted && !timedOut && turn >= maxTurns) {
                        addMessage({ type: "system", content: `⚠️ Máximo de ${maxTurns} turnos atingido`, nodeId, nodeType });
                    }

                    // Route to completed or timeout
                    const completedEdge = nextNodes.find(n => n.handleId === "completed");
                    if (objectiveCompleted && completedEdge) return completedEdge.targetId;

                    const timeoutEdge = nextNodes.find(n => n.handleId === "timeout");
                    if ((timedOut || (!objectiveCompleted && turn >= maxTurns)) && timeoutEdge) return timeoutEdge.targetId;

                    // Show route choices as fallback
                    if (nextNodes.length > 1) {
                        return showRouteChoices(nodeId, nodeType, nodeLabel, nextNodes);
                    }
                    return nextNodes[0]?.targetId || null;

                } else {
                    // --- SINGLE-SHOT MODE ---
                    // Only wait for user input if there is NO pre-filled prompt in the history
                    if (isVirtual && virtualHistoryRef.current.filter(m => m.role === "user").length === 0) {
                        addMessage({ type: "system", content: `💬 Digite uma mensagem para conversar com ${nodeLabel}:`, nodeId, nodeType });
                        await waitForUserInput();
                    }

                    const aiTypingId = addMessage({ type: "typing", content: "", nodeId, nodeType });
                    const aiResult = await callAI(configWithLibrary);
                    removeMessage(aiTypingId);

                    if (aiResult) {
                        setTokensUsed((prev) => prev + aiResult.tokens);

                        // Extract file tag — pass last user message for cross-validation of product choice
                        const lastUserMsg2 = [...virtualHistoryRef.current].reverse().find(m => m.role === 'user')?.content ?? '';
                        const { cleanText: responseNoFile, file: fileToSend, simulateFile, simulateTarget } = extractFileTag(aiResult.response.trim(), libraryFiles, lastUserMsg2);

                        // Parse AI parts using delimiter
                        const parts = responseNoFile.includes("⌁⌁⌁")
                            ? responseNoFile.split("⌁⌁⌁").map(p => p.trim()).filter(Boolean)
                            : responseNoFile.split(/\n+/).map(p => p.trim()).filter(Boolean);
                        const finalParts = parts.length > 0 ? parts : [responseNoFile];

                        for (const p of finalParts) {
                            addMessage({ type: "bot", content: p, nodeId, nodeType });
                            addBotToHistory(p);
                            await simDelay(400);
                        }

                        // Render file alongside text if library returned one
                        if (fileToSend) {
                            addMessage({
                                type: "bot", content: "", nodeId, nodeType,
                                media: { type: fileToSend.type, url: fileToSend.url, name: fileToSend.name }
                            });
                            addBotToHistory(`[Arquivo enviado: ${fileToSend.name}]`);
                            await simDelay(400);
                        }

                        if (simulateFile) {
                            await triggerSimulation(simulateFile, simulateTarget, nodeId, nodeType);
                        }

                        addMessage({ type: "system", content: `📊 Tokens: ${aiResult.tokens}`, nodeId, nodeType });
                    } else {
                        addMessage({ type: "bot", content: `[${nodeLabel} — Erro I.A]`, nodeId, nodeType });
                    }

                    // If timeout_enabled, wait for response with timer before routing
                    const singleTimeout = config.timeout_enabled || config.response_timeout_enabled || false;
                    if (singleTimeout) {
                        const tAmount = parseInt(config.timeout_amount || config.response_timeout_minutes || "30");
                        const tUnit = config.timeout_unit || "minutes";
                        let tSec = tUnit === "hours" ? tAmount * 3600 : tUnit === "days" ? tAmount * 86400 : tAmount * 60;
                        const simSec = Math.min(tSec, 60);
                        const displayT = tUnit === "hours" ? `${tAmount}h` : tUnit === "days" ? `${tAmount}d` : `${tAmount}min`;
                        addMessage({ type: "system", content: `⏳ Aguardando resposta do lead (${displayT}, simulação: ${simSec}s)...`, nodeId, nodeType });
                        const resp = await waitForUserInputWithTimeout(simSec);
                        if (resp === "__TIMEOUT__") {
                            addMessage({ type: "system", content: `⏱️ Tempo esgotado!`, nodeId, nodeType });
                            const tEdge = nextNodes.find(n => n.handleId === "timeout");
                            if (tEdge) return tEdge.targetId;
                        }
                    }

                    // Route choices for completed/timeout
                    if (nextNodes.length > 1) {
                        return showRouteChoices(nodeId, nodeType, nodeLabel, nextNodes);
                    }
                    await simDelay(400);
                    return nextNodes[0]?.targetId || null;
                }
            }

            // --- FOLLOW UP AI ---
            case "follow_up_ai": {
                addMessage({ type: "system", content: `💌 ${nodeLabel} | Modelo: ${config.model || "gpt-4o-mini"}`, nodeId, nodeType });

                addMessage({ type: "system", content: `⏱️ Gerando mensagem de Follow Up I.A...`, nodeId, nodeType });

                if (isVirtual && virtualHistoryRef.current.filter(m => m.role === "user").length === 0) {
                    addMessage({ type: "system", content: `💬 Digite uma mensagem de contexto para gerar o follow-up:`, nodeId, nodeType });
                    await waitForUserInput();
                }

                const fuTypingId = addMessage({ type: "typing", content: "", nodeId, nodeType });

                const rawPrompt = config.prompt || "";
                const interpolatedPrompt = interpolateWithContext(rawPrompt);

                const fuResult = await callAI({
                    ...config,
                    system_message: `Você é um robô de Follow Up. O lead parou de responder há algum tempo. Sua missão é gerar uma mensagem curta e amigável tentando retomar o contato baseado no histórico. \nContexto adicional/Instrução: ${interpolatedPrompt}`
                });
                removeMessage(fuTypingId);

                if (fuResult) {
                    setTokensUsed((prev) => prev + fuResult.tokens);

                    // Parse AI parts using delimiter
                    const cleanResponse = fuResult.response.trim();
                    const parts = cleanResponse.includes("⌁⌁⌁")
                        ? cleanResponse.split("⌁⌁⌁").map(p => p.trim()).filter(Boolean)
                        : cleanResponse.split(/\n+/).map(p => p.trim()).filter(Boolean);
                    const finalParts = parts.length > 0 ? parts : [cleanResponse];

                    for (const p of finalParts) {
                        addMessage({ type: "bot", content: p, nodeId, nodeType });
                        addBotToHistory(p);
                        await simDelay(400);
                    }

                    addMessage({ type: "system", content: `📊 Tokens: ${fuResult.tokens}`, nodeId, nodeType });
                } else {
                    addMessage({ type: "bot", content: `[${nodeLabel} — Erro I.A]`, nodeId, nodeType });
                }

                // NOW wait for the response to the follow-up
                const timeoutAmount = parseInt(config.timeout_amount || "8");
                const timeoutUnit = config.timeout_unit || "hours";
                let tSec = timeoutUnit === "hours" ? timeoutAmount * 3600 : timeoutUnit === "days" ? timeoutAmount * 86400 : timeoutUnit === "minutes" ? timeoutAmount * 60 : timeoutAmount;
                const simSec = Math.min(tSec, 60); // Cap at 60s
                const displayT = timeoutUnit === "hours" ? `${timeoutAmount}h` : timeoutUnit === "days" ? `${timeoutAmount}d` : timeoutUnit === "minutes" ? `${timeoutAmount}min` : `${timeoutAmount}s`;

                addMessage({ type: "system", content: `⏳ Aguardando resposta ao Follow-Up (${displayT}, simulação restrita a ${simSec}s)...`, nodeId, nodeType });

                const response = await waitForUserInputWithTimeout(simSec);
                if (response !== "__TIMEOUT__") {
                    addMessage({ type: "system", content: `✅ O lead respondeu ao Follow-Up!`, nodeId, nodeType });
                    const respEdge = nextNodes.find(n => n.handleId === "responded");
                    if (respEdge) return respEdge.targetId;
                    return showRouteChoices(nodeId, nodeType, nodeLabel, nextNodes);
                }

                addMessage({ type: "system", content: `⏱️ Tempo esgotado (lead não respondeu ao Follow-Up).`, nodeId, nodeType });

                const notRespEdge = nextNodes.find(n => n.handleId === "not_responded");
                if (notRespEdge) return notRespEdge.targetId;

                if (nextNodes.length > 1) {
                    return showRouteChoices(nodeId, nodeType, nodeLabel, nextNodes);
                }
                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            // --- SEND AI RESPONSE ---
            case "send_ai_response": {
                addMessage({ type: "system", content: `📤 ${nodeLabel} — Enviando resposta I.A`, nodeId, nodeType });
                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            // --- CONDITION / FILTER / ROUTER ---
            case "condition":
            case "filter":
            case "router": {
                return showRouteChoices(nodeId, nodeType, nodeLabel, nextNodes);
            }

            case "crm_move": {
                const targetFunnel = config.target_funnel_name || "(Não configurado)";
                const targetStage = config.target_stage_name || "(Não configurado)";
                addMessage({ type: "system", content: `📋 Mover CRM: ${targetFunnel} → ${targetStage}`, nodeId, nodeType });
                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            case "bot_toggle": {
                const enabled = config.enabled !== false;
                addMessage({ type: "system", content: enabled ? "🤖 Robô ativado" : "🔇 Robô desativado", nodeId, nodeType });
                await simDelay(300);
                return nextNodes[0]?.targetId || null;
            }

            case "stop_bot": {
                addMessage({ type: "system", content: "⛔ Automação encerrada", nodeId, nodeType });
                return null;
            }

            case "loop_restart": {
                const loopMinutes = config.restart_after_minutes || 5;
                addMessage({ type: "system", content: `🔄 Loop: reiniciar após ${loopMinutes} min (simulação encerrada)`, nodeId, nodeType });
                return null;
            }

            case "capture_info": {
                const targetField = config.field_key || "(não definido)";
                const autoSave = config.auto_save_crm ?? true;
                const rawQuestion = config.question || "(pergunta não configurada)";
                const question = interpolateWithContext(rawQuestion);

                addMessage({ type: "system", content: `📝 Nó Capturar Info: perguntando e salvando em ${targetField}`, nodeId, nodeType });

                const typingId = addMessage({ type: "typing", content: "", nodeId, nodeType });
                await simDelay(800);
                removeMessage(typingId);

                addMessage({ type: "bot", content: question, nodeId, nodeType });
                addBotToHistory(question);

                const response = await waitForUserInput();

                // Simulate saving to context
                simulationContextRef.current[targetField] = response;

                if (autoSave) {
                    addMessage({ type: "system", content: `💾 CRM Auto-Save: O valor "${response}" foi salvo no campo "${targetField}" da empresa.`, nodeId, nodeType });
                }

                await simDelay(300);
                return nextNodes[0]?.targetId || null;
            }

            case "action": {
                const actionType = config.action_type || "(nenhuma)";
                let actionDesc = actionType;
                if (actionType === "assign_dynamic") actionDesc = "Atribuição Dinâmica (Agente ativo com menor carga)";
                else if (actionType === "assign_team") actionDesc = `Atribuir à Equipe: ${config.team_name || '(Sem equipe)'}`;
                else if (actionType === "assign_agent") actionDesc = `Atribuir Agente Fixo`;

                addMessage({ type: "system", content: `⚡ Ação Simulada: ${actionDesc}`, nodeId, nodeType });
                await simDelay(300);
                return nextNodes[0]?.targetId || null;
            }

            case "lookup_lead": {
                const searchBy = config.identifier_type || "telefone";
                addMessage({ type: "system", content: `🔍 Buscando Lead por ${searchBy}...`, nodeId, nodeType });
                await simDelay(500);
                addMessage({ type: "system", content: `✅ Lead encontrado na base (simulação)`, nodeId, nodeType });
                return nextNodes[0]?.targetId || null;
            }

            case "assign_user": {
                const assignType = config.assign_type || "user";
                addMessage({ type: "system", content: `👤 Atendimento delegado para ${assignType === 'team' ? 'equipe' : 'usuário'}`, nodeId, nodeType });
                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            case "add_note": {
                const noteContent = interpolateWithContext(config.note || "(vazio)");
                addMessage({ type: "internal", content: noteContent, nodeId, nodeType });
                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            case "add_tag": {
                addMessage({ type: "system", content: `🏷️ Tag adicionada ao lead`, nodeId, nodeType });
                await simDelay(300);
                return nextNodes[0]?.targetId || null;
            }

            case "http_request": {
                addMessage({ type: "system", content: `🌐 HTTP ${config.method || "GET"} → ${config.url || "(URL)"}`, nodeId, nodeType });
                await simDelay(500);
                return nextNodes[0]?.targetId || null;
            }

            case "code": {
                addMessage({ type: "system", content: "💻 Executando código", nodeId, nodeType });
                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            case "edit_fields": {
                const fields = config.fields || [];
                const fieldNames = fields.map((f: { name: string, field: string }) => f.name || f.field).join(", ") || "(nenhum)";
                addMessage({ type: "system", content: `✏️ Editando variáveis: ${fieldNames}`, nodeId, nodeType });
                await simDelay(300);
                return nextNodes[0]?.targetId || null;
            }

            case "update_contact": {
                const fields = config.fields || [];
                const fieldNames = fields.map((f: { name: string }) => f.name).join(", ") || "(nenhum)";
                addMessage({ type: "system", content: `💾 Atualizando Campos do Lead: ${fieldNames}`, nodeId, nodeType });
                
                // Simulate updating the CRM auto-save
                if (fields.length > 0) {
                    addMessage({ type: "system", content: `✅ Valores salvos no CRM com sucesso.`, nodeId, nodeType });
                }

                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            // --- MARKETING DATA ---
            case "marketing_data": {
                addMessage({ type: "system", content: `📊 ${nodeLabel} — Consultando campanhas Meta...`, nodeId, nodeType });
                const mktTypingId = addMessage({ type: "typing", content: "", nodeId, nodeType });

                try {
                    const dateRange = config.date_range || "30d";

                    // Map node config format to Edge Function preset format
                    const presetMap: Record<string, string> = {
                        "7d": "last_7d", "14d": "last_7d", "30d": "last_30d",
                        "60d": "last_90d", "90d": "last_90d", "all": "all_time",
                    };
                    let edgeDateRange: string = { preset: presetMap[dateRange] || "last_30d" };
                    // For 14d and 60d, use custom dates since there's no exact preset
                    if (dateRange === "14d" || dateRange === "60d") {
                        const days = parseInt(dateRange) || 30;
                        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
                        const yyyy = (d: Date) => d.toISOString().split("T")[0];
                        edgeDateRange = { start: yyyy(since), end: yyyy(new Date()) };
                    }

                    // Force fresh sync from Meta API with the correct period
                    addMessage({ type: "system", content: `🔄 Sincronizando dados frescos da Meta (${dateRange})...`, nodeId, nodeType });
                    await supabase.functions.invoke("marketing-api", {
                        body: { action: "sync_meta", organization_id: currentOrganization?.id, date_range: edgeDateRange },
                    });

                    // Now fetch the freshly synced campaigns
                    const { data: campaigns } = await supabase
                        .from("marketing_campaigns")
                        .select("*")
                        .eq("organization_id", currentOrganization?.id);

                    removeMessage(mktTypingId);

                    if (campaigns && campaigns.length > 0) {
                        // Filter out account total row and campaigns with zero activity
                        const regularCampaigns = campaigns.filter((c: Record<string, any>) =>
                            !c.raw_data?.is_account_total &&
                            ((c.spend || 0) > 0 || (c.clicks || 0) > 0 || (c.impressions || 0) > 0)
                        );
                        const isMessageObj = (c: Record<string, any>) => c.raw_data?.objective === 'MESSAGES' || c.raw_data?.objective === 'OUTCOME_ENGAGEMENT' || (c.campaign_name || '').includes('[MSGS]');

                        // Use account total for accurate global metrics
                        const accountTotal = campaigns.find((c: Record<string, any>) => c.raw_data?.is_account_total);
                        const totalSpend = accountTotal ? (accountTotal.spend || 0) : regularCampaigns.reduce((s: number, c: any) => s + (c.spend || 0), 0);
                        const totalClicks = accountTotal ? (accountTotal.clicks || 0) : regularCampaigns.reduce((s: number, c: any) => s + (c.clicks || 0), 0);
                        const totalImpressions = accountTotal ? (accountTotal.impressions || 0) : regularCampaigns.reduce((s: number, c: any) => s + (c.impressions || 0), 0);
                        const totalLeads = (accountTotal?.raw_data as Record<string, unknown>)?.leads || regularCampaigns.filter(isMessageObj).reduce((s: number, c: any) => s + (c.conversions || 0), 0);
                        const totalMessages = (accountTotal?.raw_data as Record<string, unknown>)?.messages_started || 0;
                        const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
                        const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100) : 0;
                        const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

                        // === Build formatted text ===
                        let formattedText = `=== RESUMO GERAL (${dateRange}) ===\nValor Investido: R$ ${totalSpend.toFixed(2)}\nLeads: ${totalLeads}\nCusto por Lead: R$ ${cpl.toFixed(2)}\nMensagens Iniciadas: ${totalMessages}\nCliques Totais: ${totalClicks}\nImpressões: ${totalImpressions}\nCTR: ${ctr.toFixed(2)}%\nCPC Médio: R$ ${cpc.toFixed(2)}`;

                        // === KPI Goals ===
                        if (config.include_kpis) {
                            try {
                                const { data: org, error: orgErr } = await supabase.from("organizations").select("settings").eq("id", currentOrganization?.id).maybeSingle();
                                if (orgErr) {
                                    addMessage({ type: "system", content: `⚠️ Erro ao buscar KPIs: ${orgErr.message}`, nodeId, nodeType });
                                }
                                const kpis = (org?.settings as Record<string, unknown>)?.marketing_kpis;
                                if (kpis && typeof kpis === "object") {
                                    const kpiLines: string[] = ["\n\n=== METAS KPI (Objetivos) ==="];
                                    if (kpis.target_cpl != null) kpiLines.push(`Meta CPL: R$ ${kpis.target_cpl} | Atual: R$ ${cpl.toFixed(2)} ${cpl <= kpis.target_cpl ? "✅" : "⚠️"}`);
                                    if (kpis.target_roas != null) kpiLines.push(`Meta ROAS: ${kpis.target_roas}x`);
                                    if (kpis.target_cpc != null) kpiLines.push(`Meta CPC: R$ ${kpis.target_cpc} | Atual: R$ ${cpc.toFixed(2)} ${cpc <= kpis.target_cpc ? "✅" : "⚠️"}`);
                                    if (kpis.target_ctr != null) kpiLines.push(`Meta CTR: ${kpis.target_ctr}% | Atual: ${ctr.toFixed(2)}% ${ctr >= kpis.target_ctr ? "✅" : "⚠️"}`);
                                    if (kpis.target_cpm != null) kpiLines.push(`Meta CPM: R$ ${kpis.target_cpm}`);
                                    if (kpiLines.length > 1) formattedText += kpiLines.join("\n");
                                } else {
                                    formattedText += "\n\n⚠️ Metas KPI ativadas mas nenhuma meta configurada nas Configurações da organização.";
                                }
                            } catch (kpiErr) {
                                addMessage({ type: "system", content: `⚠️ Erro ao buscar KPIs`, nodeId, nodeType });
                            }
                        }

                        // === Campaigns with data ===
                        formattedText += "\n\n=== CAMPANHAS COM DADOS ===";
                        for (const c of regularCampaigns) {
                            const leads = (c.raw_data as Record<string, unknown>)?.leads || 0;
                            const msgs = (c.raw_data as Record<string, unknown>)?.messages_started || 0;
                            formattedText += `\n\nCampanha: ${c.campaign_name}\nStatus: ${c.status}\nGasto: R$ ${(c.spend || 0).toFixed(2)}\nCliques: ${c.clicks || 0}\nImpressões: ${c.impressions || 0}\nConversões: ${c.conversions || 0}`;
                            if (leads > 0) formattedText += `\nLeads: ${leads} (CPL: R$ ${((c.spend || 0) / leads).toFixed(2)})`;
                            if (msgs > 0) formattedText += `\nMensagens Iniciadas: ${msgs}`;

                            // Ad Sets
                            const adsets = (c.raw_data as Record<string, unknown>)?.adsets || [];
                            const adsetsWithData = adsets.filter((a: { spend?: number; clicks?: number; [key: string]: unknown }) => (a.spend || 0) > 0 || (a.clicks || 0) > 0);
                            if (adsetsWithData.length > 0) {
                                formattedText += `\n  --- Conjuntos de Anúncios (${adsetsWithData.length}) ---`;
                                for (const as2 of adsetsWithData) {
                                    formattedText += `\n  • ${as2.adset_name || as2.adset_id}: Gasto R$ ${parseFloat(as2.spend || 0).toFixed(2)}, Cliques ${as2.clicks || 0}, Impressões ${as2.impressions || 0}`;
                                }
                            }

                            // Ads
                            const ads = (c.raw_data as Record<string, unknown>)?.ads || [];
                            const adsWithData = ads.filter((a: { spend?: number; clicks?: number; [key: string]: unknown }) => (a.spend || 0) > 0 || (a.clicks || 0) > 0);
                            if (adsWithData.length > 0) {
                                formattedText += `\n  --- Anúncios (${adsWithData.length}) ---`;
                                for (const ad of adsWithData) {
                                    formattedText += `\n  📢 ${ad.ad_name || ad.ad_id}: Gasto R$ ${parseFloat(ad.spend || 0).toFixed(2)}, Cliques ${ad.clicks || 0}`;
                                    if (ad.headline) formattedText += `\n     Título: ${ad.headline}`;
                                    if (ad.body_text) formattedText += `\n     Texto: ${ad.body_text}`;
                                    if (ad.autofill_message) formattedText += `\n     Msg Automática: ${ad.autofill_message}`;
                                }
                            }
                        }

                        // Store in simulation context
                        simulationContextRef.current[nodeLabel] = {
                            $json: { formatted_text: formattedText, marketing_data: campaigns }
                        };
                        simulationContextRef.current.marketing_data = campaigns;

                        addMessage({ type: "system", content: `✅ ${regularCampaigns.length} campanhas com dados carregadas no contexto (${campaigns.length - regularCampaigns.length - 1} sem dados excluídas)`, nodeId, nodeType });
                        addMessage({ type: "system", content: formattedText, nodeId, nodeType });
                    } else {
                        simulationContextRef.current[nodeLabel] = {
                            $json: { formatted_text: "Sem dados de campanhas ativos.", marketing_data: [] }
                        };
                        addMessage({ type: "system", content: `⚠️ Nenhuma campanha encontrada`, nodeId, nodeType });
                    }
                } catch (err) {
                    removeMessage(mktTypingId);
                    addMessage({ type: "system", content: `❌ Erro ao consultar campanhas`, nodeId, nodeType });
                }

                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            // --- PHASE 2 MISSING NODES ---
            case "ab_test": {
                addMessage({ type: "system", content: `⚖️ Teste A/B — Dividindo tráfego`, nodeId, nodeType });
                await simDelay(300);
                return showRouteChoices(nodeId, nodeType, nodeLabel, nextNodes);
            }

            case "business_hours": {
                addMessage({ type: "system", content: `⏱️ Verificando horário comercial`, nodeId, nodeType });
                await simDelay(300);
                return showRouteChoices(nodeId, nodeType, nodeLabel, nextNodes);
            }

            case "check_tag": {
                const tagId = config.tag_id;
                addMessage({ type: "system", content: `🏷️ Verificando tag ${tagId ? "(configurada)" : ""}`, nodeId, nodeType });
                await simDelay(300);
                return showRouteChoices(nodeId, nodeType, nodeLabel, nextNodes);
            }

            case "send_template":
            case "send_meta_template": {
                const templateName = config.template_name || "(não selecionado)";
                addMessage({ type: "system", content: `📲 Template Meta: ${templateName}`, nodeId, nodeType });
                const typingId = addMessage({ type: "typing", content: "", nodeId, nodeType });
                await simDelay(1500);
                removeMessage(typingId);
                addMessage({ type: "bot", content: `[Template: ${templateName}]`, nodeId, nodeType });
                return nextNodes[0]?.targetId || null;
            }

            case "send_email": {
                const subject = interpolateWithContext(config.subject || "(sem assunto)");
                addMessage({ type: "system", content: `📧 Enviando E-mail: "${subject}"`, nodeId, nodeType });
                await simDelay(800);
                return nextNodes[0]?.targetId || null;
            }

            case "internal_notification": {
                const msg = interpolateWithContext(config.message || "");
                addMessage({ type: "system", content: `🔔 Notificação Interna: ${msg}`, nodeId, nodeType });
                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            case "react_message": {
                const reaction = config.reaction || "👍";
                addMessage({ type: "system", content: `❤️ Reação enviada: ${reaction}`, nodeId, nodeType });
                await simDelay(400);
                return nextNodes[0]?.targetId || null;
            }

            case "wa_lists": {
                addMessage({ type: "system", content: `📋 Consultando Listas de Broadcast...`, nodeId, nodeType });
                await simDelay(600);
                addMessage({ type: "system", content: `✅ Consulta simulada com sucesso`, nodeId, nodeType });
                return nextNodes[0]?.targetId || null;
            }

            case "financeiro": {
                addMessage({ type: "system", content: `💰 Operação Financeira (Simulação)`, nodeId, nodeType });
                await simDelay(500);
                return nextNodes[0]?.targetId || null;
            }

            case "agenda": {
                addMessage({ type: "system", content: `📅 Agenda: Marcando Evento (Simulação)`, nodeId, nodeType });
                await simDelay(500);
                return nextNodes[0]?.targetId || null;
            }

            default: {
                addMessage({ type: "system", content: `⚠️ ${nodeLabel} (simulação não implementada)`, nodeId, nodeType });
                await simDelay(300);
                return nextNodes[0]?.targetId || null;
            }
        }
    }, [nodes, edges, addMessage, addBotToHistory, removeMessage, simDelay, waitForUserInput, waitForUserInputWithTimeout, waitForRouteChoice, onHighlightNode, classifyIntent, callAI, showRouteChoices, interpolateWithContext, currentOrganization?.id]);

    // -- Build full flow description for analysis --
    const buildFlowDescription = useCallback((): string => {
        const nodeDescs = nodes.map(n => {
            const cfg = (n.data as Record<string, unknown>)?.config || n.data || {};
            const label = (n.data as Record<string, unknown>)?.label || NODE_TYPE_LABELS[n.type || ""] || n.type;
            const outEdges = edges.filter(e => e.source === n.id);
            const details: string[] = [`Nó: "${label}" (tipo: ${n.type})`];
            if (cfg.system_message) details.push(`System Message: ${cfg.system_message.substring(0, 300)}...`);
            if (cfg.prompt) details.push(`Prompt: ${cfg.prompt.substring(0, 200)}...`);
            if (cfg.dialogue_mode) details.push(`Modo Diálogo: ON | Objetivo: ${cfg.dialogue_objective || '(não definido)'}`);
            if (cfg.message) details.push(`Mensagem: ${cfg.message.substring(0, 150)}...`);
            if (cfg.timeout_enabled) details.push(`Timeout: ${cfg.timeout_amount} ${cfg.timeout_unit}`);
            if (cfg.intents?.length) details.push(`Intenções: ${cfg.intents.join(', ')}`);
            if (cfg.instruction) details.push(`Instrução: ${cfg.instruction.substring(0, 200)}...`);
            if (cfg.phones?.length) details.push(`Telefones na lista: ${cfg.phones.length}`);
            if (cfg.target_funnel_name) details.push(`Funil: ${cfg.target_funnel_name} → ${cfg.target_stage_name}`);

            // New phase 2/3 node configs
            if (cfg.include_kpis) details.push(`Metas KPI: Habilitadas`);
            if (cfg.date_range) details.push(`Filtro de Relatório: ${cfg.date_range}`);
            if (cfg.template_name) details.push(`Template Meta: ${cfg.template_name}`);
            if (cfg.ab_variants) details.push(`Variantes A/B configuradas: ${cfg.ab_variants.length}`);
            if (cfg.tag_id) details.push(`Condição de Tag ATIVA`);
            if (cfg.subject) details.push(`Assunto E-mail: ${cfg.subject.substring(0, 50)}...`);
            if (outEdges.length > 0) {
                const routes = outEdges.map(e => {
                    const targetNode = nodes.find(nd => nd.id === e.target);
                    const targetLabel = (targetNode?.data as Record<string, unknown>)?.label || NODE_TYPE_LABELS[targetNode?.type || ""] || targetNode?.type;
                    return `${e.sourceHandle || 'default'} → "${targetLabel}"`;
                });
                details.push(`Saídas: ${routes.join(', ')}`);
            }
            return details.join('\n  ');
        });
        return nodeDescs.join('\n\n');
    }, [nodes, edges]);

    // -- Analysis functions --
    const runServiceAnalysis = useCallback(async () => {
        setAnalysisRunning('service');
        addMessage({ type: "system", content: "📊 Gerando análise do atendimento..." });
        const typingId = addMessage({ type: "typing", content: "" });

        const conversationText = virtualHistoryRef.current
            .map(m => `${m.role === 'user' ? 'LEAD' : 'ATENDENTE'}: ${m.content}`)
            .join('\n');

        // Get the AI agent's system message for context
        const aiAgentNode = nodes.find(n => n.type === 'ai_agent');
        const agentPrompt = (aiAgentNode?.data as Record<string, unknown>)?.config?.system_message || '';

        const analysisPrompt = `Você é um consultor especialista em atendimento ao cliente e vendas.

Analise a seguinte conversa simulada entre um atendente virtual (I.A) e um lead.

## PROMPT DO AGENTE:
${agentPrompt}

## CONVERSA:
${conversationText}

## ANALISE:
Forneça uma análise detalhada e personalizada cobrindo:

1. **Qualidade do Atendimento** (nota 1-10): O atendente seguiu o tom e personalidade definidos no prompt?
2. **Clareza e Objetividade**: As respostas foram claras?
3. **Engajamento**: O atendente manteve o lead engajado?
4. **Pontos Fortes**: O que o atendente fez bem?
5. **Pontos de Melhoria**: O que pode melhorar? Sugestões concretas.
6. **Aderência ao Prompt**: O atendente seguiu fielmente as instruções do prompt? Alguma instrução foi ignorada?
7. **Nota Final** (1-10) com justificativa.

Seja direto, prático e use emojis para organizar. Responda em português.`;

        try {
            const { data, error } = await supabase.functions.invoke('automation-executor', {
                body: {
                    simulate_ai_virtual: true,
                    organization_id: currentOrganization?.id,
                    config: {
                        credential_id: 'vitta-openai',
                        model: 'gpt-4.1',
                        system_message: analysisPrompt,
                        max_tokens: 1500,
                        temperature: 0.5,
                    },
                    virtual_history: [{ role: 'user', content: 'Analise o atendimento agora.' }],
                },
            });
            removeMessage(typingId);
            if (data?.response) {
                setTokensUsed(prev => prev + (data.total_tokens || 0));
                addMessage({ type: "bot", content: data.response });
                addMessage({ type: "system", content: `📊 Tokens usados na análise: ${data.total_tokens || 0}` });
            } else {
                addMessage({ type: "system", content: "❌ Erro ao gerar análise" });
            }
        } catch {
            removeMessage(typingId);
            addMessage({ type: "system", content: "❌ Erro na chamada de análise" });
        }
        setAnalysisRunning(null);
    }, [nodes, addMessage, removeMessage, currentOrganization?.id]);

    const runAutomationAnalysis = useCallback(async () => {
        setAnalysisRunning('automation');
        addMessage({ type: "system", content: "🔍 Gerando análise do traqueamento da automação..." });
        const typingId = addMessage({ type: "typing", content: "" });

        const flowDescription = buildFlowDescription();
        const conversationText = virtualHistoryRef.current
            .map(m => `${m.role === 'user' ? 'LEAD' : 'ATENDENTE'}: ${m.content}`)
            .join('\n');

        const aiAgentNode = nodes.find(n => n.type === 'ai_agent');
        const agentPrompt = (aiAgentNode?.data as Record<string, unknown>)?.system_message || (aiAgentNode?.data as Record<string, unknown>)?.config?.system_message || '';
        const agentLabel = (aiAgentNode?.data as Record<string, unknown>)?.label || 'Agente I.A';

        const analysisPrompt = `Você é um consultor especialista em automação de atendimento e CRM.

## OBJETIVO
Analise esta automação comparando o PROMPT DO AGENTE DE I.A com a ESTRUTURA DO FLUXO, verificando se o fluxo cobre tudo que o prompt precisa e sugerindo melhorias de rastreamento.

## PROMPT DO AGENTE "${agentLabel}":
${agentPrompt}

## ESTRUTURA COMPLETA DO FLUXO:
${flowDescription}

## CONVERSA SIMULADA:
${conversationText}

## NÓS DISPONÍVEIS NA PLATAFORMA (pode sugerir qualquer um):
- ${Object.keys(NODE_TYPE_LABELS).map(k => `**${k}**: ${NODE_TYPE_LABELS[k]}`).join('\n- ')}

## ANÁLISE SOLICITADA:

1. **Cobertura do Prompt** (nota 1-10): O fluxo de automação cobre todas as necessidades do prompt do agente?
   - Liste cada requisito do prompt e se o fluxo atende ou não.

2. **Rastreamento e CRM**: O fluxo rastreia adequadamente:
   - Etapa do lead no CRM? (crm_move)
   - Campos customizados preenchidos? (edit_fields, capture_info)
   - Etiquetas/tags aplicadas? (edit_fields)
   - Métricas de conversão?

3. **Nós Faltando**: Liste nós específicos que DEVERIAM existir no fluxo mas não existem. Para cada:
   - Tipo do nó e configuração sugerida
   - Onde posicionar no fluxo (após qual nó)
   - Por que é importante

4. **Fluxo Lógico**: O sequenciamento faz sentido? Há rotas mortas ou loops sem saída?

5. **Sugestões de Melhoria**: Top 5 melhorias concretas para maximizar conversão e rastreamento.

6. **Nota Final** (1-10) com justificativa.

MUITO IMPORTANTE: O seu retorno DEVE ser EXATAMENTE E APENAS um objeto JSON no seguinte formato:
{
  "report": "todo o texto da sua análise usando markdown com as métricas, tópicos e notas detalhadas de 1 a 6 acima",
  "corrections": [
    {
      "nodeId": "id do nó se for um nó existente, ou null se não souber",
      "type": "update_node" ou "add_node",
      "node_type": "se for add_node, o tipo de node (ex: crm_move). se for update_node pode ignorar",
      "field": "qual config atualizar (ex: 'prompt', 'timeout', etc) ou null",
      "suggestion": "descrição curta e direta do que deve ser alterado (ou o novo texto da IA/prompt esperado)",
      "reason": "Por que esta alteração é necessária"
    }
  ]
}
Não inclua crases markdown como \`\`\`json, retorne APENAS o JSON bruto e válido.`;

        try {
            const { data, error } = await supabase.functions.invoke('automation-executor', {
                body: {
                    simulate_ai_virtual: true,
                    organization_id: currentOrganization?.id,
                    config: {
                        credential_id: 'vitta-openai',
                        model: 'gpt-4o',
                        system_message: analysisPrompt,
                        max_tokens: 3000,
                        temperature: 0.3,
                    },
                    virtual_history: [{ role: 'user', content: 'Analise a automação agora em formato JSON.' }],
                },
            });
            removeMessage(typingId);
            if (data?.response) {
                setTokensUsed(prev => prev + (data.total_tokens || 0));

                try {
                    let cleanedData = data.response.trim();
                    if (cleanedData.startsWith("\`\`\`json")) cleanedData = cleanedData.replace(/^\`\`\`json/, "");
                    if (cleanedData.endsWith("\`\`\`")) cleanedData = cleanedData.replace(/\`\`\`$/, "");

                    const parsed = JSON.parse(cleanedData);
                    if (parsed.report) {
                        addMessage({ type: "bot", content: parsed.report });
                    } else {
                        addMessage({ type: "bot", content: data.response });
                    }

                    if (parsed.corrections && parsed.corrections.length > 0 && onCorrectionsGenerated) {
                        onCorrectionsGenerated(parsed.corrections);
                        addMessage({ type: "system", content: `✨ Foram mapeadas ${parsed.corrections.length} sugestões de correção na tela de automações! Crie o botão para visualizar.` });
                    }
                } catch (e: unknown) {
                    addMessage({ type: "bot", content: data.response });
                }

                addMessage({ type: "system", content: `📊 Tokens usados na análise: ${data.total_tokens || 0}` });
            } else {
                addMessage({ type: "system", content: "❌ Erro ao gerar análise" });
            }
        } catch {
            removeMessage(typingId);
            addMessage({ type: "system", content: "❌ Erro na chamada de análise" });
        }
        setAnalysisRunning(null);
    }, [nodes, buildFlowDescription, addMessage, removeMessage, currentOrganization?.id]);

    const startSimulation = useCallback(async () => {
        abortRef.current = false;
        setMessages([]);
        setSimulatorLogId(null);
        setIsRunning(true);
        setSimFinished(false);
        setWaitingInput(false);
        setRouteChoice(null);
        setTokensUsed(0);
        virtualHistoryRef.current = [];
        simulationContextRef.current._memory_saved = false;

        const trigger = findTriggerNode(nodes, edges);
        if (!trigger) {
            addMessage({ type: "system", content: "❌ Nenhum nó de Gatilho encontrado" });
            setIsRunning(false);
            return;
        }

        // Inject lead data into context if using a real lead
        if (!useVirtualLead && selectedLead) {
            simulationContextRef.current.lead_name = selectedLead.name || "";
            simulationContextRef.current.phone = selectedLead.phone || "";
        }

        let nextNodeId: string | null = trigger.id;
        while (nextNodeId && !abortRef.current) {
            nextNodeId = await processNode(nextNodeId);
        }

        if (!abortRef.current) {
            setSimFinished(true);
            addMessage({ type: "system", content: "✅ Simulação concluída!" });

            const aiNode = nodes.find(n => n.type === 'ai_agent' || n.type === 'ai');
            if (aiNode && !disableLearning && virtualHistoryRef.current.length >= 3 && !simulationContextRef.current._memory_saved) {
                setLearningDecision('pending');
            } else {
                setLearningDecision(null);
            }
        }
        setIsRunning(false);
        setCurrentNodeId(null);
        onHighlightNode?.(null);
    }, [nodes, processNode, addMessage, removeMessage, onHighlightNode, automationId, onCorrectionsGenerated, onMemoryUpdated, disableLearning]);

    const triggerLearning = useCallback(async (skip: boolean) => {
        if (skip) {
            setLearningDecision('skipped');
            return;
        }

        const aiNode = nodes.find(n => n.type === 'ai_agent' || n.type === 'ai');
        if (!aiNode) {
            setLearningDecision('skipped');
            return;
        }

        setLearningDecision('generating');
        simulationContextRef.current._memory_saved = true;
        const historySnapshot = [...virtualHistoryRef.current];
        
        const typingMsgId = addMessage({ type: "typing", content: "🧠 I.A. refletindo sobre o atendimento para auto-aprendizado..." });
        
        try {
            const res = await fetch('/api/v1/automations/simulator/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ruleId: automationId || 'new',
                    nodeId: aiNode.id,
                    virtual_history: historySnapshot,
                    system_message: (aiNode.data as any)?.system_message || (aiNode.data as any)?.config?.system_message || "",
                    existing_notes: (aiNode.data as any)?.learning_notes || (aiNode.data as any)?.config?.learning_notes || "",
                    reflection_prompt: (aiNode.data as any)?.reflection_prompt || (aiNode.data as any)?.config?.reflection_prompt || "",
                    is_sandbox: useVirtualLead
                })
            });
            
            if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
            const data = await res.json();
            
            removeMessage(typingMsgId);
            if (data.tokens) setTokensUsed(prev => prev + data.tokens);
            
            if (data.success && data.fullNotes) {
                addMessage({ type: "system", content: `🧠 Memória da I.A. atualizada após reflexão! (${data.tokens || 0} tokens gastos na revisão)` });
                if (onMemoryUpdated) onMemoryUpdated(aiNode.id, data.fullNotes);
            } else if (data.message?.includes('Nenhum aprendizado')) {
                addMessage({ type: "system", content: `🧠 I.A. revisou o atendimento e não encontrou erros. (${data.tokens || 0} tokens gastos)` });
            } else if (data.message) {
                addMessage({ type: "system", content: `⚠️ Aviso de Memória: ${data.message}` });
            } else if (data.error) {
                addMessage({ type: "system", content: `❌ Erro na Memória: ${data.error}` });
            }
        } catch (err: any) {
            removeMessage(typingMsgId);
            addMessage({ type: "system", content: `❌ Falha ao tentar atualizar memória: ${err.message}` });
        } finally {
            setLearningDecision('done');
        }
    }, [nodes, automationId, addMessage, removeMessage, onMemoryUpdated, useVirtualLead]);

    const fullReset = useCallback(() => {
        abortRef.current = true;
        resolveInputRef.current?.("");
        resolveRouteRef.current?.("");
        setMessages([]);
        setSimulatorLogId(null);
        setIsRunning(false);
        setWaitingInput(false);
        setRouteChoice(null);
        setCurrentNodeId(null);
        setSimFinished(false);
        setTokensUsed(0);
        setShowLeadSelector(true);
        setSelectedLead(null);
        setUseVirtualLead(false);
        setLeadSearch("");
        setLeadResults([]);
        selectedLeadRef.current = null;
        isVirtualRef.current = false;
        virtualHistoryRef.current = [];
        simulationContextRef.current = {};
        onHighlightNode?.(null);
    }, [onHighlightNode, automationId, nodes, onMemoryUpdated, removeMessage]);

    const stopSimulation = useCallback(() => {
        abortRef.current = true;
        setIsRunning(false);
        setWaitingInput(false);
        setRouteChoice(null);
        setCurrentNodeId(null);
        onHighlightNode?.(null);
        resolveInputRef.current?.("");
        resolveRouteRef.current?.("");
    }, [onHighlightNode]);

    const cycleSpeed = useCallback(() => {
        setSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : prev === 4 ? 0 : 1));
    }, []);

    const downloadLog = useCallback(() => {
        const leadName = useVirtualLead ? "Lead Virtual" : (selectedLead?.name || "—");
        let content = "========================================\n";
        content += "   VITTAIA - RELATÓRIO DE SIMULAÇÃO\n";
        content += "========================================\n\n";
        content += "Data: " + new Date().toLocaleString("pt-BR") + "\n";
        content += `Lead: ${leadName}\n`;
        content += `Modo de Execução: ${useVirtualLead ? "Virtual (Sandbox)" : "Real (Ações efetivadas)"}\n`;
        content += `Total de Tokens Consumidos: ${tokensUsed}\n`;
        content += "\n--- LOG DE EXECUÇÃO DETALHADO ---\n\n";

        messages.forEach((m) => {
            const time = m.timestamp.toLocaleTimeString("pt-BR");
            if (m.type === "system") {
                content += `[${time}] ⚙️ SISTEMA: ${m.content}\n`;
            } else if (m.type === "user") {
                content += `[${time}] 👤 LEAD: ${m.content}\n`;
            } else if (m.type === "bot") {
                // If it has media
                let mediaText = "";
                if (m.media) {
                    mediaText = `[Mídia: ${m.media.type} | ${m.media.name || 'arquivo'}] `;
                }
                content += `[${time}] 🤖 I.A/ATEND: ${mediaText}${m.content}\n`;
            }
        });

        content += "\n========================================\n";
        content += "   FIM DO RELATÓRIO\n";
        content += "========================================\n";

        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `log_simulador_vitta_${new Date().getTime()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [messages, tokensUsed, selectedLead, useVirtualLead]);

    const currentLeadName = useVirtualLead ? "Lead Virtual" : (selectedLead?.name || "—");

    return {
        messages,
        currentNodeId,
        isRunning,
        waitingInput,
        routeChoice,
        userInput,
        setUserInput,
        speed,
        setSpeed,
        simFinished,
        analysisRunning,
        selectedLead,
        setSelectedLead,
        leadSearch,
        setLeadSearch,
        leadResults,
        showLeadSelector,
        setShowLeadSelector,
        searchingLeads,
        tokensUsed,
        useVirtualLead,
        setUseVirtualLead,
        timeoutCountdown,
        fileInputRef,
        messagesEndRef,
        cycleSpeed,
        handleSendInput,
        simulateUserInput,
        handleMediaAttach,
        handleRouteSelect,
        startSimulation,
        stopSimulation,
        runServiceAnalysis,
        runAutomationAnalysis,
        fullReset,
        downloadLog,
        currentLeadName,
        selectedLeadRef,
        isVirtualRef,
        learningDecision,
        triggerLearning
    };
}
