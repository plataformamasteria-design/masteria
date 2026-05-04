'use client';

import { useState, useCallback, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';

export interface NodeTestOutput {
    nodeId: string;
    nodeType: string;
    nodeLabel: string;
    output: any;
    outputType: 'json' | 'string';
    status: 'ok' | 'error' | 'skip';
    executionTime: number;
    message?: string;
}

interface UseNodeTestOutputsReturn {
    outputs: Record<string, NodeTestOutput>;
    isTestingNode: string | null;
    isTestingFlow: boolean;
    isListening: string | null;
    flowTestProgress: number;
    testNode: (nodeId: string, nodeType: string, nodeData: any, companyId: string, inputData?: Record<string, any>) => Promise<NodeTestOutput | null>;
    testFlow: (nodes: Node[], edges: Edge[], companyId: string) => Promise<void>;
    listenForWebhook: (nodeId: string, flowId: string, nodeData: any) => Promise<NodeTestOutput | null>;
    cancelListen: () => void;
    clearOutputs: () => void;
    clearNodeOutput: (nodeId: string) => void;
    getNodeOutput: (nodeId: string) => NodeTestOutput | undefined;
}

export function useNodeTestOutputs(): UseNodeTestOutputsReturn {
    const [outputs, setOutputs] = useState<Record<string, NodeTestOutput>>({});
    const [isTestingNode, setIsTestingNode] = useState<string | null>(null);
    const [isTestingFlow, setIsTestingFlow] = useState(false);
    const [isListening, setIsListening] = useState<string | null>(null);
    const [flowTestProgress, setFlowTestProgress] = useState(0);
    const listenAbortRef = useRef<AbortController | null>(null);

    const testNode = useCallback(async (
        nodeId: string,
        nodeType: string,
        nodeData: any,
        companyId: string,
        inputData: Record<string, any> = {},
    ): Promise<NodeTestOutput | null> => {
        setIsTestingNode(nodeId);

        try {
            // Collect outputs from previous nodes as input
            const allInputData = { ...inputData };
            Object.values(outputs).forEach(out => {
                if (out.status === 'ok' && out.output) {
                    allInputData[out.nodeLabel] = out.output;
                    allInputData[`node_${out.nodeId}`] = out.output;
                }
            });

            const res = await fetch('/api/v1/automation-flows/test-node', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodeType,
                    nodeData,
                    inputData: allInputData,
                    companyId,
                }),
            });

            const data = await res.json();

            const result: NodeTestOutput = {
                nodeId,
                nodeType,
                nodeLabel: nodeData.label || nodeType,
                output: data.output,
                outputType: data.outputType || 'json',
                status: data.success ? 'ok' : 'error',
                executionTime: data.executionTime || 0,
                message: data.error || '',
            };

            setOutputs(prev => ({ ...prev, [nodeId]: result }));
            return result;

        } catch (error: any) {
            const errorResult: NodeTestOutput = {
                nodeId,
                nodeType,
                nodeLabel: nodeData.label || nodeType,
                output: { error: error.message },
                outputType: 'json',
                status: 'error',
                executionTime: 0,
                message: error.message,
            };
            setOutputs(prev => ({ ...prev, [nodeId]: errorResult }));
            return errorResult;
        } finally {
            setIsTestingNode(null);
        }
    }, [outputs]);

    const testFlow = useCallback(async (
        nodes: Node[],
        edges: Edge[],
        companyId: string,
        initialVars: Record<string, any> = {},
    ) => {
        setIsTestingFlow(true);
        setFlowTestProgress(0);
        setOutputs({});

        try {
            // Build steps from nodes + edges (same logic as handleSave)
            const steps = nodes.map(node => ({
                id: node.id,
                type: node.type || 'unknown',
                data: { ...node.data, label: node.data.label || node.type },
                nextSteps: edges.filter(e => e.source === node.id).map(e => e.target),
                connections: edges.filter(e => e.source === node.id).map(e => ({
                    target: e.target,
                    sourceHandle: e.sourceHandle || null,
                })),
            }));

            const res = await fetch('/api/v1/automation-flows/test-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ steps, companyId, initialVars }),
            });

            const data = await res.json();

            if (data.success && data.nodeOutputs) {
                const newOutputs: Record<string, NodeTestOutput> = {};
                const totalNodes = data.nodeOutputs.length;

                // Animate progress
                for (let i = 0; i < totalNodes; i++) {
                    const nodeOut = data.nodeOutputs[i];
                    newOutputs[nodeOut.nodeId] = nodeOut;
                    setOutputs({ ...newOutputs });
                    setFlowTestProgress(Math.round(((i + 1) / totalNodes) * 100));
                    // Small delay for visual effect
                    await new Promise(r => setTimeout(r, 200));
                }
            }

        } catch (error: any) {
            console.error('[testFlow] Error:', error);
        } finally {
            setIsTestingFlow(false);
            setFlowTestProgress(100);
        }
    }, []);

    const clearOutputs = useCallback(() => {
        setOutputs({});
        setFlowTestProgress(0);
    }, []);

    const clearNodeOutput = useCallback((nodeId: string) => {
        setOutputs(prev => {
            const next = { ...prev };
            delete next[nodeId];
            return next;
        });
    }, []);

    const getNodeOutput = useCallback((nodeId: string) => {
        return outputs[nodeId];
    }, [outputs]);

    const listenForWebhook = useCallback(async (
        nodeId: string,
        flowId: string,
        nodeData: any,
    ): Promise<NodeTestOutput | null> => {
        setIsListening(nodeId);
        const abortController = new AbortController();
        listenAbortRef.current = abortController;

        try {
            const res = await fetch(`/api/v1/automation-flows/webhook-trigger/listen?flowId=${flowId}`, {
                signal: abortController.signal,
            });
            const data = await res.json();

            if (data.received && data.data) {
                const result: NodeTestOutput = {
                    nodeId,
                    nodeType: 'trigger',
                    nodeLabel: nodeData.label || 'Webhook',
                    output: data.data,
                    outputType: 'json',
                    status: 'ok',
                    executionTime: data.waitTime || 0,
                    message: `Evento recebido em ${data.receivedAt}`,
                };
                setOutputs(prev => ({ ...prev, [nodeId]: result }));
                return result;
            } else {
                const timeoutResult: NodeTestOutput = {
                    nodeId,
                    nodeType: 'trigger',
                    nodeLabel: nodeData.label || 'Webhook',
                    output: { timeout: true, message: 'Nenhum evento recebido em 5 min' },
                    outputType: 'json',
                    status: 'skip',
                    executionTime: data.waitTime || 300000,
                    message: 'Timeout — nenhum webhook recebido',
                };
                setOutputs(prev => ({ ...prev, [nodeId]: timeoutResult }));
                return timeoutResult;
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                return null; // cancelled
            }
            const errorResult: NodeTestOutput = {
                nodeId,
                nodeType: 'trigger',
                nodeLabel: nodeData.label || 'Webhook',
                output: { error: error.message },
                outputType: 'json',
                status: 'error',
                executionTime: 0,
                message: error.message,
            };
            setOutputs(prev => ({ ...prev, [nodeId]: errorResult }));
            return errorResult;
        } finally {
            setIsListening(null);
            listenAbortRef.current = null;
        }
    }, []);

    const cancelListen = useCallback(() => {
        if (listenAbortRef.current) {
            listenAbortRef.current.abort();
            listenAbortRef.current = null;
        }
        setIsListening(null);
    }, []);

    return {
        outputs,
        isTestingNode,
        isTestingFlow,
        isListening,
        flowTestProgress,
        testNode,
        testFlow,
        listenForWebhook,
        cancelListen,
        clearOutputs,
        clearNodeOutput,
        getNodeOutput,
    };
}
