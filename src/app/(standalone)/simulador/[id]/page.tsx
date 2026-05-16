"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import { FlowSimulatorUI } from "@/components/automations/editor-v4/simulator/FlowSimulatorUI";
import { Node, Edge } from "@xyflow/react";

export default function StandaloneSimulatorPage() {
    const params = useParams();
    const automationId = params?.id as string;
    const { session } = useSession();
    
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!automationId) return;
        
        const load = async () => {
            try {
                const { getFlow } = await import("@/lib/automations");
                const flow = await getFlow(automationId, session?.empresaId || undefined);
                
                if (!flow) throw new Error("Automação não encontrada");
                
                if (flow.visualData) {
                    const visual = flow.visualData as any;
                    
                    const triggerConfig = {
                        trigger_type: flow.triggerType || "stage_entry",
                        webhook_token: flow.webhookToken || null,
                        schedule_config: flow.scheduleConfig || null,
                    };

                    let loadedNodes = [];
                    if (Array.isArray(visual.nodes)) {
                        loadedNodes = visual.nodes.map((n: Node) => {
                            if (n.type === "trigger" || n.type === "custom_trigger") {
                                return {
                                    ...n,
                                    data: {
                                        ...n.data,
                                        ...triggerConfig,
                                        config: { ...(n.data?.config || {}), ...triggerConfig }
                                    }
                                };
                            }
                            return n;
                        });
                    }
                    
                    setNodes(loadedNodes);
                    if (Array.isArray(visual.edges)) setEdges(visual.edges);
                } else {
                    setNodes([]);
                    setEdges([]);
                }
            } catch (err: any) {
                setError(err.message || "Erro ao carregar automação");
            } finally {
                setLoading(false);
            }
        };
        
        load();
    }, [automationId, session?.empresaId]);
    
    if (loading) {
        return (
            <div className="flex-1 flex w-full h-[100dvh] items-center justify-center text-white font-medium gap-3 flex-col">
                <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-violet-500 animate-bounce [animation-delay:0ms]" />
                    <div className="h-2 w-2 rounded-full bg-violet-500 animate-bounce [animation-delay:150ms]" />
                    <div className="h-2 w-2 rounded-full bg-violet-500 animate-bounce [animation-delay:300ms]" />
                </div>
                <span>Carregando Máquina Virtual...</span>
            </div>
        );
    }
    
    if (error) {
        return <div className="flex-1 w-full min-h-screen flex items-center justify-center text-red-500 font-medium">{error}</div>;
    }

    const handleMemoryUpdated = (nodeId: string, newNotes: string) => {
        setNodes(ns => ns.map(n => {
            if (n.id === nodeId) {
                return {
                    ...n,
                    data: {
                        ...n.data,
                        learning_notes: newNotes,
                        config: {
                            ...(n.data.config || {}),
                            learning_notes: newNotes
                        }
                    }
                };
            }
            return n;
        }));
    };

    return (
        <FlowSimulatorUI
            nodes={nodes}
            edges={edges}
            automationId={automationId}
            onClose={() => {}}
            standalone={true}
            onMemoryUpdated={handleMemoryUpdated}
        />
    );
}
