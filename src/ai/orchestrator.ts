// src/ai/orchestrator.ts
import { logAiUsageAndUpdateCost } from '@/lib/costs';

interface SmokeTestOptions {
  debug?: boolean;
  dryRun?: boolean;
  companyId?: string;
}

interface SmokeTestResultItem {
  provider: 'openrouter';
  model: string;
  keyPresent: boolean;
  success: boolean;
  tokensIn?: number | null;
  tokensOut?: number | null;
  sampleOutput?: string;
  error?: string;
}

export async function runSmokeTests(options: SmokeTestOptions = {}): Promise<{
  ok: boolean;
  timestamp: string;
  debug?: boolean;
  dryRun?: boolean;
  results: SmokeTestResultItem[];
}> {
  const { debug = false, dryRun = false, companyId = 'smoke-tests' } = options;

  const results: SmokeTestResultItem[] = [];
  const requestIdBase = `smoke-${Date.now()}`;

  // GEMINI: Smoke test for Google Gemini (Exclusive Provider)
  {
    const geminiKey1 = process.env.GOOGLE_GEMINI_AGENTS1;
    const geminiKey2 = process.env.GOOGLE_GEMINI_AGENTS2;
    const keys = [
      { name: 'GOOGLE_GEMINI_AGENTS1', key: geminiKey1 },
      { name: 'GOOGLE_GEMINI_AGENTS2', key: geminiKey2 }
    ];

    const models = ['gemini-2.0-flash', 'gemini-1.5-flash-latest'];

    for (const { name, key } of keys) {
      for (const modelName of models) {
        try {
          const item: SmokeTestResultItem = {
            provider: 'google' as any, // Casting to any to avoid type errors if type definition isn't updated yet
            model: `${modelName} (${name})`,
            keyPresent: !!key,
            success: false,
            tokensIn: null,
            tokensOut: null,
          };

          if (!dryRun && item.keyPresent) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
            const body = {
              contents: [{ parts: [{ text: "Diga 'ok' se está ativo." }] }]
            };

            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });

            const ok = resp.ok;
            let output = '';
            if (ok) {
              const data: any = await resp.json();
              output = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }
            
            item.sampleOutput = output;
            item.success = !!output;
            const reqId = `${requestIdBase}-${modelName}-${name}`;
            // Log usage (mocking provider as google)
            await logAiUsageAndUpdateCost(companyId, 'google', modelName, 0, 0, reqId);
          }
          results.push(item);
        } catch (error: any) {
          results.push({
            provider: 'google' as any,
            model: `${modelName} (${name})`,
            keyPresent: !!key,
            success: false,
            tokensIn: null,
            tokensOut: null,
            error: error?.message || `Erro desconhecido ao testar Gemini (${modelName})`,
          });
        }
      }
    }
  }

  return {
    ok: results.some(r => r.success),
    timestamp: new Date().toISOString(),
    debug,
    dryRun,
    results,
  };
}
