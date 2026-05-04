import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from '../lib/db';
import { automationFlows } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

// Função auxiliar para mapear tipos antigos para novos
function mapNodeType(node: any): string {
    const oldType = node.type;
    const data = node.data || {};

    switch (oldType) {
        case 'message': return 'send_message';
        case 'media':
            if (data.mediaType === 'audio') return 'send_audio';
            if (data.mediaType === 'video') return 'send_video';
            if (data.mediaType === 'document') return 'send_document';
            return 'send_image'; // default
        case 'logic':
            if (data.logicType === 'condition') return 'condition';
            if (data.logicType === 'wait_response') return 'wait_response';
            if (data.logicType === 'ab_test') return 'ab_test';
            return 'delay'; // default
        case 'action':
            if (data.actionType === 'assign') return 'assign_user';
            if (data.actionType === 'note') return 'add_note';
            return 'add_tag'; // default
        case 'crm':
            if (data.crmType === 'lookup') return 'lookup_lead';
            return 'crm_move'; // default
        case 'ai': return 'ai_agent';
        case 'interaction':
            if (data.interactionType === 'capture') return 'capture_info';
            if (data.interactionType === 'wait_response') return 'wait_response';
            return 'ask_question'; // default
        default: return oldType; // trigger ou tipos já v4
    }
}

// Mapeamento de handles (quando a porta muda de nome do V3 pro V4)
function mapEdgeSourceHandle(sourceType: string, handle: string | null): string | null {
    if (sourceType === 'ai' && handle === 'max_turns') return 'timeout';
    if (sourceType === 'logic' && handle === 'timeout') return 'timeout'; // já é timeout no v4 delay
    return handle;
}

async function main() {
    console.log('🔄 Iniciando migração das Automações para V4...');
    
    try {
        const flows = await db.select().from(automationFlows);
        console.log(`📊 Encontrados ${flows.length} fluxos.`);

        let migratedCount = 0;

        for (const flow of flows) {
            let hasChanges = false;
            
            // 1. Migrar visualData (o que renderiza no canvas)
            let newVisualData: any = null;
            if (flow.visualData && typeof flow.visualData === 'object') {
                const vData = flow.visualData as any;
                const nodes = Array.isArray(vData.nodes) ? vData.nodes : [];
                const edges = Array.isArray(vData.edges) ? vData.edges : [];

                // Mapeia IDs antigos de node (ex: node-1) para o sourceType para atualizar os edges depois
                const nodeTypesMap = new Map<string, string>();
                
                const newNodes = nodes.map((n: any) => {
                    const oldType = n.type;
                    const newType = mapNodeType(n);
                    nodeTypesMap.set(n.id, oldType); // guarda tipo antigo pra saber como mapear as edges
                    
                    if (oldType !== newType) hasChanges = true;
                    
                    // Renomear chaves problemáticas dentro de data se necessário
                    const newData = { ...n.data };
                    
                    // Se a label for igual ao tipo antigo ou novo (ex: 'ai_agent', 'delay'), limpar para usar o default do V4
                    if (newData.label && (newData.label === oldType || newData.label === newType)) {
                        delete newData.label;
                        hasChanges = true;
                    }
                    
                    return { ...n, type: newType, data: newData };
                });

                const newEdges = edges.map((e: any) => {
                    const sourceType = nodeTypesMap.get(e.source) || '';
                    const newHandle = mapEdgeSourceHandle(sourceType, e.sourceHandle);
                    
                    if (newHandle !== e.sourceHandle) hasChanges = true;
                    
                    return { ...e, sourceHandle: newHandle };
                });

                newVisualData = { ...vData, nodes: newNodes, edges: newEdges };
            }

            // 2. Migrar executionLogic (o que o motor backend processa)
            let newExecutionLogic: any = null;
            if (flow.executionLogic && typeof flow.executionLogic === 'object') {
                const eLogic = flow.executionLogic as any;
                const steps = Array.isArray(eLogic.steps) ? eLogic.steps : (Array.isArray(eLogic) ? eLogic : []);
                
                const nodeTypesMap = new Map<string, string>();
                
                const newSteps = steps.map((s: any) => {
                    const oldType = s.type;
                    const newType = mapNodeType(s);
                    nodeTypesMap.set(s.id, oldType);
                    
                    if (oldType !== newType) hasChanges = true;
                    
                    // Migrar array de connections para o backend também
                    const newConns = (s.connections || []).map((c: any) => ({
                        ...c,
                        sourceHandle: mapEdgeSourceHandle(oldType, c.sourceHandle)
                    }));
                    
                    return { ...s, type: newType, connections: newConns };
                });

                newExecutionLogic = Array.isArray(eLogic) ? newSteps : { ...eLogic, steps: newSteps };
            }

            // Salvar se houve mudança
            if (hasChanges) {
                console.log(`🔧 Atualizando fluxo: ${flow.name} (${flow.id})`);
                await db.update(automationFlows).set({
                    visualData: newVisualData || flow.visualData,
                    executionLogic: newExecutionLogic || flow.executionLogic
                }).where(eq(automationFlows.id, flow.id));
                migratedCount++;
            } else {
                console.log(`✅ Fluxo já no formato V4: ${flow.name} (${flow.id})`);
            }
        }

        console.log(`🎉 Migração concluída! ${migratedCount} fluxos atualizados.`);
    } catch (e) {
        console.error('❌ Erro na migração:', e);
    }
    
    process.exit(0);
}

main();
