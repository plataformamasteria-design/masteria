// src/ai/llm.ts
// Implementação simples para substituir o sistema de agentes descontinuado

export interface ModelConfig {
  model: string;
  provider: string;
  modelName: string;
}

export function getActiveAIProviders(): string[] {
  return ['gemini'];
}

export async function getModel(): Promise<ModelConfig> {
  return {
    model: 'gemini-2.0-flash',
    provider: 'gemini',
    modelName: 'gemini-2.0-flash'
  };
}
