'use client';

import React, { useCallback, useState, useRef } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    BackgroundVariant,
    useNodesState,
    useEdgesState,
    addEdge,
    type Connection,
    type Edge,
    type Node,
    type NodeTypes,
    type EdgeTypes,
    useReactFlow,
    ReactFlowProvider,
    MarkerType,
    type OnConnectStart,
    type OnConnectEnd,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';


import { useSession } from '@/contexts/session-context';
import { saveFlow, getFlow } from '@/lib/automations';
import { getAutoLayoutNodes } from '@/lib/auto-layout';
import { useNodeTestOutputs } from '@/hooks/useNodeTestOutputs';
import { toast } from 'sonner';

// ── Nodes V4 ─────────────────────────────────────────────────────────────────
import { TriggerNodeV4 } from './nodes/TriggerNodeV4';
import { SendMessageNodeV4 } from './nodes/SendMessageNodeV4';
import { SendImageNodeV4, SendAudioNodeV4, SendDocumentNodeV4, SendVideoNodeV4 } from './nodes/SendMediaNodeV4';
import { SendTemplateNodeV4 } from './nodes/SendTemplateNodeV4';
import { ConditionNodeV4 } from './nodes/ConditionNodeV4';
import { DelayNodeV4 } from './nodes/DelayNodeV4';
import { WaitResponseNodeV4 } from './nodes/WaitResponseNodeV4';
import { RouterNodeV4 } from './nodes/RouterNodeV4';
import { FilterNodeV4 } from './nodes/FilterNodeV4';
import { AiAgentNodeV4 } from './nodes/AiAgentNodeV4';
import { IntentRouterNodeV4 } from './nodes/IntentRouterNodeV4';
import {
    FollowUpAiNodeV4, SendAiResponseNodeV4, CrmMoveNodeV4,
    AddTagNodeV4, BotToggleNodeV4, LookupLeadNodeV4,
    AssignUserNodeV4, AddNoteNodeV4, HttpRequestNodeV4,
    CodeNodeV4, EditFieldsNodeV4,
} from './nodes/RemainingNodesV4';

// Legado para compatibilidade com fluxos salvos
import { MessageNode, SendMessageNode } from '../nodes/message-node';
import { MediaNode } from '../nodes/media-node';
import { LogicNode } from '../nodes/logic-node';
import { InteractionNode } from '../nodes/interaction-node';
import { AINode } from '../nodes/ai-node';
import { ActionNode } from '../nodes/action-node';
import { CRMNode } from '../nodes/crm-node';
import { MarketingNode } from '../nodes/marketing-node';
import { SystemNode } from '../nodes/system-node';
import { UtilityNode } from '../nodes/utility-node';
import { AskQuestionNode } from '../nodes/ask-question-node';
import { CaptureInfoNode } from '../nodes/capture-info-node';
import { StopBotNode } from '../nodes/stop-bot-node';
import { LoopRestartNode } from '../nodes/loop-restart-node';

// ── Layout & Painéis ─────────────────────────────────────────────────────────
import { FlowToolbar } from './FlowToolbar';
import { NodeLibraryPanel } from './NodeLibraryPanel';
import { NodeConfigDrawer } from './NodeConfigDrawer';
import { ConnectionDropMenu } from './ConnectionDropMenu';
import FlowEdge from './edges/FlowEdge';
import { ExecutionHistoryPanel } from '../ExecutionHistoryPanel';

