'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Settings2 } from 'lucide-react';
import type { Node } from '@xyflow/react';
import dynamic from 'next/dynamic';
import { motion, useDragControls } from 'framer-motion';
import { cn } from '@/lib/utils';

const NodeConfigPanel = dynamic(() => import('../NodeConfigPanel').then(m => m.NodeConfigPanel), {
    loading: () => <div className="flex justify-center items-center h-full text-zinc-400">Carregando painel...</div>
});

const NodeOutputPanel = dynamic(() => import('../NodeOutputPanel').then(m => m.NodeOutputPanel), {
    loading: () => <div className="flex justify-center items-center h-full text-zinc-400">Carregando teste...</div>
});
import type { NodeTestOutput } from '@/hooks/useNodeTestOutputs';

interface NodeConfigDrawerProps {
    node: Node | null;
    onClose: () => void;
    onUpdateData: (nodeId: string, data: Record<string, any>) => void;
    testOutput?: NodeTestOutput;
    isTestingNode?: boolean;
    onTestNode?: () => void;
    allTestOutputs?: Record<string, NodeTestOutput>;
    isListening?: boolean;
    onListen?: () => void;
    onCancelListen?: () => void;
    flowId?: string;
    zIndex?: number;
    onFocus?: () => void;
}

const NODE_TYPE_LABELS: Record<string, string> = {
    trigger: 'Gatilho',
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
    ai_copilot: 'Assistente Interno',
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
    assign_connection: 'Atribuir Conexão',
    add_tag: 'Adicionar Tag',
    update_contact: 'Atualizar Contato',
};

export function NodeConfigDrawer({
    node,
    onClose,
    onUpdateData,
    testOutput,
    isTestingNode,
    onTestNode,
    allTestOutputs,
    isListening,
    onListen,
    onCancelListen,
    flowId,
    zIndex = 30,
    onFocus,
}: NodeConfigDrawerProps) {
    const drawerRef = useRef<HTMLDivElement>(null);
    const [showTestPanel, setShowTestPanel] = useState(false);
    const dragControls = useDragControls();

    // Reset test panel when node changes
    useEffect(() => {
        setShowTestPanel(false);
    }, [node?.id]);

    // Fechar com ESC
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const isOpen = !!node;
    const nodeType = node?.type || '';
    const nodeLabel = (node?.data as any)?.label || NODE_TYPE_LABELS[nodeType] || nodeType;

    return (
        <>
            {/* Drawer (agora Flutuante) */}
            <motion.div
                ref={drawerRef}
                drag
                dragControls={dragControls}
                dragListener={false}
                dragMomentum={false}
                onPointerDownCapture={onFocus}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{ 
                    zIndex,
                    right: 64 + (zIndex - 50) * 24, 
                    top: 64 + (zIndex - 50) * 24 
                }}
                className={cn(
                    'fixed max-h-[85vh] w-[380px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800',
                    'shadow-2xl flex flex-col rounded-2xl overflow-hidden',
                    !isOpen && 'hidden'
                )}
            >
                {/* Header */}
                <div 
                    onPointerDown={(e) => dragControls.start(e)}
                    className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0 drag-handle cursor-grab active:cursor-grabbing"
                >
                    <div className="w-7 h-7 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                        <Settings2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">{nodeType}</p>
                        <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{nodeLabel}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:text-zinc-200 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-100 dark:bg-zinc-800 transition-colors"
                        title="Fechar (ESC)"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Conteúdo — reutiliza o NodeConfigPanel existente */}
                <div className="flex-1 overflow-y-auto">
                    {node && (
                        <div className="p-4">
                            <NodeConfigPanel
                                node={node}
                                onUpdateData={onUpdateData}
                                testOutput={testOutput}
                                isTestingNode={isTestingNode}
                                onTestNode={onTestNode}
                                allTestOutputs={allTestOutputs}
                                isListening={isListening}
                                onListen={onListen}
                                onCancelListen={onCancelListen}
                                flowId={flowId}
                            />
                        </div>
                    )}
                </div>

                {/* Painel de Teste / Output em Tempo Real */}
                {node && !showTestPanel && (
                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shrink-0">
                        <button
                            onClick={() => setShowTestPanel(true)}
                            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg hover:bg-zinc-50 dark:bg-zinc-900/50 dark:hover:bg-zinc-100 dark:bg-zinc-800 transition-colors shadow-sm"
                        >
                            <Settings2 className="w-3.5 h-3.5" />
                            Abrir Painel de Teste
                        </button>
                    </div>
                )}

                {node && showTestPanel && (
                    <div className="h-[280px] shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col relative shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <button
                                onClick={() => setShowTestPanel(false)}
                                className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-full p-1 transition-colors shadow-sm"
                                title="Fechar Painel de Teste"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <NodeOutputPanel
                                nodeId={node.id}
                                nodeType={node.type || ''}
                                nodeData={node.data}
                                output={testOutput}
                                isLoading={!!isTestingNode}
                                onTest={onTestNode || (() => {})}
                                isListening={isListening}
                                onListen={onListen}
                                onCancelListen={onCancelListen}
                            />
                        </div>
                    </div>
                )}
            </motion.div>
        </>
    );
}
