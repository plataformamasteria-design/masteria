
// src/lib/costs.ts

import { db, aiUsageDaily } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';
import { format } from 'date-fns';

// Tabela de preços padrão em USD por 1 milhão de tokens
// Chave no formato "provedor:modelo"
const DEFAULT_PRICE_TABLE: Record<string, { input: number; output: number }> = {
  'openai:gpt-4o-mini': { input: 0.15, output: 0.60 },
};

// Permite override via variáveis de ambiente
const getPriceTable = (): Record<string, { input: number; output: number }> => {
  const priceTable = { ...DEFAULT_PRICE_TABLE };
  for (const key in process.env) {
    if (key.startsWith('AI_PRICE_')) {
      const parts = key.replace('AI_PRICE_', '').toLowerCase().split('_');
      const type = parts.pop(); // input ou output
      const provider = parts.shift();
      const model = parts.join('-');
      
      if (provider && model && (type === 'input' || type === 'output')) {
        const modelKey = `${provider}:${model}`;
        if (!priceTable[modelKey]) {
          priceTable[modelKey] = { input: 0, output: 0 };
        }
        const priceTableEntry = priceTable[modelKey];
        if (priceTableEntry) {
            priceTableEntry[type] = parseFloat(process.env[key] || '0');
        }
      }
    }
  }
  return priceTable;
};

export const PRICE_TABLE = getPriceTable();
const COMPANY_DAILY_BUDGET_USD = parseFloat(process.env.COMPANY_DAILY_BUDGET_USD || '10.00');

export type ModelProvider = 'openai' | 'google' | 'openrouter' | 'groq';
export type ModelName = string; // Ex: 'gpt-4o-mini'

const getModelBaseName = (modelName: string): string => modelName.replace(/-latest$/, '');

export async function isPricingAvailable(modelProvider: ModelProvider, modelName: ModelName): Promise<boolean> {
    const key = `${modelProvider}:${getModelBaseName(modelName)}`;
    return !!PRICE_TABLE[key];
}

function calculateCost(modelProvider: ModelProvider, modelName: ModelName, tokensIn: number, tokensOut: number): number | null {
  const key = `${modelProvider}:${getModelBaseName(modelName)}`;
  const modelPricing = PRICE_TABLE[key];

  if (!modelPricing) {
    return null;
  }
  const inputCost = (tokensIn / 1_000_000) * modelPricing.input;
  const outputCost = (tokensOut / 1_000_000) * modelPricing.output;
  return inputCost + outputCost;
}

export async function logAiUsageAndUpdateCost(
  companyId: string,
  modelProvider: ModelProvider,
  modelName: ModelName,
  tokensIn: number,
  tokensOut: number,
  requestId: string,
): Promise<void> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const cost = calculateCost(modelProvider, modelName, tokensIn, tokensOut);

  if (cost === null) {
      console.warn(`[Costs - RequestId: ${requestId}] Custo não registado para a empresa ${companyId} devido a preço de modelo ausente.`);
      return;
  }

  try {
    await db
      .insert(aiUsageDaily)
      .values({
        companyId,
        date: today,
        provider: modelProvider,
        model: modelName,
        tokensIn,
        tokensOut,
        cost: cost.toString(),
        requestCount: 1,
      })
      .onConflictDoUpdate({
        target: [aiUsageDaily.companyId, aiUsageDaily.date, aiUsageDaily.provider, aiUsageDaily.model],
        set: {
          requestCount: sql`${aiUsageDaily.requestCount} + 1`,
          tokensIn: sql`${aiUsageDaily.tokensIn} + ${tokensIn}`,
          tokensOut: sql`${aiUsageDaily.tokensOut} + ${tokensOut}`,
          cost: sql`${aiUsageDaily.cost} + ${cost.toString()}`,
        },
      });
  } catch (error) {
    console.error(`[Costs - RequestId: ${requestId}] Falha ao registar o uso de IA para a empresa ${companyId}:`, error);
  }
}

interface BudgetCheckResult {
  exceeded: boolean;
  reason?: 'limit_exceeded' | 'pricing_missing' | 'disabled' | 'db_error';
}

export async function hasExceededDailyBudget(
    companyId: string, 
    requestId: string,
    modelProvider?: ModelProvider,
    modelName?: ModelName,
): Promise<BudgetCheckResult> {
  
    let finalStatus: BudgetCheckResult = { exceeded: false };
    let dailyUsd = 0;
    const pricingAvailable = !!(modelProvider && modelName && PRICE_TABLE[`${modelProvider}:${getModelBaseName(modelName)}`]);

    if (process.env.AI_DISABLE_BUDGET === '1') {
        finalStatus = { exceeded: false, reason: 'disabled' };
    } else if (modelProvider && modelName && !pricingAvailable) {
        finalStatus = { exceeded: false, reason: 'pricing_missing' };
    } else {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const [dailyUsage] = await db
                .select({ cost: aiUsageDaily.cost })
                .from(aiUsageDaily)
                .where(and(eq(aiUsageDaily.companyId, companyId), eq(aiUsageDaily.date, today)));
            
            // Garantir que dailyUsage existe e cost não é null/undefined
            const costValue = dailyUsage?.cost;
            dailyUsd = costValue ? parseFloat(costValue.toString()) : 0;

            if (dailyUsd >= COMPANY_DAILY_BUDGET_USD) {
                finalStatus = { exceeded: true, reason: 'limit_exceeded' };
            }

        } catch (error) {
            finalStatus = { exceeded: false, reason: 'db_error' }; // Fail open
            console.error(`[Costs] Falha ao verificar o orçamento para a empresa ${companyId}:`, error);
        }
    }
  
    console.log(`BudgetCheck requestId=${requestId} provider=${modelProvider || 'N/A'} model=${modelName || 'N/A'} pricingFound=${pricingAvailable} exceeded=${finalStatus.exceeded} dailyUsd=${dailyUsd.toFixed(4)}`);
    
    return finalStatus;
}
