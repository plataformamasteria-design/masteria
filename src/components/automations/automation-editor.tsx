'use client';

import React, { useCallback, useState, useMemo } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    BackgroundVariant,
    Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { MessageNode, SendMessageNode } from './nodes/message-node';
import { TriggerNode } from './nodes/trigger-node';
import { ActionNode } from './nodes/action-node';
import { MediaNode } from './nodes/media-node';
import { LogicNode } from './nodes/logic-node';
import { InteractionNode } from './nodes/interaction-node';
import { AINode } from './nodes/ai-node';
import { CRMNode } from './nodes/crm-node';
import { MarketingNode } from './nodes/marketing-node';
import { SystemNode } from './nodes/system-node';
import { UtilityNode } from './nodes/utility-node';
import { SendImageNode } from './nodes/send-image-node';
import { SendAudioNode } from './nodes/send-audio-node';
import { SendDocumentNode } from './nodes/send-document-node';
import { SendVideoNode } from './nodes/send-video-node';
import { AskQuestionNode } from './nodes/ask-question-node';
import { CaptureInfoNode } from './nodes/capture-info-node';
import { WaitResponseNode } from './nodes/wait-response-node';
import { ConditionNode } from './nodes/condition-node';
import { FilterNode } from './nodes/filter-node';
import { RouterNode } from './nodes/router-node';
import { DelayNode } from './nodes/delay-node';
import { CrmMoveNode } from './nodes/crm-move-node';
import { BotToggleNode } from './nodes/bot-toggle-node';
import { StopBotNode } from './nodes/stop-bot-node';
import { LoopRestartNode } from './nodes/loop-restart-node';
import { AiAgentNode } from './nodes/ai-agent-node';
import { IntentRouterNode } from './nodes/intent-router-node';
import { FollowUpAiNode } from './nodes/follow-up-ai-node';
import { SendAiResponseNode } from './nodes/send-ai-response-node';
import { HttpRequestNode } from './nodes/http-request-node';
import { CodeNode } from './nodes/code-node';
import { EditFieldsNode } from './nodes/edit-fields-node';
import { LookupLeadNode } from './nodes/lookup-lead-node';
import { SendTemplateNode } from './nodes/send-template-node';
import { AddNoteNode } from './nodes/add-note-node';
import { AssignUserNode } from './nodes/assign-user-node';
import { saveFlow, getFlow } from '@/lib/automations';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useSession } from '@/contexts/session-context';
import {
    MessageSquare,
    Image as ImageIcon,
    Clock,
    GitBranch,
    UserPlus,
    Plus,
    ChevronDown,
    Brain,
    Bot,
    Rocket,
    Shield,
    Terminal,
    Database,
    Binary,
    Zap,
    Settings2,
    Loader2,
    Mic,
    FileText,
    Video,
    HelpCircle,
    MessageCircle,
    Filter,
    ArrowRightLeft,
    RefreshCw,
    ShieldOff,
    Globe,
    Code2,
    PenLine,
    Signpost,
    Send,
    DollarSign,
    CalendarPlus,
    MessageSquareHeart,
    LayoutGrid,
    History,
    Play,
    Radio,
    Sparkles,
    X as XIcon,
    UserSearch,
    MessageSquareShare,
    StickyNote,
    Columns3,
    Hash,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import MasterFlowEdge from './master-flow-edge';
import { getAutoLayoutNodes } from '@/lib/auto-layout';
import { ExecutionHistoryPanel } from './ExecutionHistoryPanel';
import { NodeConfigPanel } from './NodeConfigPanel';
import { NodeOutputPanel } from './NodeOutputPanel';
import { NodeInputPanel } from './NodeInputPanel';
import { useNodeTestOutputs } from '@/hooks/useNodeTestOutputs';

const nodeTypes = {
    // System
    trigger: TriggerNode,
    // Messages (V3)
    send_message: SendMessageNode,
    send_image: SendImageNode,
    send_audio: SendAudioNode,
    send_document: SendDocumentNode,
    send_video: SendVideoNode,
    // Interaction (V3)
    ask_question: AskQuestionNode,
    capture_info: CaptureInfoNode,
    wait_response: WaitResponseNode,
    // Logic (V3)
    condition: ConditionNode,
    filter: FilterNode,
    router: RouterNode,
    delay: DelayNode,
    // CRM & Actions (V3)
    crm_move: CrmMoveNode,
    bot_toggle: BotToggleNode,
    stop_bot: StopBotNode,
    loop_restart: LoopRestartNode,
    // AI (V3)
    ai_agent: AiAgentNode,
    intent_router: IntentRouterNode,
    follow_up_ai: FollowUpAiNode,
    send_ai_response: SendAiResponseNode,
    // Advanced (V3)
    http_request: HttpRequestNode,
    code: CodeNode,
    edit_fields: EditFieldsNode,
    // New nodes (V3.1)
    lookup_lead: LookupLeadNode,
    send_template: SendTemplateNode,
    add_note: AddNoteNode,
    assign_user: AssignUserNode,
    // Legacy (backward compat)
    message: MessageNode,
    media: MediaNode,
    logic: LogicNode,
    interaction: InteractionNode,
    ai: AINode,
    action: ActionNode,
    crm: CRMNode,
    marketing: MarketingNode,
    system: SystemNode,
    utility: UtilityNode,
};

const edgeTypes = {
    'master-flow': MasterFlowEdge,
};

const initialNodes: Node[] = [
    {
        id: '1',
        type: 'trigger',
        position: { x: 100, y: 100 },
        data: { label: 'Gatilho: Nova Mensagem', triggerType: 'message_received' },
    },
];

const initialEdges: Edge[] = [];

interface AutomationEditorProps {
    flowId: string;
    onSave?: (id: string, name: string) => void;
}

export function AutomationEditor({ flowId, onSave }: AutomationEditorProps) {
    const { session } = useSession();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [flowName, setFlowName] = useState('Nova Automação MasterFlow');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingFlow, setIsLoadingFlow] = useState(flowId !== 'new');
    const [editingNode, setEditingNode] = useState<Node | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [showFlowTestResults, setShowFlowTestResults] = useState(false);
    const [aiPromptOpen, setAiPromptOpen] = useState(false);
    const [aiPromptText, setAiPromptText] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [webhookListenState, setWebhookListenState] = useState<'idle' | 'listening' | 'received'>('idle');
    const [menuPosition, setMenuPosition] = useState<{ x: number, y: number, sourceNodeId?: string, sourceHandleId?: string | null } | null>(null);
    const [rfInstance, setRfInstance] = useState<any>(null);

    // Node testing system
    const {
        outputs: testOutputs,
        isTestingNode,
        isTestingFlow,
        isListening,
        flowTestProgress,
        testNode,
        testFlow,
        listenForWebhook,
        cancelListen,
        clearOutputs,
        getNodeOutput,
    } = useNodeTestOutputs();

    const handleTestFlow = useCallback(async () => {
        if (!session?.empresaId) return;
        setShowFlowTestResults(true);

        // Detectar se o trigger é webhook
        const triggerNode = nodes.find(n => n.type === 'trigger');
        const isWebhookTrigger = triggerNode?.data?.trigger_type === 'webhook_external';

        let initialVars: Record<string, any> = {};
        let contactId = `test-${Date.now()}`;

        if (isWebhookTrigger && triggerNode) {
            // Modo N8N: escutar webhook real primeiro
            setWebhookListenState('listening');
            const webhookResult = await listenForWebhook(triggerNode.id, flowId, triggerNode.data);

            if (webhookResult && webhookResult.status === 'ok' && webhookResult.output) {
                setWebhookListenState('received');
                const webhookData = webhookResult.output;
                const webhookBody = webhookData.body || webhookData;

                initialVars = {
                    webhook_body: webhookBody,
                    body: webhookBody,
                    ...(typeof webhookBody === 'object' ? webhookBody : {}),
                };

                // Usar telefone do webhook como contactId se disponível
                contactId = initialVars.customer_phone || initialVars.phone || initialVars.contact_phone || contactId;
            } else {
                setWebhookListenState('idle');
                return; // Cancelado ou timeout
            }
        }

        // Executar REAL via test-real API
        try {
            const res = await fetch('/api/v1/automation-flows/test-real', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    flowId,
                    companyId: session.empresaId,
                    initialVars,
                    contactId,
                }),
            });
            const data = await res.json();

            if (data.success) {
                // Converter logs reais em formato NodeTestOutput para o painel
                const realOutputs: Record<string, any> = {};
                if (data.logs?.length) {
                    for (const log of data.logs) {
                        realOutputs[log.nodeId] = {
                            nodeId: log.nodeId,
                            nodeType: 'real',
                            nodeLabel: log.nodeId,
                            output: { status: log.status, message: log.message },
                            outputType: 'json',
                            status: log.status === 'ok' ? 'ok' : log.status === 'error' ? 'error' : 'ok',
                            executionTime: 0,
                            message: log.message || `${log.status}`,
                        };
                    }
                }
                // Mostrar resultado geral
                realOutputs['_execution'] = {
                    nodeId: '_execution',
                    nodeType: 'real',
                    nodeLabel: '✅ Execução Real',
                    output: {
                        executionId: data.executionId,
                        status: data.status,
                        contactId: data.contactId,
                        executionTime: data.executionTime,
                        logs: data.logs?.length || 0,
                    },
                    outputType: 'json',
                    status: 'ok',
                    executionTime: data.executionTime || 0,
                    message: `Execução real concluída em ${data.executionTime}ms`,
                };

                // Usar testFlow para popular o painel visual com resultados reais
                // Mas como é execução real, vamos popular diretamente
                await testFlow(nodes, edges, session.empresaId, initialVars);
            } else {
                // Erro na execução real
                await testFlow(nodes, edges, session.empresaId, initialVars);
            }
        } catch (err: any) {
            console.error('[handleTestFlow] Real execution error:', err);
            await testFlow(nodes, edges, session.empresaId, initialVars);
        }

        if (webhookListenState === 'received') {
            setTimeout(() => setWebhookListenState('idle'), 3000);
        }
    }, [nodes, edges, session?.empresaId, testFlow, listenForWebhook, flowId, webhookListenState]);

    const handleTestNode = useCallback(async (nodeId: string) => {
        if (!session?.empresaId) return;
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        await testNode(nodeId, node.type || '', node.data, session.empresaId);
    }, [nodes, session?.empresaId, testNode]);

    const handleListenWebhook = useCallback(async (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        await listenForWebhook(nodeId, flowId, node.data);
    }, [nodes, flowId, listenForWebhook]);

    // Auto-layout handler
    const handleAutoLayout = useCallback(async () => {
        const layoutedNodes = await getAutoLayoutNodes(nodes, edges, 'TB');
        setNodes(layoutedNodes);
        toast.success('Layout organizado automaticamente!');
    }, [nodes, edges, setNodes]);

    // AI Workflow Generator
    const handleGenerateWithAI = useCallback(async () => {
        if (!aiPromptText.trim()) return;
        setIsGeneratingAI(true);
        try {
            const response = await fetch('/api/v1/automation-flows/generate-workflow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPromptText }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Erro ao gerar workflow.');
            }

            // Aplicar nodes gerados pela IA
            const newNodes = data.nodes.map((node: any) => ({
                ...node,
                data: {
                    ...node.data,
                    label: node.data?.label || node.type || 'Node',
                },
            }));

            // Aplicar auto-layout para organizar visualmente
            const layoutedNodes = await getAutoLayoutNodes(newNodes, data.edges, 'TB');
            setNodes(layoutedNodes);
            setEdges(data.edges);

            // Sugerir nome do fluxo se fornecido
            if (data.name) {
                setFlowName(data.name);
            }

            setAiPromptOpen(false);
            setAiPromptText('');
            toast.success('Workflow criado com IA!', {
                description: `${data.nodes.length} nodes gerados e organizados.`,
            });
        } catch (error: any) {
            console.error('AI Generate Error:', error);
            toast.error('Erro ao gerar workflow', {
                description: error.message,
            });
        } finally {
            setIsGeneratingAI(false);
        }
    }, [aiPromptText, setNodes, setEdges]);

    // Helper: get IDs of nodes connected before the current editing node
    const previousNodeIds = useMemo(() => {
        if (!editingNode) return [];
        const result: string[] = [];
        const visited = new Set<string>();

        function walkBack(nodeId: string) {
            const incoming = edges.filter(e => e.target === nodeId);
            for (const edge of incoming) {
                if (!visited.has(edge.source)) {
                    visited.add(edge.source);
                    result.push(edge.source);
                    walkBack(edge.source);
                }
            }
        }

        walkBack(editingNode.id);
        return result;
    }, [editingNode, edges]);

    // Carregar dados iniciais
    React.useEffect(() => {
        if (flowId === 'new' || !session?.empresaId) {
            setIsLoadingFlow(false);
            return;
        }

        async function load() {
            try {
                const flow = await getFlow(flowId, session!.empresaId);
                if (flow) {
                    setFlowName(flow.name);
                    if (flow.visualData) {
                        const visual = flow.visualData as any;
                        const savedNodes = Array.isArray(visual.nodes) ? visual.nodes : [];
                        const savedEdges = Array.isArray(visual.edges) ? visual.edges : [];
                        setNodes(savedNodes);
                        setEdges(savedEdges);
                    }
                }
            } catch (error) {
                console.error('[Editor] Error loading flow:', error);
                toast.error('Erro ao carregar os dados do fluxo.');
            } finally {
                setIsLoadingFlow(false);
            }
        }
        load();
    }, [flowId, session?.empresaId, setNodes, setEdges]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({
            ...params,
            type: 'master-flow',
            animated: true,
        }, eds)),
        [setEdges],
    );

    const onConnectEnd = useCallback(
        (event: any, connectionState: any) => {
            if (!connectionState.isValid) {
                const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
                const { fromNode, fromHandle } = connectionState;
                if (!fromNode) return;

                setMenuPosition({
                    x: clientX,
                    y: clientY,
                    sourceNodeId: fromNode.id,
                    sourceHandleId: fromHandle?.id || null,
                });
            }
        },
        [setMenuPosition]
    );

    const onPaneClick = useCallback(() => {
        setMenuPosition(null);
    }, []);

    const handleSave = async () => {
        if (!session?.empresaId) {
            toast.error('Erro: Sessão não encontrada. Por favor, faça login novamente.');
            return;
        }

        setIsSaving(true);
        try {
            // Sanitizar nodes para remover funções não serializáveis (onDelete)
            const cleanNodes = nodes.map(node => {
                const { onDelete, ...cleanData } = node.data as any;
                return { ...node, data: cleanData };
            });

            const visualData = { nodes: cleanNodes, edges };

            // Extrair lógica simplificada para o motor de execução
            const steps = cleanNodes.map(node => ({
                id: node.id,
                type: node.type,
                data: node.data,
                nextSteps: edges.filter(e => e.source === node.id).map(e => e.target),
                connections: edges.filter(e => e.source === node.id).map(e => ({
                    target: e.target,
                    sourceHandle: e.sourceHandle
                }))
            }));

            const result = await saveFlow(flowId, flowName, session.empresaId, visualData, steps);
            if (result.success) {
                toast.success('Fluxo de automação salvo com sucesso!');
                if (onSave && result.flow) {
                    onSave(result.flow.id, result.flow.name);
                }
            }
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Erro ao salvar o fluxo de automação. Verifique os dados e tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteNode = useCallback(
        (id: string) => {
            setNodes((nds) => nds.filter((node) => node.id !== id));
            setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
            setEditingNode((prev) => prev?.id === id ? null : prev);
        },
        [setNodes, setEdges],
    );

    const onNodesDelete = useCallback(
        (deletedNodes: Node[]) => {
            const deletedIds = deletedNodes.map(n => n.id);
            setEdges((eds) => eds.filter(e => !deletedIds.includes(e.source) && !deletedIds.includes(e.target)));
            setEditingNode((prev) => prev && deletedIds.includes(prev.id) ? null : prev);
        },
        [setEdges]
    );

    const addNode = (type: string, data: any = {}) => {
        const id = `${type}-${Date.now()}`;

        let position = { x: Math.random() * 400, y: Math.random() * 400 };
        if (menuPosition && rfInstance) {
            position = rfInstance.screenToFlowPosition({ x: menuPosition.x, y: menuPosition.y });
        }

        const newNode: Node = {
            id,
            type,
            position,
            data: {
                label: type,
                onDelete: () => deleteNode(id),
                ...data
            },
        };
        setNodes((nds) => nds.concat(newNode));

        // Connect the node if we initiated "drag to add"
        if (menuPosition && menuPosition.sourceNodeId) {
            const edgeId = `e-${menuPosition.sourceNodeId}-${id}`;
            const newEdge = {
                id: edgeId,
                source: menuPosition.sourceNodeId,
                sourceHandle: menuPosition.sourceHandleId || undefined,
                target: id,
                targetHandle: undefined,
                type: 'master-flow',
                animated: true
            };
            setEdges((eds) => addEdge(newEdge as any, eds));
        }

        setMenuPosition(null);
    };

    // Atualizar nodes iniciais para incluir onDelete
    React.useEffect(() => {
        setNodes((nds) => {
            if (!Array.isArray(nds)) return [];
            return nds.map(node => ({
                ...node,
                data: {
                    ...node.data,
                    onDelete: () => deleteNode(node.id)
                }
            }));
        });
    }, [deleteNode, setNodes]);

    const onNodeClick = useCallback((_: any, node: Node) => {
        setEditingNode(node);
    }, []);

    const updateNodeData = useCallback((id: string, newData: any) => {
        setNodes((nds) => {
            if (!Array.isArray(nds)) return [];
            return nds.map((node) => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, ...newData } };
                }
                return node;
            });
        });
        // Sync editingNode state for real-time Sheet updates
        setEditingNode((prev) => {
            if (prev && prev.id === id) {
                return { ...prev, data: { ...prev.data, ...newData } };
            }
            return prev;
        });
    }, [setNodes]);
    if (isLoadingFlow) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[#fafafa]">
                <div className="flex flex-col items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl border border-gray-100 dark:border-zinc-800/80 shadow-sm">
                        <Loader2 className="h-7 w-7 text-indigo-500 animate-spin" />
                    </div>
                    <p className="text-gray-400 dark:text-zinc-400 font-medium tracking-wide text-xs">Carregando fluxo...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative group">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectEnd={onConnectEnd}
                onPaneClick={onPaneClick}
                onInit={setRfInstance}
                onNodesDelete={onNodesDelete}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: 'master-flow' }}
                fitView
                deleteKeyCode={['Backspace', 'Delete']}
                className="!bg-[#fafafa]"
            >
                <Controls position="bottom-left" className="!bg-white !border !border-gray-100 dark:border-zinc-800/80 !text-gray-500 dark:text-zinc-400 !shadow-sm !m-6 !rounded-xl overflow-hidden [&>button]:!bg-transparent [&>button]:!border-gray-100 dark:border-zinc-800/80 [&>button]:!text-gray-400 dark:text-zinc-400 [&>button:hover]:!bg-gray-50 dark:bg-zinc-900/50 [&>button:hover]:!text-gray-600 dark:text-zinc-300" />
                <MiniMap position="bottom-right" className="!bg-white !border !border-gray-100 dark:border-zinc-800/80 !shadow-sm !rounded-xl overflow-hidden !mb-8 !mr-8" maskColor="rgba(250,250,250,0.7)" nodeColor="#6366f1" />
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb40" />

                {/* N8N-style modal overlay with 3 columns */}
                {editingNode && (
                    <>
                        {/* Backdrop with blur */}
                        <div
                            className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-md transition-all duration-300"
                            onClick={() => setEditingNode(null)}
                            style={{ pointerEvents: 'auto' }}
                        />

                        {/* Modal dialog */}
                        <div
                            className="fixed inset-4 z-50 flex flex-col bg-white/95 rounded-[2rem] shadow-[0_32px_80px_-12px_rgba(0,0,0,0.3)] border border-white/40 backdrop-blur-3xl overflow-hidden ring-1 ring-zinc-950/5 animate-in zoom-in-95 duration-300"
                            style={{ pointerEvents: 'auto', maxWidth: '95vw', maxHeight: '95vh', margin: 'auto', top: '2.5vh', left: '2.5vw', right: '2.5vw', bottom: '2.5vh' }}
                        >
                            {/* Top header bar */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-white/60 shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-gradient-to-br from-zinc-800 to-zinc-950 rounded-xl shadow-lg shadow-zinc-900/20 ring-1 ring-white/10 inset-0">
                                        <Settings2 className="h-4 w-4 text-zinc-100" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                                            {(editingNode.data as any)?.label || editingNode.type || 'Node'}
                                        </h2>
                                        <p className="text-xs font-medium text-zinc-400">{editingNode.type}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-8 rounded-lg border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:bg-zinc-900/50"
                                        onClick={() => setEditingNode(null)}
                                    >
                                        ✕ Fechar
                                    </Button>
                                </div>
                            </div>

                            {/* 3-column layout */}
                            <div className="flex-1 flex min-h-0 overflow-hidden">
                                {/* LEFT: Input panel (resizable) */}
                                <div
                                    className="border-r border-gray-100 dark:border-zinc-800/80 overflow-y-auto custom-scrollbar bg-white shrink-0"
                                    style={{ width: '260px', minWidth: '180px', maxWidth: '400px', resize: 'horizontal', overflow: 'auto' }}
                                >
                                    <NodeInputPanel
                                        allTestOutputs={testOutputs}
                                        currentNodeId={editingNode.id}
                                        previousNodeIds={previousNodeIds}
                                    />
                                </div>

                                {/* CENTER: Parameters (flexible) */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#fafafa] min-w-0">
                                    <div className="px-6 py-3 border-b border-gray-100 dark:border-zinc-800/80 bg-white sticky top-0 z-10">
                                        <div className="flex gap-1">
                                            <button className="px-3 py-1.5 text-[11px] font-semibold text-indigo-600 border-b-2 border-indigo-500">Parâmetros</button>
                                            <button className="px-3 py-1.5 text-[11px] font-medium text-gray-400 dark:text-zinc-400 border-b-2 border-transparent hover:text-gray-600 dark:text-zinc-300">Configurações</button>
                                        </div>
                                    </div>
                                    <div className="p-6 space-y-5">
                                        <NodeConfigPanel
                                            node={editingNode}
                                            onUpdateData={updateNodeData}
                                            testOutput={editingNode ? getNodeOutput(editingNode.id) : undefined}
                                            isTestingNode={isTestingNode === editingNode?.id}
                                            onTestNode={() => editingNode && handleTestNode(editingNode.id)}
                                            allTestOutputs={testOutputs}
                                            isListening={isListening === editingNode?.id}
                                            onListen={() => editingNode && handleListenWebhook(editingNode.id)}
                                            onCancelListen={cancelListen}
                                        />
                                    </div>
                                </div>

                                {/* RIGHT: Output panel (resizable) */}
                                <div
                                    className="border-l border-gray-100 dark:border-zinc-800/80 overflow-y-auto custom-scrollbar bg-white shrink-0"
                                    style={{ width: '300px', minWidth: '200px', maxWidth: '500px', resize: 'horizontal', overflow: 'auto', direction: 'rtl' }}
                                >
                                    <div style={{ direction: 'ltr' }}>
                                        <NodeOutputPanel
                                            nodeId={editingNode.id}
                                            nodeType={editingNode.type || ''}
                                            nodeData={editingNode.data}
                                            output={editingNode ? getNodeOutput(editingNode.id) : undefined}
                                            isLoading={isTestingNode === editingNode?.id}
                                            onTest={() => editingNode && handleTestNode(editingNode.id)}
                                            isListening={isListening === editingNode?.id}
                                            onListen={() => editingNode && handleListenWebhook(editingNode.id)}
                                            onCancelListen={cancelListen}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <Panel position="top-left" className="p-4">
                    <div className="bg-white p-1.5 px-3 rounded-xl border border-gray-100 dark:border-zinc-800/80 flex gap-3 shadow-sm items-center">
                        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-2 rounded-lg">
                            <Zap className="h-3.5 w-3.5 text-white" />
                        </div>
                        <Input
                            value={flowName}
                            onChange={(e) => setFlowName(e.target.value)}
                            className="bg-transparent border-0 font-semibold text-gray-900 dark:text-zinc-100 focus-visible:ring-0 w-[220px] px-0 text-[13px] placeholder:text-gray-300"
                            placeholder="Nome da Automação"
                        />
                    </div>
                </Panel>

                <Panel position="top-right" className="p-4">
                    <div className="bg-white p-1 rounded-xl border border-gray-100 dark:border-zinc-800/80 flex gap-1.5 shadow-sm items-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="secondary" size="sm" className="bg-gray-50 dark:bg-zinc-900/50 hover:bg-gray-100 dark:bg-zinc-800/80 text-gray-700 dark:text-zinc-200 border-0 text-xs h-8 gap-1.5 px-3 rounded-lg transition-all active:scale-95 font-medium">
                                    <Plus className="h-3.5 w-3.5 text-indigo-500" />
                                    Adicionar
                                    <ChevronDown className="h-3 w-3 opacity-30" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[340px] bg-white/95 backdrop-blur-xl border border-gray-200/60 rounded-2xl shadow-2xl p-3 max-h-[80vh] overflow-y-auto custom-scrollbar grid grid-cols-2 gap-2">
                                {/* === MENSAGENS === */}
                                <DropdownMenuSeparator className="bg-gray-100 dark:bg-zinc-800/80 my-1 col-span-2" />
                                <DropdownMenuLabel className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-400 col-span-2">Mensagens</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => addNode('send_message', { message: '' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <MessageSquare className="mr-2.5 h-4 w-4 text-green-500" /> WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('send_template', { template_name: '' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <MessageSquareShare className="mr-2.5 h-4 w-4 text-green-600" /> Template WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('send_image', { url: '' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <ImageIcon className="mr-2.5 h-4 w-4 text-blue-500" /> Imagem
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('send_audio', { url: '' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <Mic className="mr-2.5 h-4 w-4 text-pink-500" /> Áudio
                                </DropdownMenuItem>

                                {/* === LÓGICA E CONTROLE === */}
                                <DropdownMenuSeparator className="bg-gray-100 dark:bg-zinc-800/80 my-1 col-span-2" />
                                <DropdownMenuLabel className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-400 col-span-2">Lógica e Controle</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => addNode('condition', { conditions: [] })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <GitBranch className="mr-2.5 h-4 w-4 text-indigo-500" /> Condição (Se)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('delay', { amount: 1, unit: 'minutes' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <Clock className="mr-2.5 h-4 w-4 text-amber-500" /> Atraso (Delay)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('wait_response', { maxWaitTime: 10 })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <Clock className="mr-2.5 h-4 w-4 text-teal-500" /> Esperar Resposta
                                </DropdownMenuItem>

                                {/* === CRM E SUPORTE === */}
                                <DropdownMenuSeparator className="bg-gray-100 dark:bg-zinc-800/80 my-1 col-span-2" />
                                <DropdownMenuLabel className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-400 col-span-2">CRM & Suporte</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => addNode('lookup_lead', { identifier_type: 'phone' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <UserSearch className="mr-2.5 h-4 w-4 text-indigo-400" /> Buscar Lead
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('assign_user', { assign_type: 'user' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <UserPlus className="mr-2.5 h-4 w-4 text-fuchsia-500" /> Atribuir Lead
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('add_note', { note: '' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <StickyNote className="mr-2.5 h-4 w-4 text-amber-500" /> Adicionar Nota
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('crm_move', { boardId: '', pipelineId: '' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <Columns3 className="mr-2.5 h-4 w-4 text-orange-500" /> Mover Kanban
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('add_tag', { tagId: '' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <Hash className="mr-2.5 h-4 w-4 text-rose-500" /> Adicionar Tag
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('bot_toggle', { action: 'stop' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <UserPlus className="mr-2.5 h-4 w-4 text-cyan-500" /> Parar Robô
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('capture_info', { fieldInfo: '' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <Database className="mr-2.5 h-4 w-4 text-blue-400" /> Capturar Dado
                                </DropdownMenuItem>

                                {/* === OUTROS (AI/AVANÇADO) === */}
                                <DropdownMenuSeparator className="bg-gray-100 dark:bg-zinc-800/80 my-1 col-span-2" />
                                <DropdownMenuLabel className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-400 col-span-2">Inteligência I.A</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => addNode('ai_agent', { provider: 'gemini', model: 'gemini-2.5-flash' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <Brain className="mr-2.5 h-4 w-4 text-violet-500" /> Agente I.A
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('intent_router', { intents: [] })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <Signpost className="mr-2.5 h-4 w-4 text-purple-500" /> Classificador
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('follow_up_ai', {})} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <MessageSquareHeart className="mr-2.5 h-4 w-4 text-orange-500" /> Follow Up
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('send_ai_response', {})} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <Send className="mr-2.5 h-4 w-4 text-emerald-500" /> Resposta I.A
                                </DropdownMenuItem>

                                <DropdownMenuSeparator className="bg-gray-100 dark:bg-zinc-800/80 my-1" />
                                <DropdownMenuLabel className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-400">Avançado</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => addNode('http_request', { method: 'GET', url: '' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <Globe className="mr-2.5 h-4 w-4 text-sky-500" /> HTTP Request
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('code', { language: 'javascript', code: '' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <Code2 className="mr-2.5 h-4 w-4 text-gray-500 dark:text-zinc-400" /> Código
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addNode('edit_fields', { fields: [], mode: 'pairs' })} className="rounded-lg focus:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 text-[13px]">
                                    <PenLine className="mr-2.5 h-4 w-4 text-teal-500" /> Edit Fields
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="w-[1px] h-5 bg-gray-100 dark:bg-zinc-800/80 mx-0.5" />

                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleAutoLayout}
                            className="bg-gray-50 dark:bg-zinc-900/50 hover:bg-gray-100 dark:bg-zinc-800/80 text-gray-500 dark:text-zinc-400 border-0 text-xs h-8 px-2.5 rounded-lg transition-all active:scale-95 font-medium"
                            title="Organizar layout"
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setHistoryOpen(true)}
                            className="bg-gray-50 dark:bg-zinc-900/50 hover:bg-gray-100 dark:bg-zinc-800/80 text-gray-500 dark:text-zinc-400 border-0 text-xs h-8 px-2.5 rounded-lg transition-all active:scale-95 font-medium"
                            title="Histórico"
                        >
                            <History className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setAiPromptOpen(true)}
                            className="bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-700 border-0 text-xs h-8 gap-1.5 px-3 rounded-lg transition-all active:scale-95 font-medium"
                            title="Gerar workflow com IA"
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">IA</span>
                        </Button>

                        <div className="w-[1px] h-5 bg-gray-100 dark:bg-zinc-800/80 mx-0.5" />

                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleTestFlow}
                            disabled={isTestingFlow}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-0 text-xs h-8 gap-1.5 px-3 rounded-lg transition-all active:scale-95 font-medium"
                            title="Testar fluxo"
                        >
                            {isTestingFlow || webhookListenState === 'listening' ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : webhookListenState === 'received' ? (
                                <Radio className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                                <Play className="h-3.5 w-3.5" />
                            )}
                            {webhookListenState === 'listening' ? 'Escutando...' : isTestingFlow ? `${flowTestProgress}%` : 'Testar'}
                        </Button>

                        {/* Webhook Listen Banner */}
                        {webhookListenState === 'listening' && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 py-3 rounded-xl shadow-xl z-[999] whitespace-nowrap animate-in fade-in-0 slide-in-from-top-2 duration-300 flex items-center gap-3 min-w-[380px]">
                                <div className="relative">
                                    <Radio className="h-5 w-5 animate-pulse" />
                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-yellow-300 rounded-full animate-ping" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-bold">Aguardando webhook...</div>
                                    <div className="text-[10px] opacity-80 mt-0.5">Envie um POST para a URL configurada no trigger</div>
                                </div>
                                <button
                                    onClick={() => { cancelListen(); setWebhookListenState('idle'); }}
                                    className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                                    title="Cancelar escuta"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        <div className="w-[1px] h-5 bg-gray-100 dark:bg-zinc-800/80 mx-0.5" />

                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold h-8 px-5 rounded-lg shadow-sm border-0 transition-all active:scale-95 text-[13px]"
                        >
                            {isSaving ? 'Salvando...' : 'Publicar'}
                        </Button>
                    </div>
                </Panel>
            </ReactFlow>

            <ExecutionHistoryPanel
                flowId={flowId}
                companyId={session?.empresaId || ''}
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
            />

            {/* Flow Test Results Panel */}
            {showFlowTestResults && Object.keys(testOutputs).length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 dark:border-zinc-800/80 shadow-xl z-50 max-h-[250px] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200">
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50/50 border-b border-gray-50">
                        <div className="flex items-center gap-2">
                            <Play className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-xs font-semibold text-gray-600 dark:text-zinc-300">Resultado do Teste</span>
                            <span className="text-[10px] text-gray-400 dark:text-zinc-400">{Object.keys(testOutputs).length} nós</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={clearOutputs} className="text-[10px] text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300 transition-colors">Limpar</button>
                            <button onClick={() => setShowFlowTestResults(false)} className="text-xs text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300 transition-colors">✕</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-x-auto overflow-y-auto">
                        <div className="flex gap-0 min-w-max">
                            {Object.values(testOutputs).map((out, i) => (
                                <div key={out.nodeId} className="w-[220px] shrink-0 border-r border-gray-50 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-2 h-2 rounded-full ${out.status === 'ok' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                        <span className="text-[11px] font-semibold text-gray-700 dark:text-zinc-200 truncate">{out.nodeLabel}</span>
                                        <span className="text-[9px] text-gray-300 ml-auto">{out.executionTime}ms</span>
                                    </div>
                                    <pre className="text-[10px] font-mono text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded-lg overflow-auto max-h-[120px] whitespace-pre-wrap break-all">
                                        {JSON.stringify(out.output, null, 1)}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {/* AI Workflow Generator Dialog */}
            {aiPromptOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => !isGeneratingAI && setAiPromptOpen(false)}
                    />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-lg animate-in fade-in-0 zoom-in-95 duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800/80 overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gradient-to-r from-amber-50/70 to-orange-50/70">
                                <div className="flex items-center gap-3">
                                    <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-2 rounded-xl shadow-sm">
                                        <Sparkles className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">Gerar Workflow com IA</h3>
                                        <p className="text-[11px] text-gray-400 dark:text-zinc-400">Descreva o que deseja e a IA cria o fluxo completo</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => !isGeneratingAI && setAiPromptOpen(false)}
                                    className="text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:bg-zinc-800/80"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6">
                                <Textarea
                                    value={aiPromptText}
                                    onChange={(e) => setAiPromptText(e.target.value)}
                                    placeholder={'Ex: "Quando o cliente enviar \'oi\', cumprimentar, perguntar o nome, aguardar resposta, e enviar mensagem personalizada com o nome"\n\nOu: "Workflow de qualificação de leads: perguntar interesse, filtrar por cidade, e mover para o Kanban de vendas"'}
                                    className="min-h-[140px] resize-none border-gray-200 dark:border-zinc-800 rounded-xl text-sm placeholder:text-gray-300 focus-visible:ring-amber-400/30 focus-visible:border-amber-400"
                                    disabled={isGeneratingAI}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                            e.preventDefault();
                                            handleGenerateWithAI();
                                        }
                                    }}
                                />
                                <div className="flex items-center justify-between mt-4">
                                    <p className="text-[10px] text-gray-300">
                                        Ctrl+Enter para gerar
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setAiPromptOpen(false)}
                                            disabled={isGeneratingAI}
                                            className="text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300 text-xs h-8 rounded-lg"
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleGenerateWithAI}
                                            disabled={!aiPromptText.trim() || isGeneratingAI}
                                            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold h-8 px-5 rounded-lg shadow-sm border-0 transition-all active:scale-95 text-[13px] gap-2"
                                        >
                                            {isGeneratingAI ? (
                                                <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    Gerando...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="h-3.5 w-3.5" />
                                                    Gerar Workflow
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Custom Dropdown for OnConnectEnd Node Creation */}
            {menuPosition && (
                <>
                    {/* Backdrop to close menu */}
                    <div className="fixed inset-0 z-40" onClick={() => setMenuPosition(null)} />
                    {/* Hover Menu Dialog */}
                    <div
                        className="fixed z-50 w-[340px] bg-white/95 backdrop-blur-xl border border-gray-200/60 rounded-2xl shadow-2xl p-3 max-h-[80vh] overflow-y-auto custom-scrollbar xl:-translate-y-1/2 animate-in zoom-in-95 duration-200"
                        style={{ left: menuPosition.x, top: menuPosition.y }}
                    >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-zinc-800/80">
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400 tracking-wider uppercase">Adicionar Nó</span>
                            <button onClick={() => setMenuPosition(null)} className="text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 hover:bg-gray-100 dark:bg-zinc-800/80 p-1 rounded-sm transition-colors"><XIcon className="h-3.5 w-3.5" /></button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                                <span className="px-1 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-400">Mensagens</span>
                            </div>
                            <button onClick={() => addNode('send_message', { message: '' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <MessageSquare className="mr-2.5 h-4 w-4 text-green-500 flex-shrink-0" /> WhatsApp
                            </button>
                            <button onClick={() => addNode('send_template', { template_name: '' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <MessageSquareShare className="mr-2.5 h-4 w-4 text-green-600 flex-shrink-0" /> Template WhatsApp
                            </button>
                            <button onClick={() => addNode('send_image', { url: '' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <ImageIcon className="mr-2.5 h-4 w-4 text-blue-500 flex-shrink-0" /> Imagem
                            </button>
                            <button onClick={() => addNode('send_audio', { url: '' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <Mic className="mr-2.5 h-4 w-4 text-pink-500 flex-shrink-0" /> Áudio
                            </button>

                            <div className="col-span-2 mt-1 border-t border-gray-100 dark:border-zinc-800/80 pt-2">
                                <span className="px-1 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-400">Lógica e Controle</span>
                            </div>
                            <button onClick={() => addNode('condition', { conditions: [] })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <GitBranch className="mr-2.5 h-4 w-4 text-indigo-500 flex-shrink-0" /> Condição (Se)
                            </button>
                            <button onClick={() => addNode('delay', { amount: 1, unit: 'minutes' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <Clock className="mr-2.5 h-4 w-4 text-amber-500 flex-shrink-0" /> Atraso (Delay)
                            </button>
                            <button onClick={() => addNode('wait_response', { maxWaitTime: 10 })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <Clock className="mr-2.5 h-4 w-4 text-teal-500 flex-shrink-0" /> Esperar Resposta
                            </button>

                            <div className="col-span-2 mt-1 border-t border-gray-100 dark:border-zinc-800/80 pt-2">
                                <span className="px-1 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-400">CRM & Suporte</span>
                            </div>
                            <button onClick={() => addNode('lookup_lead', { identifier_type: 'phone' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <UserSearch className="mr-2.5 h-4 w-4 text-indigo-400 flex-shrink-0" /> Buscar Lead
                            </button>
                            <button onClick={() => addNode('assign_user', { assign_type: 'user' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <UserPlus className="mr-2.5 h-4 w-4 text-fuchsia-500 flex-shrink-0" /> Atribuir Lead
                            </button>
                            <button onClick={() => addNode('add_note', { note: '' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <StickyNote className="mr-2.5 h-4 w-4 text-amber-500 flex-shrink-0" /> Adicionar Nota
                            </button>
                            <button onClick={() => addNode('crm_move', { boardId: '', pipelineId: '' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <Columns3 className="mr-2.5 h-4 w-4 text-orange-500 flex-shrink-0" /> Mover Kanban
                            </button>
                            <button onClick={() => addNode('add_tag', { tagId: '' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <Hash className="mr-2.5 h-4 w-4 text-rose-500 flex-shrink-0" /> Adicionar Tag
                            </button>
                            <button onClick={() => addNode('bot_toggle', { action: 'stop' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <UserPlus className="mr-2.5 h-4 w-4 text-cyan-500 flex-shrink-0" /> Parar Robô
                            </button>
                            <button onClick={() => addNode('capture_info', { fieldInfo: '' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <Database className="mr-2.5 h-4 w-4 text-blue-400 flex-shrink-0" /> Capturar Dado
                            </button>

                            <div className="col-span-2 mt-1 border-t border-gray-100 dark:border-zinc-800/80 pt-2">
                                <span className="px-1 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-400">Inteligência I.A</span>
                            </div>
                            <button onClick={() => addNode('ai_agent', { provider: 'gemini', model: 'gemini-2.5-flash' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <Brain className="mr-2.5 h-4 w-4 text-violet-500 flex-shrink-0" /> Agente I.A
                            </button>
                            <button onClick={() => addNode('intent_router', { intents: [] })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <Signpost className="mr-2.5 h-4 w-4 text-purple-500 flex-shrink-0" /> Classificador
                            </button>
                            <button onClick={() => addNode('follow_up_ai', {})} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <MessageSquareHeart className="mr-2.5 h-4 w-4 text-orange-500 flex-shrink-0" /> Follow Up
                            </button>
                            <button onClick={() => addNode('send_ai_response', {})} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <Send className="mr-2.5 h-4 w-4 text-emerald-500 flex-shrink-0" /> Resposta I.A
                            </button>

                            <div className="col-span-2 mt-1 border-t border-gray-100 dark:border-zinc-800/80 pt-2">
                                <span className="px-1 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-400">Avançado</span>
                            </div>
                            <button onClick={() => addNode('http_request', { method: 'GET', url: '' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <Globe className="mr-2.5 h-4 w-4 text-sky-500 flex-shrink-0" /> HTTP Request
                            </button>
                            <button onClick={() => addNode('code', { language: 'javascript', code: '' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <Code2 className="mr-2.5 h-4 w-4 text-gray-500 dark:text-zinc-400 flex-shrink-0" /> Código
                            </button>
                            <button onClick={() => addNode('edit_fields', { fields: [], mode: 'pairs' })} className="flex items-center rounded-lg hover:bg-gray-50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300 cursor-pointer py-2 px-2 text-[13px] text-left transition-colors">
                                <PenLine className="mr-2.5 h-4 w-4 text-teal-500 flex-shrink-0" /> Edit Fields
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
