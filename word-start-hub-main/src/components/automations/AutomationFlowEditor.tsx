import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import "./editor/flow-nodes.css";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileWithFallback } from "@/lib/r2Upload";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Plus, MessageSquare, GitBranch, Clock, HelpCircle, ArrowRightLeft, Zap, MessageCircle, X, Image, Mic, FileText, CalendarPlus, Bot, ShieldOff, DollarSign, UserPlus, Globe, Code2, PenLine, Filter, Signpost, Video, Brain, Send, Lock, History, RefreshCw, MessageSquareHeart, LayoutGrid, PhoneCall, Play, Search, Sparkles, Check, MessageSquareShare, Users2, BarChart3, MoveHorizontal, MoveVertical } from "lucide-react";
import Dagre from "@dagrejs/dagre";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { nodeTypes, edgeTypes, defaultEdgeOptions, NODE_LABELS, NODE_CATEGORIES, isValidUUID, getAutoLayout } from "./editor/registry";
import { useNodeExecution } from "./hooks/useNodeExecution";
import { FlowSimulatorUI } from "./FlowSimulatorUI";
import { NodeToolbar } from "./NodeToolbar";
import { AddNodeMenu } from "./editor/panels/AddNodeMenu";
import { FlowCorrectionsPanel } from "./editor/panels/FlowCorrectionsPanel";
import { ExecutionHistoryPanel } from "./ExecutionHistoryPanel";
import { UpgradeDialog } from "./editor/panels/UpgradeDialog";
import { FlowLayoutProvider, useFlowLayout } from "./editor/FlowLayoutContext";

