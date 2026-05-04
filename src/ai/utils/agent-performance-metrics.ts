// src/ai/utils/agent-performance-metrics.ts
// Implementação simples para substituir o sistema de agentes descontinuado

interface PerformanceMetrics {
  successRate: number;
  averageResponseTime: number;
  totalRequests: number;
  errors: number;
}

class AgentPerformanceMetrics {
  static async getMetrics(): Promise<PerformanceMetrics> {
    // Retorna métricas padrão indicando que os agentes foram migrados
    return {
      successRate: 100,
      averageResponseTime: 0,
      totalRequests: 0,
      errors: 0
    };
  }

  static async getRealTimeMetrics(): Promise<any> {
    return {
      message: "Agentes migrados para microserviços Python",
      timestamp: new Date().toISOString()
    };
  }
}

export default AgentPerformanceMetrics;