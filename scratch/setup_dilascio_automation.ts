import { db } from '../src/lib/db';
import { automationFlows } from '../src/lib/db/schema';

async function main() {
  const companyId = 'f04e4c54-4514-4373-82d0-8bf7b7d91cbf';

  const nodes = [
    {
      id: 'trigger_1',
      type: 'trigger',
      position: { x: 250, y: 50 },
      data: { label: 'Gatilho: Nova Mensagem WhatsApp', triggerType: 'message_received' }
    },
    {
      id: 'intent_1',
      type: 'intent_router',
      position: { x: 250, y: 200 },
      data: {
        label: 'Classificador de Intenção',
        intents: [
          { id: 'duvida', label: 'Dúvida/Consultivo' },
          { id: 'agendamento', label: 'Quer Agendar' },
          { id: 'preco_plano', label: 'Objeção/Preço/Plano' }
        ]
      }
    },
    {
      id: 'agent_consultivo',
      type: 'ai_agent',
      position: { x: -100, y: 400 },
      data: {
        label: 'Agente Consultivo (Larissa)',
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        dialogue_mode: true,
        system_message: 'Você é Larissa da Clínica Dilascio. Entenda o problema do lead, faça perguntas de contexto e gere valor. NÃO ofereça dias ou horários. Sua meta é chegar na pergunta: "Esse é o tipo de cuidado que busca?" e aguardar.'
      }
    },
    {
      id: 'agent_agendador',
      type: 'ai_agent',
      position: { x: 250, y: 400 },
      data: {
        label: 'Agente de Agendamento',
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        dialogue_mode: true,
        system_message: 'Você é Larissa. O paciente já validou o cuidado. Siga a ordem restrita: 1. Pergunte o Dia. 2. Pergunte o Turno. 3. Dê duas opções de Horário. 4. Peça o Nome Completo. Nunca volte para explicações clínicas.'
      }
    },
    {
      id: 'agent_objecoes',
      type: 'ai_agent',
      position: { x: 600, y: 400 },
      data: {
        label: 'Agente de Objeções',
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        dialogue_mode: true,
        system_message: 'O paciente tem dúvidas sobre preço ou convênio. Explique que o valor ou cobertura dependem da avaliação inicial para não dar preço no escuro. Retorne a pergunta para se ele deseja fazer a avaliação.'
      }
    },
    {
      id: 'wait_1',
      type: 'wait_response',
      position: { x: 250, y: 600 },
      data: { label: 'Aguardar Resposta do Paciente' }
    },
    {
      id: 'update_state',
      type: 'update_contact',
      position: { x: 250, y: 800 },
      data: {
        label: 'Salvar Estado (Agendado)',
        fields: [ { key: 'custom_fields.etapa_agendamento', value: 'finalizado' } ]
      }
    },
    {
      id: 'agent_confirmacao',
      type: 'ai_agent',
      position: { x: 250, y: 1000 },
      data: {
        label: 'Confirmação Final',
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        dialogue_mode: false,
        system_message: 'Confirme todos os dados do agendamento de forma acolhedora e encerre o atendimento.'
      }
    },
    {
      id: 'crm_move',
      type: 'crm_move',
      position: { x: 250, y: 1200 },
      data: {
        label: 'Mover para Agendado',
        boardId: 'default',
        stageId: 'agendado'
      }
    }
  ];

  const edges = [
    { id: 'e_trigger_intent', source: 'trigger_1', target: 'intent_1' },
    
    // Conexões de saída do Intent Router
    { id: 'e_intent_consultivo', source: 'intent_1', sourceHandle: 'duvida', target: 'agent_consultivo' },
    { id: 'e_intent_agendador', source: 'intent_1', sourceHandle: 'agendamento', target: 'agent_agendador' },
    { id: 'e_intent_objecoes', source: 'intent_1', sourceHandle: 'preco_plano', target: 'agent_objecoes' },
    { id: 'e_intent_fallback', source: 'intent_1', sourceHandle: 'fallback', target: 'agent_consultivo' },
    
    // Conexões pós-agentes de interação
    { id: 'e_consultivo_wait', source: 'agent_consultivo', target: 'wait_1' },
    { id: 'e_objecoes_wait', source: 'agent_objecoes', target: 'wait_1' },
    
    // Loop de volta (Aguardar -> Intent Router para reclassificar e rotear corretamente)
    { id: 'e_wait_intent', source: 'wait_1', target: 'intent_1' },
    
    // Fluxo de conclusão de agendamento
    { id: 'e_agendador_update', source: 'agent_agendador', target: 'update_state' },
    { id: 'e_update_confirmacao', source: 'update_state', target: 'agent_confirmacao' },
    { id: 'e_confirmacao_crm', source: 'agent_confirmacao', target: 'crm_move' }
  ];

  const visualData = { nodes, edges };
  
  const steps = nodes.map(node => ({
    id: node.id,
    type: node.type,
    data: node.data,
    nextSteps: edges.filter(e => e.source === node.id).map(e => e.target),
    connections: edges.filter(e => e.source === node.id).map(e => ({
      target: e.target,
      sourceHandle: e.sourceHandle
    }))
  }));

  try {
    const [inserted] = await db.insert(automationFlows).values({
      companyId,
      name: 'Multi-Agent Clinical Automation (Dilascio)',
      isActive: false, // deixamos desativado para o usuário revisar
      visualData,
      executionLogic: steps,
      triggerType: 'message_received'
    }).returning();
    
    console.log('Automação configurada com sucesso! ID:', inserted.id);
  } catch (error) {
    console.error('Erro ao configurar:', error);
  }
  
  process.exit(0);
}

main();