// ── Types ─────────────────────────────────────────────────────────────────────
const NODE_TYPES: NodeTypes = {
    // V4 (novos)
    trigger:          TriggerNodeV4,
    send_message:     SendMessageNodeV4,
    send_image:       SendImageNodeV4,
    send_audio:       SendAudioNodeV4,
    send_document:    SendDocumentNodeV4,
    send_video:       SendVideoNodeV4,
    send_template:    SendTemplateNodeV4,
    condition:        ConditionNodeV4,
    delay:            DelayNodeV4,
    wait_response:    WaitResponseNodeV4,
    router:           RouterNodeV4,
    filter:           FilterNodeV4,
    ai_agent:         AiAgentNodeV4,
    intent_router:    IntentRouterNodeV4,
    follow_up_ai:     FollowUpAiNodeV4,
    send_ai_response: SendAiResponseNodeV4,
    crm_move:         CrmMoveNodeV4,
    add_tag:          AddTagNodeV4,
    bot_toggle:       BotToggleNodeV4,
    lookup_lead:      LookupLeadNodeV4,
    assign_user:      AssignUserNodeV4,
    add_note:         AddNoteNodeV4,
    http_request:     HttpRequestNodeV4,
    code:             CodeNodeV4,
    edit_fields:      EditFieldsNodeV4,
    // Legado (backward compat)
    message:          MessageNode,
    media:            MediaNode,
    logic:            LogicNode,
    interaction:      InteractionNode,
    ai:               AINode,
    action:           ActionNode,
    crm:              CRMNode,
    marketing:        MarketingNode,
    system:           SystemNode,
    utility:          UtilityNode,
    ask_question:     AskQuestionNode,
    capture_info:     CaptureInfoNode,
    stop_bot:         StopBotNode,
    loop_restart:     LoopRestartNode,
};

const EDGE_TYPES: EdgeTypes = {
    'flow-edge': FlowEdge,
};

const INITIAL_NODES: Node[] = [
    {
        id: '1',
        type: 'trigger',
        position: { x: 240, y: 80 },
        data: { label: 'Gatilho: Nova Mensagem', triggerType: 'message_received' },
    },
];

