// src/ai/integration-example.ts
// Implementação simples para substituir o sistema de agentes descontinuado

export interface ChatPerformanceMetrics {
  totalChats: number;
  averageResponseTime: number;
  successRate: number;
  fallbackUsage: number;
}

export async function getChatPerformanceMetrics(): Promise<ChatPerformanceMetrics> {
  // Retorna métricas padrão indicando que os agentes foram migrados
  return {
    totalChats: 0,
    averageResponseTime: 0,
    successRate: 100,
    fallbackUsage: 0
  };
}