function AutomationFlowEditorInner() {
  const { id: automationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { canUseAIAutomation } = useModuleAccess();
  const { direction, toggleDirection } = useFlowLayout();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [automationName, setAutomationName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nodeStats, setNodeStats] = useState<Record<string, { total_reached: number; total_responded: number; responses: any }>>({});

  const [pinnedOutputs, setPinnedOutputs] = useState<Set<string>>(new Set());


  const [flowCorrections, setFlowCorrections] = useState<FlowCorrection[]>([]);
  const { setCenter } = useReactFlow();

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
    if (!automationId || !currentOrganization?.id) return;
    const { data } = await (supabase as any)
      .from("automation_node_stats")
      .select("node_id, total_reached, total_responded, responses")
      .eq("automation_id", automationId)
      .eq("organization_id", currentOrganization.id);

    const statsMap: Record<string, any> = {};
    (data || []).forEach((s: any) => {
      statsMap[s.node_id] = { total_reached: s.total_reached, total_responded: s.total_responded, responses: s.responses };
    });
    setNodeStats(statsMap);
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

    const [automationRes, nodesRes, edgesRes] = await Promise.all([
      (supabase as any).from("automations").select("name, trigger_type, webhook_token, schedule_config").eq("id", automationId).maybeSingle(),
      (supabase as any).from("automation_nodes").select("*").eq("automation_id", automationId).eq("organization_id", currentOrganization.id),
      (supabase as any).from("automation_edges").select("*").eq("automation_id", automationId).eq("organization_id", currentOrganization.id),
    ]);

    const automationData = automationRes.data;
    if (automationData) setAutomationName(automationData.name);

    const triggerConfig = {
      trigger_type: automationData?.trigger_type || "stage_entry",
      webhook_token: automationData?.webhook_token || null,
      schedule_config: automationData?.schedule_config || null,
    };

    const dbNodes = (nodesRes.data || []) as any[];
    const dbEdges = (edgesRes.data || []) as any[];

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
        type: n.node_type,
        position: { x: n.position_x, y: n.position_y },
        data: {
          label: n.label || "",
          config: n.node_type === "trigger"
            ? { ...(n.config || {}), ...triggerConfig }
            : (n.config || {})
        },
      })));
    }

    setEdges(dbEdges.map((e: any) => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      sourceHandle: e.source_handle_id || undefined,
      label: e.condition_label || undefined,
      type: "deletable",
      data: { conditionValue: e.condition_value },
    })));

    await fetchNodeStats();
    setLoading(false);
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
      const layouted = getAutoLayout([...nds], edges, direction);
      return layouted;
    });
    toast({ title: "Layout organizado automaticamente!" });
  }, [setNodes, edges, direction]);

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

  const { executingNodes, nodeOutputs, nodeErrors, onExecuteNode } = useNodeExecution(nodes, currentOrganization);

  const toggleOutputPin = useCallback((nodeId: string) => {
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
      // 1. Fetch old db nodes to calculate Diff safely
      const { data: dbNodes } = await (supabase as any)
        .from("automation_nodes")
        .select("id")
        .eq("automation_id", automationId);

      const dbNodeIds = (dbNodes || []).map((n: any) => n.id);

      const nodeIdMap = new Map<string, string>();
      const nodePayloads = nodes.map((n) => {
        const nodeId = isValidUUID(n.id) ? n.id : crypto.randomUUID();
        nodeIdMap.set(n.id, nodeId);
        return {
          id: nodeId,
          automation_id: automationId,
          organization_id: currentOrganization.id,
          node_type: n.type || "action",
          position_x: Math.round(n.position?.x || 0),
          position_y: Math.round(n.position?.y || 0),
          config: n.data?.config || {},
          label: n.data?.label || null,
        };
      });

      // 2. Perform Explicit Deletion and Safe Upsert for Nodes
      const flowNodeIds = nodePayloads.map(n => n.id);
      const nodesToDelete = dbNodeIds.filter((id: string) => !flowNodeIds.includes(id));

      if (nodesToDelete.length > 0) {
        await (supabase as any).from("automation_nodes").delete().in("id", nodesToDelete);
      }

      if (nodePayloads.length > 0) {
        const { error: nodesError } = await (supabase as any).from("automation_nodes").upsert(nodePayloads);
        if (nodesError) throw nodesError;
      }

      // 3. Clear and Recreate Edges safely via RPC
      const edgePayloads = edges.map((e) => ({
        id: crypto.randomUUID(),
        source_node_id: nodeIdMap.get(e.source) || e.source,
        target_node_id: nodeIdMap.get(e.target) || e.target,
        source_handle_id: e.sourceHandle || null,
        condition_label: typeof e.label === 'string' ? e.label : null,
        condition_value: (e.data as any)?.conditionValue || null,
      }));

      const { error: edgesError } = await (supabase as any).rpc("upsert_flow_edges", {
        p_automation_id: automationId,
        p_organization_id: currentOrganization.id,
        p_edges: edgePayloads,
      });

      if (edgesError) throw edgesError;

      setNodes((nds) => nds.map((n) => ({ ...n, id: nodeIdMap.get(n.id) || n.id })));
      setEdges((eds) => eds.map((e) => ({
        ...e,
        id: crypto.randomUUID(),
        source: nodeIdMap.get(e.source) || e.source,
        target: nodeIdMap.get(e.target) || e.target,
      })));

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
        <Button
          variant={direction === "LR" ? "default" : "outline"}
          size="sm"
          className={`gap-1.5 ${direction === "LR" ? "bg-primary/90 text-primary-foreground" : ""}`}
          onClick={() => { toggleDirection(); }}
          title={direction === "TB" ? "Mudar para layout horizontal (N8N)" : "Mudar para layout vertical"}
        >
          {direction === "LR" ? <MoveHorizontal className="h-3.5 w-3.5" /> : <MoveVertical className="h-3.5 w-3.5" />}
          {direction === "LR" ? "Horizontal" : "Vertical"}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowHistory((p) => !p)}>
          <History className="h-3.5 w-3.5" />
          Execuções
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-500" onClick={() => { setShowSimulator(true); setShowHistory(false); }}>
          <Play className="h-3.5 w-3.5" />
          Executar Teste
        </Button>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className={`flex-1 relative flex flow-direction-${direction}`}>
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes.map((n) => {
              const incomingEdges = edges.filter((e) => e.target === n.id);
              let parent_reached = 0;
              const hasParent = incomingEdges.length > 0;
              incomingEdges.forEach((e) => {
                const pStats = nodeStats[e.source];
                if (pStats) parent_reached += pStats.total_reached || 0;
              });

              const statsValue = nodeStats[n.id] || { total_reached: 0, total_responded: 0 };
              const advancedStats = hasParent ? { ...statsValue, parent_reached } : statsValue;

              const isError = !!nodeErrors[n.id];
              const isHighlighted = highlightedNodeId === n.id;

              let dynClass = "transition-all duration-300";
              if (isError) {
                dynClass += " !ring-2 !ring-destructive !ring-offset-2 !ring-offset-background !rounded-xl !shadow-[0_0_30px_rgba(239,68,68,0.5)]";
              } else if (isHighlighted) {
                dynClass += " !ring-2 !ring-emerald-400 !ring-offset-2 !ring-offset-background !rounded-xl !shadow-[0_0_20px_rgba(16,185,129,0.3)]";
              } else {
                dynClass += " hover:-translate-y-1 hover:shadow-2xl";
              }

              return {
                ...n,
                dragHandle: ".drag-handle-area",
                className: dynClass,
                data: {
                  ...n.data,
                  onChange: onNodeDataChange,
                  onDelete: onDeleteNode,
                  onDuplicate: onDuplicateNode,
                  onRename: onRenameNode,
                  stats: advancedStats,
                  onExecute: onExecuteNode,
                  nodeOutput: nodeOutputs[n.id] || null,
                  nodeError: nodeErrors[n.id] || null,
                  isExecuting: executingNodes.has(n.id),
                  isPinned: pinnedOutputs.has(n.id),
                  onPinOutput: toggleOutputPin,
                  onUnpinOutput: onUnpinOutput,
                  allNodeOutputs: nodeOutputs,
                  allNodes: nodes,
                },
              };
            })}
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
            <Controls className="!bg-background/60 !backdrop-blur-xl !border-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.4)] !rounded-2xl overflow-hidden [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-foreground hover:[&>button]:!bg-white/10 transition-all duration-300" />
            <MiniMap position="bottom-left" className="!bg-background/60 !backdrop-blur-xl !border-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.4)] !rounded-2xl overflow-hidden" nodeColor="hsl(var(--primary))" maskColor="hsl(var(--background) / 0.6)" />
            <Panel position="top-left" className="!m-3">
              <NodeToolbar onAddNode={addNode} canUseAdvanced={canUseAIAutomation} onLockedClick={() => setShowUpgradeDialog(true)} />
            </Panel>
          </ReactFlow>

          {pendingConnection && <AddNodeMenu pendingConnection={pendingConnection} setPendingConnection={setPendingConnection} addNodeAtPosition={addNodeAtPosition} setShowUpgradeDialog={setShowUpgradeDialog} canUseAIAutomation={canUseAIAutomation} />}
        </div>

        {flowCorrections.length > 0 && !showSimulator && <FlowCorrectionsPanel flowCorrections={flowCorrections} setFlowCorrections={setFlowCorrections} nodes={nodes} setNodes={setNodes} setHighlightedNodeId={setHighlightedNodeId} setCenter={setCenter} showSimulator={showSimulator} />}

        {showHistory && automationId && (
          <ExecutionHistoryPanel automationId={automationId} nodes={nodes} />
        )}

        {showSimulator && (
          <FlowSimulatorUI
            nodes={nodes}
            edges={edges}
            onClose={() => setShowSimulator(false)}
            onHighlightNode={setHighlightedNodeId}
            onCorrectionsGenerated={setFlowCorrections}
          />
        )}
      </div>

      {/* Upgrade Dialog */}
      <UpgradeDialog showUpgradeDialog={showUpgradeDialog} setShowUpgradeDialog={setShowUpgradeDialog} />
    </div>
  );
}

export function AutomationFlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowLayoutProvider>
        <AutomationFlowEditorInner />
      </FlowLayoutProvider>
    </ReactFlowProvider>
  );
}