// ── Sub-componente interno (precisa do ReactFlow context) ─────────────────────
function FlowEditorInner({ flowId, onSave: onSaveProp, onClose: onCloseProp }: { flowId: string; onSave?: (id: string, name: string) => void; onClose?: () => void }) {
    const { session } = useSession();

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(INITIAL_NODES);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [flowName, setFlowName] = useState('Nova Automação MasterFlow');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingFlow, setIsLoadingFlow] = useState(flowId !== 'new');
    const [editingNode, setEditingNode] = useState<Node | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [aiPromptOpen, setAiPromptOpen] = useState(false);
    const [webhookListenState, setWebhookListenState] = useState<'idle' | 'listening' | 'received'>('idle');

    // ── Connection Drop State (arrastar handle → espaço vazio → popup) ────────
    const pendingConnectionRef = useRef<{ nodeId: string; handleId: string | null; handleType: string | null } | null>(null);
    const [connectionDrop, setConnectionDrop] = useState<{ screenX: number; screenY: number } | null>(null);
    const reactFlowInstance = useReactFlow();
    const screenToFlowPosition = reactFlowInstance.screenToFlowPosition;

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

    // ── Callbacks: nodes ──────────────────────────────────────────────────────
    const enrichNodeWithCallbacks = useCallback((node: Node): Node => {
        return {
            ...node,
            data: {
                ...node.data,
                onDelete: () => {
                    setNodes(ns => ns.filter(n => n.id !== node.id));
                    setEdges(es => es.filter(e => e.source !== node.id && e.target !== node.id));
                    setEditingNode(prev => prev?.id === node.id ? null : prev);
                },
                onDuplicate: () => {
                    const newNode: Node = {
                        ...node,
                        id: `${node.type}_${Date.now()}`,
                        position: { x: node.position.x + 40, y: node.position.y + 40 },
                        data: { ...node.data },
                        selected: false,
                    };
                    const enriched = enrichNodeWithCallbacks(newNode);
                    setNodes(ns => [...ns.map(n => ({ ...n, selected: false })), enriched]);
                },
                onLabelChange: (label: string) => {
                    setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, label } } : n));
                    setEditingNode(prev => prev?.id === node.id ? { ...prev, data: { ...prev.data, label } } : prev);
                },
            },
        };
    }, [setNodes, setEdges]);

    // ── Carregar fluxo ────────────────────────────────────────────────────────
    React.useEffect(() => {
        if (flowId === 'new' || !session?.empresaId) { setIsLoadingFlow(false); return; }
        async function load() {
            try {
                const flow = await getFlow(flowId, session!.empresaId as string);
                if (flow) {
                    setFlowName(flow.name);
                    if (flow.visualData) {
                        const visual = flow.visualData as any;
                        if (Array.isArray(visual.nodes)) setNodes(visual.nodes.map((n: Node) => enrichNodeWithCallbacks(n)));
                        if (Array.isArray(visual.edges)) setEdges(visual.edges);
                    }
                }
            } catch (e) {
                console.error('[FlowEditorV4] load error', e);
            } finally {
                setIsLoadingFlow(false);
            }
        }
        load();
    }, [flowId, session?.empresaId, enrichNodeWithCallbacks]);

    // ── Adicionar node (com posição e conexão opcionais) ──────────────────────
    const handleAddNode = useCallback((type: string, defaultData: Record<string, any>, flowPos?: { x: number; y: number }, sourceConnection?: { nodeId: string; handleId: string | null }) => {
        const id = `${type}_${Date.now()}`;
        const position = flowPos ?? { x: 200 + Math.random() * 100, y: 150 + Math.random() * 100 };
        const newNode: Node = {
            id,
            type,
            position,
            data: { ...defaultData, label: '' },
        };
        const enriched = enrichNodeWithCallbacks(newNode);
        setNodes(ns => [...ns, enriched]);

        // Se veio de um drop de conexão, criar a edge automaticamente
        if (sourceConnection) {
            const edge: Edge = {
                id: `e_${sourceConnection.nodeId}_${sourceConnection.handleId || ''}_${id}`,
                source: sourceConnection.nodeId,
                sourceHandle: sourceConnection.handleId || undefined,
                target: id,
                type: 'flow-edge',
                markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8, color: '#cbd5e1' },
                animated: false,
            };
            setEdges(es => [...es, edge]);
        }
    }, [enrichNodeWithCallbacks, setNodes, setEdges]);

    // ── Re-enriquecer nodes ao carregar ───────────────────────────────────────
    React.useEffect(() => {
        setNodes(ns => ns.map(n => enrichNodeWithCallbacks(n)));
    }, []);

    // ── Handlers: arrastar conexão ──────────────────────────────────────────
    const onConnectStart: OnConnectStart = useCallback((_evt, params) => {
        pendingConnectionRef.current = {
            nodeId: params.nodeId || '',
            handleId: params.handleId || null,
            handleType: params.handleType || null,
        };
    }, []);

    const onConnectEnd: OnConnectEnd = useCallback((evt) => {
        const target = (evt as MouseEvent).target as HTMLElement;
        // Se soltou em um handle válido, o ReactFlow já cria a conexão — ignorar
        const isOnHandle = target?.classList?.contains('react-flow__handle') ||
            target?.closest?.('.react-flow__handle');
        if (isOnHandle) {
            pendingConnectionRef.current = null;
            return;
        }
        // Soltou em espaço vazio — abrir popup
        if (pendingConnectionRef.current) {
            const mouseEvt = evt as MouseEvent;
            setConnectionDrop({ screenX: mouseEvt.clientX, screenY: mouseEvt.clientY });
        }
    }, []);

    // ── Quando seleciona um nó no popup ────────────────────────────────────
    const handleConnectionDropSelect = useCallback((type: string, defaultData: Record<string, any>) => {
        const pending = pendingConnectionRef.current;
        const drop = connectionDrop;
        setConnectionDrop(null);
        pendingConnectionRef.current = null;
        if (!drop) return;
        // Converter coordenadas de tela para posição do canvas
        const flowPos = screenToFlowPosition({ x: drop.screenX, y: drop.screenY });
        handleAddNode(type, defaultData, flowPos, pending ? { nodeId: pending.nodeId, handleId: pending.handleId } : undefined);
    }, [connectionDrop, screenToFlowPosition, handleAddNode]);

    // ── Conexão entre nodes ───────────────────────────────────────────────────
    const onConnect = useCallback((params: Connection) => {
        const edge: Edge = {
            ...params,
            id: `e_${params.source}_${params.sourceHandle || ''}_${params.target}`,
            type: 'flow-edge',
            markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8, color: '#cbd5e1' },
            animated: false,
        };
        setEdges(es => addEdge(edge, es));
    }, [setEdges]);

    // ── Atualizar dados de um node ────────────────────────────────────────────
    const handleUpdateNodeData = useCallback((nodeId: string, data: Record<string, any>) => {
        setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
        setEditingNode(prev => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev);
    }, [setNodes]);

    // ── Clicar em node → abrir drawer ────────────────────────────────────────
    const onNodeClick = useCallback((_evt: React.MouseEvent, node: Node) => {
        setEditingNode(node);
    }, []);

    // ── Salvar ────────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!session?.empresaId) return;
        setIsSaving(true);
        try {
            const cleanNodes = JSON.parse(JSON.stringify(nodes.map(n => ({
                id: n.id, type: n.type, position: n.position,
                data: Object.fromEntries(
                    Object.entries(n.data as object).filter(([k]) =>
                        !['onDelete', 'onDuplicate', 'onLabelChange'].includes(k)
                    )
                ),
            }))));
            const cleanEdges = JSON.parse(JSON.stringify(edges));
            const visualData = { nodes: cleanNodes, edges: cleanEdges };
            const result = await saveFlow(flowId, flowName, session.empresaId as string, visualData, []);
            toast.success('Fluxo publicado com sucesso!');
            onSaveProp?.((result?.id || result?.flow?.id || flowId) as string, flowName);
        } catch (e: any) {
            console.error('[FlowEditorV4] save error', e);
            toast.error('Erro ao salvar', { description: e.message });
        } finally {
            setIsSaving(false);
        }
    }, [nodes, edges, flowId, flowName, session?.empresaId, onSaveProp]);

    // ── Auto-layout ───────────────────────────────────────────────────────────
    const handleAutoLayout = useCallback(async () => {
        const layouted = await getAutoLayoutNodes(nodes, edges, 'TB');
        setNodes(layouted);
        toast.success('Layout organizado!');
    }, [nodes, edges, setNodes]);

    // ── Testar fluxo ─────────────────────────────────────────────────────────
    const handleTest = useCallback(async () => {
        if (!session?.empresaId) return;
        const triggerNode = nodes.find(n => n.type === 'trigger');
        const isWebhook = (triggerNode?.data as any)?.trigger_type === 'webhook_external';
        let initialVars: Record<string, any> = {};

        if (isWebhook && triggerNode) {
            setWebhookListenState('listening');
            const result = await listenForWebhook(triggerNode.id, flowId, triggerNode.data);
            if (result?.status === 'ok') {
                setWebhookListenState('received');
                const body = result.output?.body || result.output || {};
                initialVars = { webhook_body: body, ...body };
            } else {
                setWebhookListenState('idle');
                return;
            }
        }

        await (testFlow as any)(nodes, edges, session.empresaId, initialVars);
        if (webhookListenState === 'received') setTimeout(() => setWebhookListenState('idle'), 3000);
    }, [nodes, edges, session?.empresaId, testFlow, listenForWebhook, flowId, webhookListenState]);

    // ── Navegar de volta ──────────────────────────────────────────────────────
    const handleBack = useCallback(() => {
        if (onCloseProp) {
            onCloseProp();
        } else {
            window.history.back();
        }
    }, [onCloseProp]);

    // ── Derivados ─────────────────────────────────────────────────────────────
    const editingNodeTestOutput = editingNode ? getNodeOutput(editingNode.id) : undefined;

    if (isLoadingFlow) {
        return (
            <div className="flex-1 flex items-center justify-center bg-zinc-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-zinc-500 font-medium">Carregando fluxo...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-zinc-50">
            {/* Toolbar */}
            <FlowToolbar
                flowName={flowName}
                onFlowNameChange={setFlowName}
                isSaving={isSaving}
                onSave={handleSave}
                onBack={handleBack}
                onAutoLayout={handleAutoLayout}
                onTest={handleTest}
                onAIGenerate={() => setAiPromptOpen(true)}
                onHistory={() => setHistoryOpen(true)}
                isTestingFlow={isTestingFlow}
                flowTestProgress={flowTestProgress}
                webhookListenState={webhookListenState}
            />

            {/* Layout principal */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Painel esquerdo: biblioteca de nodes */}
                <NodeLibraryPanel onAddNode={handleAddNode} />

                {/* Canvas */}
                <div className="flex-1 relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onConnectStart={onConnectStart}
                        onConnectEnd={onConnectEnd}
                        onNodeClick={onNodeClick}
                        nodeTypes={NODE_TYPES}
                        edgeTypes={EDGE_TYPES}
                        defaultEdgeOptions={{
                            type: 'flow-edge',
                            markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8, color: '#cbd5e1' },
                        }}
                        fitView
                        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
                        minZoom={0.2}
                        maxZoom={2}
                        proOptions={{ hideAttribution: true }}
                        className="bg-zinc-50"
                    >
                        <Background
                            variant={BackgroundVariant.Dots}
                            gap={24}
                            size={1.2}
                            color="#d4d4d8"
                        />
                        <MiniMap
                            nodeStrokeWidth={2}
                            nodeColor="#e4e4e7"
                            maskColor="rgba(244,244,245,0.7)"
                            className="!border !border-zinc-200 !rounded-xl !shadow-sm"
                        />
                        <Controls
                            showInteractive={false}
                            className="!border !border-zinc-200 !rounded-xl !shadow-sm !bg-white"
                        />
                    </ReactFlow>
                </div>

                {/* Drawer de configuração (direita) */}
                <NodeConfigDrawer
                    node={editingNode}
                    onClose={() => setEditingNode(null)}
                    onUpdateData={handleUpdateNodeData}
                    testOutput={editingNodeTestOutput}
                    isTestingNode={!!isTestingNode}
                    onTestNode={editingNode ? () => {
                        if (session?.empresaId && editingNode) {
                            testNode(editingNode.id, editingNode.type || '', editingNode.data as any, session.empresaId);
                        }
                    } : undefined}
                    allTestOutputs={testOutputs}
                    isListening={!!isListening}
                    onListen={editingNode ? () => listenForWebhook(editingNode.id, flowId, editingNode.data as any) : undefined}
                    onCancelListen={cancelListen}
                />
            </div>

            {/* Drawer de histórico de execuções */}
            {historyOpen && (
                <div className="fixed inset-0 z-40 flex">
                    <div className="flex-1 bg-black/20" onClick={() => setHistoryOpen(false)} />
                    <div className="w-80 h-full bg-white shadow-xl">
                        <ExecutionHistoryPanel
                            automationId={flowId === 'new' ? '' : flowId}
                            nodes={nodes}
                            onHighlightNodes={() => setHistoryOpen(false)}
                        />
                    </div>
                </div>
            )}
            {/* Popup: node picker ao soltar conexão em espaço vazio */}
            {connectionDrop && (
                <ConnectionDropMenu
                    screenX={connectionDrop.screenX}
                    screenY={connectionDrop.screenY}
                    onSelect={handleConnectionDropSelect}
                    onClose={() => {
                        setConnectionDrop(null);
                        pendingConnectionRef.current = null;
                    }}
                />
            )}
        </div>
    );
}

// ── Componente público (com Provider) ────────────────────────────────────────
interface FlowEditorV4Props {
    flowId: string;
    onSave?: (id: string, name: string) => void;
    onClose?: () => void;
}

export function FlowEditorV4({ flowId, onSave, onClose }: FlowEditorV4Props) {
    return (
        <ReactFlowProvider>
            <FlowEditorInner flowId={flowId} onSave={onSave} onClose={onClose} />
        </ReactFlowProvider>
    );
}
