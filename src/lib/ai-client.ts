import { resolveAIKeys } from "@/lib/ai-keys-resolver";

export type AIProvider = "anthropic" | "anthropic-haiku" | "gemini" | "openai" | "openai-mini";

interface CallAIParams {
  provider: AIProvider;
  systemPrompt: string;
  userContent: string;
  maxTokens?: number;
  companyId?: string | null;
}

interface CallAIResult {
  text: string;
}

const MODELS: Record<AIProvider, { endpoint: string; model: string; type: "anthropic" | "gemini" | "openai" }> = {
  "anthropic": { endpoint: "https://api.anthropic.com/v1/messages", model: "claude-sonnet-4-20250514", type: "anthropic" },
  "anthropic-haiku": { endpoint: "https://api.anthropic.com/v1/messages", model: "claude-haiku-4-5-20251001", type: "anthropic" },
  "gemini": { endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", model: "gemini-2.5-flash", type: "gemini" },
  "openai": { endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o", type: "openai" },
  "openai-mini": { endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini", type: "openai" },
};

export function getModelName(provider: AIProvider): string {
  return MODELS[provider]?.model || provider;
}

export async function callAI({ provider, systemPrompt, userContent, maxTokens = 1000, companyId }: CallAIParams): Promise<CallAIResult> {
  const config = MODELS[provider];
  if (!config) throw new Error(`Provider "${provider}" não suportado.`);

  const resolvedKeys = await resolveAIKeys(companyId);

  if (config.type === "anthropic") {
    // Note: AI keys resolver doesn't have anthropic natively yet, fallback to env for anthropic
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: config.model, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: "user", content: userContent }] }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Erro na API Anthropic: ${response.status}`);
    }
    const data = await response.json();
    return { text: data.content?.[0]?.text || "" };
  }

  if (config.type === "gemini") {
    const apiKey = resolvedKeys.geminiApiKey;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada (nem no .env nem no banco de dados).");

    const response = await fetch(`${config.endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt + "\n\n" + userContent }] }] }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Erro na API Gemini: ${response.status}`);
    }
    const data = await response.json();
    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || "" };
  }

  if (config.type === "openai") {
    const apiKey = resolvedKeys.openaiApiKey;
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada (nem no .env nem no banco de dados).");

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: config.model, max_tokens: maxTokens, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }] }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Erro na API OpenAI: ${response.status}`);
    }
    const data = await response.json();
    return { text: data.choices?.[0]?.message?.content || "" };
  }

  throw new Error(`Tipo de provider não reconhecido.`);
}
