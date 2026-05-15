/**
 * Lógica de scoring de criativos de vídeo.
 * Calcula um score de 0-100 baseado em Hook Rate, Hold Rate e Completion Rate.
 * Funções puras sem dependências externas.
 */

import type { CalculatedMetrics, CreativeScore } from "./types/metaVideo";

/**
 * Normaliza Hook Rate para escala 0-100.
 * Benchmark: 40%+ de Hook Rate (p25/impressions) = pontuação máxima (100).
 * Fórmula: min((hookRate / 40) * 100, 100)
 */
export function normalizeHookRate(hookRate: number): number {
  if (!isFinite(hookRate) || hookRate <= 0) return 0;
  return Math.min((hookRate / 40) * 100, 100);
}

/**
 * Normaliza Hold Rate para escala 0-100.
 * Benchmark: 60%+ de Hold Rate = pontuação máxima (100).
 * Fórmula: min((holdRate / 60) * 100, 100)
 */
export function normalizeHoldRate(holdRate: number): number {
  if (!isFinite(holdRate) || holdRate <= 0) return 0;
  return Math.min((holdRate / 60) * 100, 100);
}

/**
 * Normaliza Completion Rate para escala 0-100.
 * Benchmark: 40%+ de Completion Rate = pontuação máxima (100).
 * Fórmula: min((completionRate / 40) * 100, 100)
 */
export function normalizeCompletionRate(completionRate: number): number {
  if (!isFinite(completionRate) || completionRate <= 0) return 0;
  return Math.min((completionRate / 40) * 100, 100);
}

/**
 * Calcula o Creative Score combinando as 3 métricas normalizadas.
 *
 * Pesos:
 * - Hook Rate:       40% (a mais importante — se ninguém para, nada importa)
 * - Hold Rate:       35% (retenção pós-hook — mede qualidade do conteúdo)
 * - Completion Rate: 25% (quem assiste tudo — mede engajamento profundo)
 *
 * Faixas de score:
 * - 70-100 → "Excelente" / verde
 * - 45-69  → "Bom" / azul
 * - 25-44  → "Atenção" / amarelo
 * - 0-24   → "Crítico" / vermelho
 */
export function calculateCreativeScore(metrics: CalculatedMetrics): CreativeScore {
  const normHook = normalizeHookRate(metrics.hookRate);
  const normHold = normalizeHoldRate(metrics.holdRate);
  const normCompletion = normalizeCompletionRate(metrics.completionRate);

  const score = Math.round(normHook * 0.40 + normHold * 0.35 + normCompletion * 0.25);

  if (score >= 70) return { score, label: "Excelente", color: "green" };
  if (score >= 45) return { score, label: "Bom", color: "blue" };
  if (score >= 25) return { score, label: "Atenção", color: "yellow" };
  return { score, label: "Crítico", color: "red" };
}
