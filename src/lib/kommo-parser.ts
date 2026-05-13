import { Node, Edge } from '@xyflow/react';

// Interfaces para os tipos internos do React Flow usados pelo Master I.A
interface ParsedResult {
    nodes: Node[];
    edges: Edge[];
}

export function parseKommoFile(fileContent: string): ParsedResult {
    try {
        const parsed = JSON.parse(fileContent);
        if (!parsed.model || !parsed.model.positions) {
            throw new Error("Formato inválido. 'model.positions' não encontrado.");
        }

        const positions = typeof parsed.model.positions === 'string' 
            ? JSON.parse(parsed.model.positions) 
            : parsed.model.positions;

        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // Helper para gerar IDs compatíveis com o nosso React Flow
        const blockIdMap = new Map<number | string, string>();
        
        positions.forEach((block: any) => {
            const nodeId = `node_${crypto.randomUUID()}`;
            blockIdMap.set(block.id, nodeId);
        });

        positions.forEach((block: any) => {
            // Ignorar nós invisíveis do sistema do kommo (static / trigger genérico)
            if (block.id === -1 || block.type === 'static') return;
            
            const nodeId = blockIdMap.get(block.id)!;
            const position = { x: block.x || 0, y: block.y || 0 };
            
            let nodeType = '';
            let data: any = { label: block.name || 'Kommo Block' };

            const isStart = block.type === 'start';
            const isFinish = block.type === 'finish';
            const actions = block.actions || [];
            const primaryAction = actions[0]?.params || {};
            const handler = primaryAction.handler || '';
            const actionName = primaryAction.params?.name || '';
            
            if (isStart) {
                nodeType = 'trigger';
                data = {
                    ...data,
                    label: 'Gatilho (Importado)',
                    triggerType: 'message_received', // Default para automações importadas
                    message_category: 'general'
                };
            } else if (isFinish) {
                nodeType = 'stop_bot';
                data = { ...data, label: 'Parar Automação' };
            } else if (handler === 'conditions') {
                nodeType = 'condition';
                data = { ...data, label: block.name || 'Condição Importada' };
                // Opcional: Tentar extrair lógica complexa de condições, mas deixaremos genérico de início
            } else if (handler === 'action' && actionName === 'set_tag') {
                nodeType = 'add_tag';
                data = { 
                    ...data, 
                    label: 'Adicionar Tag',
                    tag_name: primaryAction.params?.value?.[0] || 'Tag Importada'
                };
            } else if (handler === 'action' && actionName === 'change_responsible_user') {
                nodeType = 'assign_user';
                data = {
                    ...data,
                    label: 'Atribuir Lead',
                    assign_type: 'user',
                    user_id: String(primaryAction.params?.value || '')
                };
            } else if (handler === 'distribution' || primaryAction.params?.type === 'round_robin') {
                nodeType = 'assign_user';
                data = {
                    ...data,
                    label: 'Round Robin (Distribuição)',
                    assign_type: 'random_in_team',
                    agent_weights: []
                };
            } else if (handler === 'send_message') {
                const buttons = primaryAction.params?.buttons || [];
                const attachments = primaryAction.params?.attachments || [];
                const hasNoAnswer = !!block.no_answer;
                
                if (buttons.length > 0 || attachments.length > 0 || hasNoAnswer) {
                    nodeType = 'interactive_message';
                    data = {
                        ...data,
                        label: block.name || 'Mensagem Interativa',
                        message: primaryAction.params?.text || '',
                        buttons: buttons.map((b: any, i: number) => ({ id: `btn_${i}`, text: b.text, type: b.type })),
                        attachments: attachments
                    };
                } else {
                    nodeType = 'send_message';
                    data = {
                        ...data,
                        label: block.name || 'Enviar Mensagem',
                        message: primaryAction.params?.text || ''
                    };
                }
            } else if (handler === 'wait' || handler === 'waits') {
                nodeType = 'delay';
                const delaySecs = primaryAction.params?.event?.delay || 60;
                data = {
                    ...data,
                    label: block.name || 'Atraso / Pausa',
                    amount: Math.max(1, Math.round(delaySecs / 60)),
                    unit: 'minutes'
                };
            } else if (handler === 'action' && actionName === 'change_status') {
                nodeType = 'crm_move';
                data = {
                    ...data,
                    label: block.name || 'Mover Kanban',
                    pipelineId: String(primaryAction.params?.pipeline_id || ''),
                    boardId: String(primaryAction.params?.value || '')
                };
            } else if (handler === 'send_internal') {
                nodeType = 'add_note';
                data = {
                    ...data,
                    label: block.name || 'Mensagem Interna',
                    note: primaryAction.params?.message || ''
                };
            } else if (handler === 'trigger' && primaryAction.params?.trigger?.action === 'create_task') {
                nodeType = 'add_note';
                data = {
                    ...data,
                    label: block.name || 'Adicionar Tarefa',
                    note: `[TAREFA]: ${primaryAction.params?.trigger?.settings?.task_text || 'Sem descrição'}`
                };
            } else {
                // Fallback para qualquer nó question não mapeado
                nodeType = 'message';
                data = {
                    ...data,
                    label: block.name || 'Nó Desconhecido',
                    message: '[Lógica importada do Kommo não suportada nativamente]'
                };
            }

            nodes.push({
                id: nodeId,
                type: nodeType,
                position,
                data
            });

            // Gerar as conexões (Edges)
            // Kommo pode usar `goto: { block: X }` ou `links: [{ block: X }]` dentro de actions
            
            // 1. Root goto
            if (block.goto && block.goto.block !== undefined) {
                const targetNodeId = blockIdMap.get(block.goto.block);
                if (targetNodeId) {
                    edges.push({
                        id: `edge_${crypto.randomUUID()}`,
                        source: nodeId,
                        target: targetNodeId,
                        sourceHandle: nodeType === 'interactive_message' ? 'other_response' : undefined,
                        type: 'flow-edge'
                    });
                }
            }

            // 2. Action links
            actions.forEach((act: any, idx: number) => {
                if (act.links && Array.isArray(act.links)) {
                    act.links.forEach((link: any, linkIdx: number) => {
                        const targetNodeId = blockIdMap.get(link.block);
                        if (targetNodeId) {
                            let sourceHandle: string | undefined = undefined;
                            
                            if (nodeType === 'condition') {
                                sourceHandle = idx === 0 ? 'yes' : 'no';
                            } else if (nodeType === 'interactive_message') {
                                if (link.data && link.data.regex) {
                                    // Tenta extrair o nome do botão via regex do Kommo (ex: "/Botão A/iu")
                                    const match = link.data.regex.match(/\/(.+)\/i?u?/);
                                    const btnText = match ? match[1] : null;
                                    const btnIdx = btnText ? data.buttons?.findIndex((b: any) => b.text === btnText) : -1;
                                    
                                    if (btnIdx !== -1 && btnIdx !== undefined) {
                                        sourceHandle = `btn_${btnIdx}`;
                                    } else {
                                        sourceHandle = 'other_response';
                                    }
                                } else {
                                    sourceHandle = 'other_response';
                                }
                            }
                            
                            edges.push({
                                id: `edge_${crypto.randomUUID()}`,
                                source: nodeId,
                                target: targetNodeId,
                                sourceHandle,
                                type: 'flow-edge'
                            });
                        }
                    });
                }
            });

            // 3. No Answer (Timeout)
            if (block.no_answer && block.no_answer.block !== undefined) {
                const targetNodeId = blockIdMap.get(block.no_answer.block);
                if (targetNodeId) {
                    edges.push({
                        id: `edge_${crypto.randomUUID()}`,
                        source: nodeId,
                        target: targetNodeId,
                        sourceHandle: nodeType === 'interactive_message' ? 'no_response' : undefined,
                        type: 'flow-edge'
                    });
                }
            }
        });

        return { nodes, edges };
    } catch (err: any) {
        throw new Error(`Falha ao ler arquivo do Kommo: ${err.message}`);
    }
}
