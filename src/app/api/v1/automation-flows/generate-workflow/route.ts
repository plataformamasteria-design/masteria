import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `Você é um especialista em criar workflows de automação para WhatsApp. Seu trabalho é transformar uma descrição em linguagem natural em um workflow completo com nodes e edges no formato JSON.

## Tipos de Nodes Disponíveis

### Gatilho (OBRIGATÓRIO como primeiro node)
- **trigger**: Ponto de entrada do fluxo
  - triggerType: "message_received" | "webhook"
  - keyword: string (palavra-chave para ativar, ex: "oi", "preço")
  - match_mode: "exact" | "contains" | "starts_with" | "regex"

### Mensagens
- **send_message**: Envia mensagem de texto
  - message: string (o texto a enviar)
- **send_image**: Envia imagem
  - imageUrl: string, caption: string
- **send_audio**: Envia áudio
  - audioUrl: string
- **send_document**: Envia documento
  - documentUrl: string, caption: string
- **send_video**: Envia vídeo
  - videoUrl: string, caption: string

### Interação
- **ask_question**: Faz uma pergunta com opções
  - question: string, options: string[] (ex: ["Sim", "Não"])
- **capture_info**: Captura informação do contato
  - field_key: string (ex: "name", "email", "phone", "cpf"), prompt_message: string
- **wait_response**: Aguarda resposta do usuário
  - timeout_minutes: number

### Lógica
- **condition**: Condição SE/SENÃO
  - field: string, operator: "equals" | "contains" | "greater_than" | "less_than", value: string
- **filter**: Filtro com múltiplas condições
  - conditions: Array<{field: string, operator: string, value: string}>, match_mode: "all" | "any"
- **router**: Router com regras de roteamento
  - rules: Array<{label: string, condition: string}>
- **delay**: Espera um tempo antes de continuar
  - amount: string (número), unit: "seconds" | "minutes" | "hours" | "days"

### CRM & Ações
- **crm_move**: Move contato no Kanban
  - boardId: string, stageId: string
- **bot_toggle**: Ativa/desativa bot
  - action: "enable" | "disable"
- **stop_bot**: Para o bot
- **loop_restart**: Reinicia o loop
  - delay_amount: number, delay_unit: "minutes" | "hours" | "days"

### Inteligência Artificial
- **ai_agent**: Agente de IA que processa texto
  - provider: "gemini", model: "gemini-2.0-flash", prompt: string (instrução do agente)
- **intent_router**: Classificador de intenção via IA
  - intents: Array<{label: string, description: string}> (ex: [{label: "vendas", description: "Cliente quer comprar"}])
- **follow_up_ai**: Follow up inteligente com IA
- **send_ai_response**: Envia resposta gerada pela IA

### Avançado
- **http_request**: Faz requisição HTTP
  - method: "GET" | "POST" | "PUT" | "DELETE", url: string, headers: object, body: string
- **code**: Executa código JavaScript
  - language: "javascript", code: string
- **edit_fields**: Edita campos de dados
  - fields: Array<{key: string, value: string}>, mode: "pairs"

## Regras de Geração

1. O PRIMEIRO node DEVE ser um "trigger" com id "trigger-1"
2. Cada node deve ter um id único no formato "tipo-timestamp" (ex: "send_message-1", "ask_question-2")
3. Use ids sequenciais simples: "trigger-1", "send_message-2", "ask_question-3", etc.
4. Cada edge conecta dois nodes: source → target
5. Edges devem ter type: "master-flow" e animated: true
6. Posicione os nodes sequencialmente: x=400, y incrementando em 200 para cada node
7. O trigger node deve estar em position {x: 400, y: 50}
8. Preencha os campos data com valores realistas e em português
9. NÃO deixe campos obrigatórios vazios
10. Para condições, use sourceHandle "true" e "false" para as saídas
11. Para ask_question, use sourceHandle com o índice da opção: "option-0", "option-1", etc.

## Formato de Saída

Responda APENAS com JSON válido, sem markdown, sem explicações:

{
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger",
      "position": { "x": 400, "y": 50 },
      "data": { "label": "Gatilho: Nova Mensagem", "triggerType": "message_received" }
    }
  ],
  "edges": [
    {
      "id": "e-trigger-1-send_message-2",
      "source": "trigger-1",
      "target": "send_message-2",
      "type": "master-flow",
      "animated": true
    }
  ],
  "name": "Nome sugerido para o workflow"
}`;

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt é obrigatório.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_GEMINI_AGENTS1 || process.env.google_api_key_agents1 || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave de API do Gemini não configurada.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: `Crie um workflow de automação para: ${prompt}` },
    ]);

    const responseText = result.response.text();

    // Parse e valide o JSON
    let workflow;
    try {
      workflow = JSON.parse(responseText);
    } catch {
      // Tenta extrair JSON de blocos de código markdown
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        workflow = JSON.parse(jsonMatch[1]!);
      } else {
        throw new Error('Resposta da IA não é JSON válido.');
      }
    }

    // Validação básica
    if (!workflow.nodes || !Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
      throw new Error('Workflow gerado não contém nodes válidos.');
    }

    if (!workflow.edges || !Array.isArray(workflow.edges)) {
      workflow.edges = [];
    }

    // Garantir que todo node tem position válida
    workflow.nodes = workflow.nodes.map((node: any, i: number) => ({
      ...node,
      position: node.position || { x: 400, y: i * 200 + 50 },
      data: {
        ...node.data,
        label: node.data?.label || node.type || 'Node',
      },
    }));

    return NextResponse.json({
      success: true,
      nodes: workflow.nodes,
      edges: workflow.edges,
      name: workflow.name || 'Workflow Gerado por IA',
    });
  } catch (error: any) {
    console.error('GenerateWorkflow Error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar workflow.' },
      { status: 500 }
    );
  }
}
