// src/lib/simple-chat.ts

export interface ConversationContext {
  requestId: string;
  userId: string;
  companyId: string;
  sessionId: string;
  previousMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  userPreferences: {
    language: string;
    tone: string;
    verbosity: string;
  };
}

export interface ProcessResult {
  response: string;
  agentUsed: string;
  usedFallback: boolean;
  usedCache: boolean;
  confidence: number;
  executionTime: number;
  metadata: Record<string, any>;
}

// Implementação simples que substitui o enhanced orchestrator
export async function processEnhancedQuery(
  query: string, 
  context: ConversationContext
): Promise<ProcessResult> {
  const startTime = Date.now();
  
  // Resposta simples baseada em palavras-chave
  let response = "Desculpe, não consegui processar sua solicitação. Os agentes de IA foram migrados para microserviços Python.";
  
  // Algumas respostas básicas para manter funcionalidade mínima
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('olá') || lowerQuery.includes('oi')) {
    response = "Olá! Como posso ajudá-lo hoje?";
  } else if (lowerQuery.includes('obrigado') || lowerQuery.includes('obrigada')) {
    response = "De nada! Fico feliz em ajudar.";
  } else if (lowerQuery.includes('ajuda') || lowerQuery.includes('help')) {
    response = "Estou aqui para ajudar! Os agentes de IA foram migrados para microserviços Python. Para funcionalidades avançadas, entre em contato com o suporte.";
  }
  
  const executionTime = Date.now() - startTime;
  
  return {
    response,
    agentUsed: 'simple-fallback',
    usedFallback: true,
    usedCache: false,
    confidence: 0.5,
    executionTime,
    metadata: {
      queryLength: query.length,
      contextMessages: context.previousMessages.length
    }
  };
}